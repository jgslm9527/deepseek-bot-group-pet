import { defineStore } from 'pinia'
import { computed, reactive, ref } from 'vue'
import type {
  Attachment,
  Bot,
  DiscussionState,
  Message,
  MessageMeta,
  Room,
  RoomKind,
} from '@/types'
import {
  addBotToRoom,
  createBot,
  deleteBot as deleteBotRecord,
  getRoomBots,
  listBots,
  muteAllBots,
  removeBotFromRoom,
  updateBot,
  type BotInput,
} from '@/lib/repos/bots'
import {
  createRoom as createRoomRecord,
  deleteRoom as deleteRoomRecord,
  findDirectRoom,
  listRooms,
  updateRoom,
} from '@/lib/repos/rooms'
import {
  addMessage,
  listMessages,
  listRecentMessages,
} from '@/lib/repos/messages'
import {
  getAwaitingDiscussions,
  getDiscussion,
  saveDiscussion,
  setDiscussionPhase,
} from '@/lib/repos/discussions'
import { addUsage } from '@/lib/repos/usage'
import { useSettingsStore } from '@/stores/settings'
import { useUiStore } from '@/stores/ui'
import { errorMessage } from '@/lib/tauri'
import {
  buildShortTermContext,
  estimateTokens,
  memoriesToPrompt,
  truncateToTokens,
} from '@/lib/context'
import {
  buildPipeline,
  buildSystemPrompt,
  buildUserPrompt,
  pickBotForStage,
  type PipelineMode,
  type PipelineStage,
} from '@/lib/prompts'
import { findMentionedBots } from '@/lib/mentions'
import { chatCompletion } from '@/lib/tauri'
import {
  scheduleMemoryExtraction,
  selectRelevantMemories,
} from '@/lib/memory-engine'
import {
  petError,
  petMuted,
  petNewMessage,
  petThinking,
} from '@/lib/pet-bus'
import { nowIso } from '@/lib/id'
import { markdownPreview } from '@/lib/preview'
import { sleep } from '@/lib/time'

interface TypingState {
  roomId: string
  botId: string
  botName: string
  label: string
}

interface ActiveRun {
  roomId: string
  runId: number
  mode: PipelineMode | 'mention' | 'direct'
}

let runCounter = 0
let abortController: AbortController | null = null

export const useChatStore = defineStore('chat', () => {
  const initialized = ref(false)
  const loading = ref(true)
  const loadingRoom = ref(false)
  const fatalError = ref('')
  const rooms = ref<Room[]>([])
  const bots = ref<Bot[]>([])
  const activeRoomId = ref<string | null>(null)
  const activeBots = ref<Bot[]>([])
  const messages = ref<Message[]>([])
  const activeDiscussion = ref<DiscussionState | null>(null)
  const typing = ref<TypingState[]>([])
  const activeRun = ref<ActiveRun | null>(null)
  const pendingRooms = ref<Set<string>>(new Set())
  const confirmDialogOpen = ref(false)
  const searchQuery = ref('')
  const isSending = ref(false)
  const draftMap = reactive<Record<string, string>>({})
  const attachmentMap = reactive<Record<string, Attachment[]>>({})

  const activeRoom = computed(() => rooms.value.find((room) => room.id === activeRoomId.value) ?? null)
  const botMap = computed(() => new Map(bots.value.map((bot) => [bot.id, bot])))
  const activePending = computed(() => activeDiscussion.value?.phase === 'awaiting_confirm')
  const showConfirmationDialog = computed(
    () => activePending.value && confirmDialogOpen.value,
  )
  const isActiveRoomRunning = computed(
    () => !!activeRun.value && activeRun.value.roomId === activeRoomId.value,
  )
  const isGenerating = computed(() => !!activeRun.value)
  const typingForActive = computed(() =>
    typing.value.filter((item) => item.roomId === activeRoomId.value),
  )
  const draft = computed({
    get: () => (activeRoomId.value ? (draftMap[activeRoomId.value] ?? '') : ''),
    set: (value: string) => {
      if (activeRoomId.value) draftMap[activeRoomId.value] = value
    },
  })
  const attachments = computed({
    get: () => (activeRoomId.value ? (attachmentMap[activeRoomId.value] ?? []) : []),
    set: (value: Attachment[]) => {
      if (activeRoomId.value) attachmentMap[activeRoomId.value] = value
    },
  })
  const activeRooms = computed(() =>
    rooms.value.filter((room) => room.kind === 'group'),
  )
  const directRooms = computed(() =>
    rooms.value.filter((room) => room.kind === 'direct'),
  )
  const normalizedQuery = computed(() => searchQuery.value.trim().toLowerCase())
  const filteredGroups = computed(() => filterRooms(activeRooms.value))
  const filteredDirects = computed(() => filterRooms(directRooms.value))
  const hasAnyRoom = computed(() => rooms.value.length > 0)

  function filterRooms(list: Room[]): Room[] {
    const query = normalizedQuery.value
    if (!query) return list
    return list.filter(
      (room) =>
        room.name.toLowerCase().includes(query) ||
        (room.lastMessage ?? '').toLowerCase().includes(query),
    )
  }

  async function initialize() {
    if (initialized.value) return
    loading.value = true
    fatalError.value = ''
    try {
      const [botList, roomList, awaiting] = await Promise.all([
        listBots(),
        listRooms(),
        getAwaitingDiscussions(),
      ])
      bots.value = botList
      rooms.value = roomList
      pendingRooms.value = new Set(awaiting.map((item) => item.roomId))
      const saved = localStorage.getItem('dgp.activeRoom')
      const target =
        roomList.find((room) => room.id === saved)?.id ??
        roomList[0]?.id ??
        null
      if (target) await selectRoom(target)
      initialized.value = true
    } catch (error) {
      fatalError.value = errorMessage(error)
    } finally {
      loading.value = false
    }
  }

  async function reloadAll() {
    loading.value = true
    fatalError.value = ''
    try {
      bots.value = await listBots()
      rooms.value = await listRooms()
      if (activeRoomId.value) await selectRoom(activeRoomId.value)
      else if (rooms.value[0]) await selectRoom(rooms.value[0].id)
      initialized.value = true
    } catch (error) {
      fatalError.value = errorMessage(error)
    } finally {
      loading.value = false
    }
  }

  async function selectRoom(roomId: string) {
    if (!rooms.value.some((room) => room.id === roomId)) return
    activeRoomId.value = roomId
    localStorage.setItem('dgp.activeRoom', roomId)
    loadingRoom.value = true
    confirmDialogOpen.value = false
    try {
      const [botList, messageList, discussion] = await Promise.all([
        getRoomBots(roomId),
        listMessages(roomId),
        getDiscussion(roomId),
      ])
      activeBots.value = botList
      messages.value = messageList
      let nextDiscussion = discussion
      if (discussion) {
        const sameRun = activeRun.value?.roomId === roomId
        if (!sameRun && (discussion.phase === 'discussing' || discussion.phase === 'implementing')) {
          nextDiscussion = {
            ...discussion,
            phase: discussion.phase === 'implementing' ? 'awaiting_confirm' : 'idle',
            updatedAt: nowIso(),
          }
          await saveDiscussion(nextDiscussion)
        }
      }
      activeDiscussion.value = nextDiscussion
      if (nextDiscussion?.phase === 'awaiting_confirm') {
        pendingRooms.value = new Set([...pendingRooms.value, roomId])
      } else {
        pendingRooms.value = new Set([...pendingRooms.value].filter((id) => id !== roomId))
      }
    } finally {
      loadingRoom.value = false
    }
  }

  async function refreshRooms() {
    rooms.value = await listRooms()
  }

  async function refreshBots() {
    bots.value = await listBots()
    if (activeRoomId.value) {
      activeBots.value = await getRoomBots(activeRoomId.value)
    }
  }

  async function refreshActiveBots() {
    if (!activeRoomId.value) return
    activeBots.value = await getRoomBots(activeRoomId.value)
  }

  function updateRoomPreview(roomId: string, preview: string, at: string) {
    const room = rooms.value.find((item) => item.id === roomId)
    if (!room) return
    room.lastMessage = preview
    room.lastMessageAt = at
    rooms.value = [...rooms.value].sort((a, b) => {
      const aTime = new Date(a.lastMessageAt ?? a.updatedAt).getTime()
      const bTime = new Date(b.lastMessageAt ?? b.updatedAt).getTime()
      return bTime - aTime
    })
  }

  function previewOf(message: Message): string {
    const content = markdownPreview(message.content, 84)
    if (content) return content
    if (message.attachments.length) return `[文件] ${message.attachments[0].name}`
    return ''
  }

  async function appendMessage(input: {
    roomId: string
    senderType: 'user' | 'bot' | 'system'
    botId?: string | null
    content: string
    attachments?: Attachment[]
    meta?: MessageMeta
  }): Promise<Message> {
    const message = await addMessage(input)
    if (activeRoomId.value === input.roomId) messages.value.push(message)
    if (input.senderType !== 'system') {
      updateRoomPreview(input.roomId, previewOf(message), message.createdAt)
    }
    return message
  }

  async function appendSystem(roomId: string, content: string, meta: MessageMeta = {}) {
    return appendMessage({
      roomId,
      senderType: 'system',
      content,
      meta: { kind: 'setup', ...meta },
    })
  }

  function updateDiscussionState(state: DiscussionState) {
    if (activeRoomId.value === state.roomId) {
      activeDiscussion.value = state
    }
    if (state.phase === 'awaiting_confirm') {
      pendingRooms.value = new Set([...pendingRooms.value, state.roomId])
    } else {
      const next = new Set(pendingRooms.value)
      next.delete(state.roomId)
      pendingRooms.value = next
    }
  }

  async function clearPendingForRoom(roomId: string) {
    if (activeDiscussion.value?.roomId === roomId && activeDiscussion.value.phase === 'awaiting_confirm') {
      activeDiscussion.value = { ...activeDiscussion.value, phase: 'idle', updatedAt: nowIso() }
    }
    if (pendingRooms.value.has(roomId)) {
      const next = new Set(pendingRooms.value)
      next.delete(roomId)
      pendingRooms.value = next
    }
    confirmDialogOpen.value = false
    await setDiscussionPhase(roomId, 'idle').catch(() => undefined)
  }

  async function sendMessage(content: string, files: Attachment[] = []) {
    const room = activeRoom.value
    if (!room || isSending.value) return
    const text = content.trim()
    if (!text && !files.length) return
    isSending.value = true
    const settings = useSettingsStore()
    const ui = useUiStore()
    try {
      await clearPendingForRoom(room.id)
      const userMessage = await appendMessage({
        roomId: room.id,
        senderType: 'user',
        content: text || `[文件] ${files.map((file) => file.name).join('、')}`,
        attachments: files,
      })
      draft.value = ''
      attachments.value = []
      if (!settings.hasApiKey) {
        await appendSystem(
          room.id,
          '尚未配置 DeepSeek API Key。消息已保存在本地，配置密钥后即可让 Bot 回复。',
          { kind: 'error' },
        )
        ui.openSettings('api')
        ui.toast('需要 API Key', '请先在设置中填写 DeepSeek API Key。', 'error')
        return
      }
      await dispatchUserMessage(room, userMessage)
    } catch (error) {
      ui.toast('发送失败', errorMessage(error), 'error')
    } finally {
      isSending.value = false
    }
  }

  async function dispatchUserMessage(room: Room, userMessage: Message) {
    const roomBots = await getRoomBots(room.id)
    if (activeRoomId.value === room.id) activeBots.value = roomBots
    if (!roomBots.length) {
      await appendSystem(room.id, '本会话还没有 Bot。请先添加成员或新建 Bot。', {
        kind: 'error',
      })
      return
    }

    if (room.kind === 'direct') {
      const bot = roomBots[0]
      if (bot.muted) {
        await appendSystem(
          room.id,
          `${bot.name} 已静音，本次不会回复。可在右侧详情中取消静音。`,
        )
        return
      }
      await runSingleReply(room, bot, userMessage.content, 'direct', userMessage, roomBots)
      return
    }

    if (room.autoPoll) {
      await startAutoDiscussion(userMessage.content || '请阅读我上传的文件并讨论。', {
        mode: 'auto',
        roomId: room.id,
        userMessage,
      })
      return
    }

    const mentioned = findMentionedBots(userMessage.content, roomBots)
    if (!mentioned.length) {
      await appendSystem(
        room.id,
        '自动轮询已关闭。使用 @Bot 名称 指定成员，才会触发回复。',
      )
      return
    }

    const available = mentioned.filter((bot) => !bot.muted)
    for (const bot of mentioned.filter((item) => item.muted)) {
      await appendSystem(room.id, `${bot.name} 已静音，已跳过本次点名。`)
    }
    if (!available.length) return
    await runMentionReplies(room, available, userMessage.content, userMessage, roomBots)
  }

  function beginRun(roomId: string, mode: ActiveRun['mode']): { runId: number; signal: AbortSignal } {
    const runId = ++runCounter
    abortController?.abort()
    abortController = new AbortController()
    activeRun.value = { roomId, runId, mode }
    return { runId, signal: abortController.signal }
  }

  function isRunCurrent(runId: number): boolean {
    return activeRun.value?.runId === runId
  }

  function finishRun(runId: number) {
    if (activeRun.value?.runId === runId) {
      activeRun.value = null
      abortController = null
    }
  }

  function setTyping(roomId: string, bot: Bot, label: string) {
    typing.value = [
      ...typing.value.filter((item) => !(item.roomId === roomId && item.botId === bot.id)),
      { roomId, botId: bot.id, botName: bot.name, label },
    ]
  }

  function clearTyping(roomId: string, botId: string) {
    typing.value = typing.value.filter(
      (item) => !(item.roomId === roomId && item.botId === botId),
    )
  }

  async function startAutoDiscussion(
    request: string,
    options: {
      mode: 'auto' | 'revision'
      roomId?: string
      userMessage?: Message
    },
  ) {
    const ui = useUiStore()
    const roomId = options.roomId ?? activeRoomId.value
    if (!roomId) return
    const room = rooms.value.find((item) => item.id === roomId)
    if (!room) return
    if (activeRun.value) {
      ui.toast('正在生成中', '请等待当前会话完成，或先停止自动轮询。', 'error')
      return
    }

    const roomBots = await getRoomBots(roomId)
    if (activeRoomId.value === roomId) activeBots.value = roomBots
    const unmuted = roomBots.filter((bot) => !bot.muted)
    if (!unmuted.length) {
      await appendSystem(roomId, '所有 Bot 均已静音，自动轮询未启动。')
      ui.toast('全部 Bot 已静音', '请在右侧成员列表取消静音。', 'error')
      return
    }

    const stages = buildPipeline(options.mode)
      .filter((stage) => unmuted.some((bot) => bot.role === stage.role))
      .slice(0, Math.max(1, Math.min(12, room.maxAutoMessages)))
    if (!stages.length) {
      await appendSystem(roomId, '群内没有可用的流水线 Bot，请添加架构、评审或实现角色。')
      return
    }

    const { runId, signal } = beginRun(roomId, options.mode)
    let phase: DiscussionState = {
      roomId,
      phase: 'discussing',
      request,
      turnCount: 0,
      maxTurns: stages.length,
      mode: options.mode,
      updatedAt: nowIso(),
    }
    try {
      await saveDiscussion(phase)
      if (activeRoomId.value === roomId) {
        activeDiscussion.value = phase
        confirmDialogOpen.value = false
      }
      const chain = stages
        .map((stage) => {
          const bot = pickBotForStage(stage, unmuted)
          return bot ? `${bot.name}（${stage.label}）` : ''
        })
        .filter(Boolean)
        .join(' → ')
      await appendSystem(
        roomId,
        `${options.mode === 'revision' ? '修订讨论' : '自动轮询'}已启动 · ${chain}。讨论阶段不会产出最终代码。`,
      )

      let previousBotId: string | null = null
      for (let index = 0; index < stages.length; index += 1) {
        if (!isRunCurrent(runId) || signal.aborted) return
        const stage = stages[index]
        if (index > 0) {
          try {
            await sleep(Math.max(0, room.cooldownSeconds) * 1000, signal)
          } catch {
            return
          }
        }
        if (!isRunCurrent(runId) || signal.aborted) return
        const bot = pickBotForStage(stage, unmuted, previousBotId)
        if (!bot) {
          await appendSystem(roomId, '没有可继续发言的 Bot，自动轮询已停止。', {
            kind: 'error',
          })
          phase = { ...phase, phase: 'idle', updatedAt: nowIso() }
          await saveDiscussion(phase)
          if (activeRoomId.value === roomId) activeDiscussion.value = phase
          return
        }

        const result = await runBotTurn({
          room,
          bot,
          roomBots,
          request,
          stage,
          mode: options.mode,
          runId,
          attachmentsLabel: attachmentLabel(options.userMessage),
        })
        if (!isRunCurrent(runId) || signal.aborted) return
        if (!result.ok) {
          phase = { ...phase, phase: 'idle', updatedAt: nowIso() }
          await saveDiscussion(phase)
          if (activeRoomId.value === roomId) activeDiscussion.value = phase
          return
        }
        previousBotId = bot.id
        phase = {
          ...phase,
          turnCount: index + 1,
          updatedAt: nowIso(),
        }
        await saveDiscussion(phase)
        if (activeRoomId.value === roomId) activeDiscussion.value = phase
      }

      if (!isRunCurrent(runId) || signal.aborted) return
      phase = {
        ...phase,
        phase: 'awaiting_confirm',
        turnCount: stages.length,
        updatedAt: nowIso(),
      }
      await saveDiscussion(phase)
      updateDiscussionState(phase)
      await appendSystem(
        roomId,
        '讨论已闭环，自动轮询已停止。确认前不会生成最终代码产物，请检查讨论后做出选择。',
      )
      if (activeRoomId.value === roomId) {
        confirmDialogOpen.value = true
        ui.toast('讨论已闭环', '等待你确认后再生成最终代码。', 'success')
      } else {
        ui.toast(`${room.name} 讨论已闭环`, '切换到该会话确认是否开始实现。', 'success')
      }
      scheduleMemoryExtraction(roomId)
    } catch (error) {
      if (isRunCurrent(runId)) {
        await appendSystem(roomId, `自动轮询中断：${errorMessage(error)}`, {
          kind: 'error',
        }).catch(() => undefined)
        const failed: DiscussionState = { ...phase, phase: 'idle', updatedAt: nowIso() }
        await saveDiscussion(failed).catch(() => undefined)
        if (activeRoomId.value === roomId) activeDiscussion.value = failed
        ui.toast('自动轮询中断', errorMessage(error), 'error')
      }
    } finally {
      finishRun(runId)
    }
  }

  async function runMentionReplies(
    room: Room,
    mentioned: Bot[],
    request: string,
    userMessage: Message,
    roomBots: Bot[],
  ) {
    if (activeRun.value) {
      useUiStore().toast('正在生成中', '请等待当前任务完成。', 'error')
      return
    }
    const { runId, signal } = beginRun(room.id, 'mention')
    try {
      for (const [index, bot] of mentioned.entries()) {
        if (!isRunCurrent(runId) || signal.aborted) return
        if (index > 0) {
          try {
            await sleep(Math.max(0, room.cooldownSeconds) * 500, signal)
          } catch {
            return
          }
        }
        const result = await runBotTurn({
          room,
          bot,
          roomBots,
          request,
          stage: null,
          mode: 'mention',
          runId,
          attachmentsLabel: attachmentLabel(userMessage),
        })
        if (!result.ok) return
      }
      scheduleMemoryExtraction(room.id)
    } finally {
      finishRun(runId)
    }
  }

  async function runSingleReply(
    room: Room,
    bot: Bot,
    request: string,
    mode: 'direct' | 'mention',
    userMessage: Message | undefined,
    roomBots: Bot[],
  ) {
    if (activeRun.value) {
      useUiStore().toast('正在生成中', '请等待当前任务完成。', 'error')
      return
    }
    const { runId } = beginRun(room.id, mode)
    try {
      const result = await runBotTurn({
        room,
        bot,
        roomBots,
        request,
        stage: null,
        mode,
        runId,
        attachmentsLabel: attachmentLabel(userMessage),
      })
      if (result.ok) scheduleMemoryExtraction(room.id)
    } finally {
      finishRun(runId)
    }
  }

  async function runBotTurn(input: {
    room: Room
    bot: Bot
    roomBots: Bot[]
    request: string
    stage: PipelineStage | null
    mode: PipelineMode
    runId: number
    attachmentsLabel: string
  }): Promise<{ ok: boolean; message?: Message }> {
    if (!isRunCurrent(input.runId)) return { ok: false }
    const settings = useSettingsStore()
    const ui = useUiStore()
    setTyping(input.room.id, input.bot, input.stage?.label ?? '回复中')
    petThinking(true)
    try {
      const botMap = new Map(input.roomBots.map((bot) => [bot.id, bot]))
      const recent = await listRecentMessages(input.room.id, input.room.contextMessages)
      const relevant = await selectRelevantMemories({
        bot: input.bot,
        roomId: input.room.id,
        roomBots: input.roomBots,
        request: `${input.request}\n当前阶段：${input.stage?.label ?? input.mode}`,
        timeoutSecs: settings.app.defaultTimeoutSecs,
      })
      if (!isRunCurrent(input.runId)) return { ok: false }

      const memoryBudget = Math.min(2600, Math.floor(settings.app.maxContextTokens * 0.3))
      const memoryBlock = truncateToTokens(memoriesToPrompt(relevant.memories), memoryBudget)
      const personaTokens = estimateTokens(
        `${input.bot.systemPrompt}${settings.profile}${input.request}`,
      )
      const transcriptBudget = Math.max(
        600,
        settings.app.maxContextTokens - personaTokens - memoryBudget - 1200,
      )
      const shortTerm = buildShortTermContext(recent, botMap, transcriptBudget)
      const systemPrompt = buildSystemPrompt({
        bot: input.bot,
        userProfile: settings.profile,
        memoryBlock,
        shortTermContext: shortTerm.text,
        members: input.roomBots,
        request: input.request,
        stage: input.stage,
        mode: input.mode,
        allowBotMentions: input.room.allowBotMentions,
        attachments: input.attachmentsLabel,
      })
      const userPrompt = buildUserPrompt({
        request: input.request,
        stage: input.stage,
        mode: input.mode,
        attachments: input.attachmentsLabel,
      })

      const result = await chatCompletion({
        model: input.bot.model,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
        temperature: input.bot.temperature,
        maxTokens: input.bot.maxTokens,
        timeoutSecs: settings.app.defaultTimeoutSecs,
        usageContext: {
          roomId: input.room.id,
          botId: input.bot.id,
          kind: input.mode === 'final' ? 'final' : 'chat',
        },
      })

      await addUsage({
        roomId: input.room.id,
        botId: input.bot.id,
        model: result.model,
        usage: result.usage,
        kind: input.mode === 'final' ? 'final' : 'chat',
      })
      if (!isRunCurrent(input.runId)) return { ok: false }

      const kind: MessageMeta['kind'] =
        input.mode === 'final'
          ? 'final'
          : input.stage?.key.includes('review') || input.stage?.key.includes('closure')
            ? 'review'
            : input.stage?.key.includes('plan') || input.stage?.key === 'ready'
              ? 'plan'
              : input.stage?.key.includes('revision')
                ? 'revision'
                : input.stage
                  ? 'proposal'
                  : undefined

      const message = await appendMessage({
        roomId: input.room.id,
        senderType: 'bot',
        botId: input.bot.id,
        content: result.content,
        meta: {
          kind,
          stage: input.stage?.label,
          botName: input.bot.name,
          usage: result.usage,
        },
      })
      petNewMessage(input.bot.name, input.bot.accent, result.content)
      return { ok: true, message }
    } catch (error) {
      if (!isRunCurrent(input.runId)) return { ok: false }
      const message = errorMessage(error)
      await appendSystem(input.room.id, `${input.bot.name} 调用失败：${message}`, {
        kind: 'error',
      }).catch(() => undefined)
      ui.toast('DeepSeek 调用失败', message, 'error')
      petError(message)
      return { ok: false }
    } finally {
      clearTyping(input.room.id, input.bot.id)
      petThinking(false)
    }
  }

  function attachmentLabel(message?: Message): string {
    if (!message?.attachments.length) return ''
    return message.attachments
      .map((file) => `· ${file.name}（${Math.round(file.size / 1024)} KB，内容已附在上文）`)
      .join('\n')
  }

  async function confirmImplementation() {
    const room = activeRoom.value
    const discussion = activeDiscussion.value
    const ui = useUiStore()
    const settings = useSettingsStore()
    if (!room || !discussion || discussion.phase !== 'awaiting_confirm' || activeRun.value) return
    if (!settings.hasApiKey) {
      ui.openSettings('api')
      ui.toast('需要 API Key', '请先配置 DeepSeek API Key。', 'error')
      return
    }
    const roomBots = await getRoomBots(room.id)
    const builder =
      roomBots.find((bot) => bot.role === 'builder' && !bot.muted) ??
      roomBots.find((bot) => !bot.muted)
    if (!builder) {
      ui.toast('没有可用的实现 Bot', '请添加或取消静音一个代码 Bot。', 'error')
      return
    }

    confirmDialogOpen.value = false
    const { runId } = beginRun(room.id, 'final')
    const implementing: DiscussionState = { ...discussion, phase: 'implementing', updatedAt: nowIso() }
    await saveDiscussion(implementing)
    if (activeRoomId.value === room.id) activeDiscussion.value = implementing
    pendingRooms.value = new Set([...pendingRooms.value].filter((id) => id !== room.id))
    await appendMessage({
      roomId: room.id,
      senderType: 'user',
      content: '✅ 确认开始实现',
      meta: { kind: 'final-confirmed' },
    })
    await appendSystem(room.id, `用户已确认开始实现，${builder.name} 正在生成最终代码产物…`)
    try {
      const result = await runBotTurn({
        room,
        bot: builder,
        roomBots,
        request: discussion.request,
        stage: null,
        mode: 'final',
        runId,
        attachmentsLabel: attachmentLabel(
          [...messages.value].reverse().find((message) => message.senderType === 'user' && message.attachments.length),
        ),
      })
      if (!isRunCurrent(runId)) return
      if (!result.ok) {
        const failed: DiscussionState = {
          ...discussion,
          phase: 'awaiting_confirm',
          updatedAt: nowIso(),
        }
        await saveDiscussion(failed)
        updateDiscussionState(failed)
        confirmDialogOpen.value = activeRoomId.value === room.id
        return
      }
      const done: DiscussionState = { ...implementing, phase: 'idle', updatedAt: nowIso() }
      await saveDiscussion(done)
      if (activeRoomId.value === room.id) activeDiscussion.value = done
      pendingRooms.value = new Set([...pendingRooms.value].filter((id) => id !== room.id))
      await appendSystem(room.id, '最终代码产物已生成。你可以复制或保存这份实现，继续在群内提出修订。')
      scheduleMemoryExtraction(room.id)
      ui.toast('最终产物已生成', `${builder.name} 已完成实现。`, 'success')
    } catch (error) {
      const failed: DiscussionState = {
        ...discussion,
        phase: 'awaiting_confirm',
        updatedAt: nowIso(),
      }
      await saveDiscussion(failed).catch(() => undefined)
      updateDiscussionState(failed)
      ui.toast('生成失败', errorMessage(error), 'error')
    } finally {
      finishRun(runId)
    }
  }

  async function rejectDiscussion(feedback: string) {
    const room = activeRoom.value
    const discussion = activeDiscussion.value
    if (!room || !discussion || discussion.phase !== 'awaiting_confirm') return
    confirmDialogOpen.value = false
    const trimmed = feedback.trim()
    if (!trimmed) {
      await appendSystem(room.id, '已驳回当前结论。请在输入框补充修改意见并发送，讨论将继续。')
      setTimeout(() => {
        document.querySelector<HTMLTextAreaElement>('[data-composer-input]')?.focus()
      }, 100)
      return
    }
    await appendMessage({
      roomId: room.id,
      senderType: 'user',
      content: `修改意见：${trimmed}`,
      meta: { kind: 'revision' },
    })
    await clearPendingForRoom(room.id)
    await startAutoDiscussion(`${discussion.request}\n\n用户修改意见：\n${trimmed}`, {
      mode: 'revision',
      roomId: room.id,
    })
  }

  async function stopGeneration() {
    const run = activeRun.value
    if (!run) return
    const ui = useUiStore()
    ++runCounter
    abortController?.abort()
    abortController = null
    activeRun.value = null
    typing.value = []
    if (activeRoomId.value === run.roomId) confirmDialogOpen.value = false
    const room = rooms.value.find((item) => item.id === run.roomId)
    if (!room) return
    const discussion =
      activeDiscussion.value?.roomId === run.roomId
        ? activeDiscussion.value
        : await getDiscussion(run.roomId).catch(() => null)
    if (discussion && (discussion.phase === 'discussing' || discussion.phase === 'implementing')) {
      const phase = discussion.phase === 'implementing' ? 'awaiting_confirm' : 'idle'
      const next: DiscussionState = { ...discussion, phase, updatedAt: nowIso() }
      await saveDiscussion(next).catch(() => undefined)
      if (activeRoomId.value === run.roomId) activeDiscussion.value = next
      if (phase === 'awaiting_confirm') {
        pendingRooms.value = new Set([...pendingRooms.value, room.id])
      } else {
        pendingRooms.value = new Set([...pendingRooms.value].filter((id) => id !== room.id))
      }
    }
    await appendSystem(
      run.roomId,
      run.mode === 'final'
        ? '已停止生成最终实现。讨论结论仍保留，你可以再次确认。'
        : '已停止自动轮询。你可以继续编辑需求后重新开始。',
    )
    ui.toast('已停止', '进行中的请求返回后会被丢弃。')
  }

  async function setAutoPoll(value: boolean) {
    const room = activeRoom.value
    if (!room) return
    if (!value && activeRun.value?.roomId === room.id) {
      await stopGeneration()
    }
    room.autoPoll = value
    await updateRoom(room.id, { autoPoll: value })
    await appendSystem(
      room.id,
      value
        ? '自动轮询已开启：发送需求后将按「方案 → 评审 → 落地计划」接力讨论。'
        : '自动轮询已关闭：只有被 @ 指定时 Bot 才会回复。',
    )
  }

  async function setAllowBotMentions(value: boolean) {
    const room = activeRoom.value
    if (!room) return
    room.allowBotMentions = value
    await updateRoom(room.id, { allowBotMentions: value })
  }

  async function patchRoomSettings(
    patch: Partial<
      Pick<
        Room,
        | 'name'
        | 'autoPoll'
        | 'allowBotMentions'
        | 'cooldownSeconds'
        | 'maxAutoMessages'
        | 'contextMessages'
      >
    >,
  ) {
    const room = activeRoom.value
    if (!room) return
    Object.assign(room, patch)
    await updateRoom(room.id, patch)
    rooms.value = [...rooms.value]
  }

  async function toggleBotMute(bot: Bot) {
    const next = !bot.muted
    await updateBot(bot.id, { muted: next })
    const global = bots.value.find((item) => item.id === bot.id)
    if (global) global.muted = next
    const member = activeBots.value.find((item) => item.id === bot.id)
    if (member) member.muted = next
  }

  async function createGroup(name: string, botIds: string[]) {
    const ui = useUiStore()
    if (!name.trim() || !botIds.length) {
      ui.toast('无法创建群聊', '请填写名称并至少选择一个 Bot。', 'error')
      return null
    }
    const room = await createRoomRecord({ name: name.trim(), kind: 'group', botIds })
    await appendSystem(
      room.id,
      `${botIds.length} 个 Bot 已加入房间。发送需求即可开始自动讨论；讨论闭环后需你确认才会生成代码。`,
    )
    await refreshRooms()
    await selectRoom(room.id)
    ui.newRoomOpen = false
    ui.toast('群聊已创建', undefined, 'success')
    return room
  }

  async function createPrivate(botId: string) {
    const ui = useUiStore()
    const existing = await findDirectRoom(botId)
    if (existing) {
      await refreshRooms()
      await selectRoom(existing.id)
      ui.newRoomOpen = false
      return existing
    }
    const bot = bots.value.find((item) => item.id === botId)
    if (!bot) return null
    const room = await createRoomRecord({
      name: bot.name,
      kind: 'direct' as RoomKind,
      botIds: [botId],
    })
    await appendSystem(room.id, `你与 ${bot.name} 的私聊。这里不会启动群流水线。`)
    await refreshRooms()
    await selectRoom(room.id)
    ui.newRoomOpen = false
    ui.toast('私聊已创建', undefined, 'success')
    return room
  }

  async function addMember(roomId: string, botId: string) {
    const ui = useUiStore()
    await addBotToRoom(roomId, botId)
    const bot = bots.value.find((item) => item.id === botId)
    await appendSystem(roomId, `${bot?.avatar ?? ''} ${bot?.name ?? 'Bot'} 加入了房间。`)
    await refreshActiveBots()
    rooms.value = rooms.value.map((room) =>
      room.id === roomId
        ? { ...room, memberCount: (room.memberCount ?? 0) + 1 }
        : room,
    )
    ui.addMemberOpen = false
    ui.toast('成员已加入', undefined, 'success')
  }

  async function removeMember(roomId: string, bot: Bot) {
    if (activeDiscussion.value?.phase === 'awaiting_confirm' && activeBots.value.length <= 1) {
      useUiStore().toast('无法移出', '请保留至少一个 Bot，或先结束讨论。', 'error')
      return
    }
    await removeBotFromRoom(roomId, bot.id)
    await appendSystem(roomId, `${bot.name} 已退出房间。`)
    await refreshActiveBots()
    rooms.value = rooms.value.map((room) =>
      room.id === roomId
        ? { ...room, memberCount: Math.max(0, (room.memberCount ?? 1) - 1) }
        : room,
    )
    if (activeRoomId.value === roomId) await refreshBots()
  }

  async function saveBotProfile(input: BotInput, botId: string | null, addToRoomId?: string | null) {
    const ui = useUiStore()
    if (!input.name.trim()) throw new Error('Bot 名称不能为空')
    let saved: Bot | undefined
    if (botId) {
      await updateBot(botId, input)
      await refreshBots()
      saved = bots.value.find((item) => item.id === botId)
    } else {
      saved = await createBot(input)
    }
    if (!saved) throw new Error('保存 Bot 失败')
    if (!botId && addToRoomId) {
      await addBotToRoom(addToRoomId, saved.id)
      await appendSystem(addToRoomId, `${saved.name} 加入了房间。`)
    }
    await refreshBots()
    if (addToRoomId) await refreshActiveBots()
    ui.closeBotEditor()
    ui.toast('Bot 已保存', saved.name, 'success')
    return saved
  }

  async function deleteBot(bot: Bot) {
    const ui = useUiStore()
    const okay = await ui.askConfirm({
      title: `删除 Bot「${bot.name}」？`,
      description: '该 Bot 的记忆和所有会话成员关系都会被删除。历史消息仍会保留。',
      confirmText: '删除 Bot',
      tone: 'danger',
    })
    if (!okay) return
    await deleteBotRecord(bot.id)
    await refreshBots()
    await refreshActiveBots()
    ui.toast('Bot 已删除', bot.name)
  }

  async function deleteActiveRoom() {
    const room = activeRoom.value
    if (!room) return
    const ui = useUiStore()
    const okay = await ui.askConfirm({
      title: `删除会话「${room.name}」？`,
      description: '该会话的消息、讨论状态与来源记忆都会被删除，此操作不可撤销。',
      confirmText: '删除会话',
      tone: 'danger',
    })
    if (!okay) return
    if (activeRun.value?.roomId === room.id) await stopGeneration()
    await deleteRoomRecord(room.id)
    await refreshRooms()
    const next = rooms.value[0]
    activeRoomId.value = next?.id ?? null
    activeBots.value = []
    messages.value = []
    activeDiscussion.value = null
    if (next) await selectRoom(next.id)
    ui.detailsOpen = false
    ui.toast('会话已删除')
  }

  async function muteAll() {
    const ui = useUiStore()
    if (activeRun.value) await stopGeneration()
    await muteAllBots(true)
    for (const bot of bots.value) bot.muted = true
    for (const bot of activeBots.value) bot.muted = true
    await refreshBots()
    if (activeRoomId.value) {
      await appendSystem(activeRoomId.value, '全部 Bot 已静音。可在右侧详情中单独取消静音。')
    }
    ui.toast('全部 Bot 已静音')
    petMuted()
  }

  function openConfirmation() {
    if (activePending.value) confirmDialogOpen.value = true
  }

  function dismissConfirmation() {
    confirmDialogOpen.value = false
  }

  function addAttachments(files: Attachment[]) {
    if (!activeRoomId.value) return
    attachmentMap[activeRoomId.value] = [...(attachmentMap[activeRoomId.value] ?? []), ...files]
  }

  function removeAttachment(id: string) {
    if (!activeRoomId.value) return
    attachmentMap[activeRoomId.value] = (attachmentMap[activeRoomId.value] ?? []).filter(
      (file) => file.id !== id,
    )
  }

  function botForMessage(message: Message): Bot | null {
    return message.botId ? botMap.value.get(message.botId) ?? null : null
  }

  function discussionForActive(): DiscussionState | null {
    return activeDiscussion.value
  }

  return {
    initialized,
    loading,
    loadingRoom,
    fatalError,
    rooms,
    bots,
    activeRoomId,
    activeBots,
    messages,
    activeDiscussion,
    typing,
    activeRun,
    pendingRooms,
    confirmDialogOpen,
    searchQuery,
    isSending,
    draftMap,
    attachmentMap,
    activeRoom,
    botMap,
    activePending,
    showConfirmationDialog,
    isActiveRoomRunning,
    isGenerating,
    typingForActive,
    draft,
    attachments,
    activeRooms,
    directRooms,
    filteredGroups,
    filteredDirects,
    hasAnyRoom,
    normalizedQuery,
    initialize,
    reloadAll,
    selectRoom,
    refreshRooms,
    refreshBots,
    refreshActiveBots,
    sendMessage,
    startAutoDiscussion,
    confirmImplementation,
    rejectDiscussion,
    stopGeneration,
    setAutoPoll,
    setAllowBotMentions,
    patchRoomSettings,
    toggleBotMute,
    createGroup,
    createPrivate,
    addMember,
    removeMember,
    saveBotProfile,
    deleteBot,
    deleteActiveRoom,
    muteAll,
    openConfirmation,
    dismissConfirmation,
    addAttachments,
    removeAttachment,
    botForMessage,
    discussionForActive,
    scheduleMemoryExtraction,
  }
})
