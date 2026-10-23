import type { Bot, Memory, Message, TokenUsage } from '@/types'
import {
  countMemories,
  createMemory,
  getMemoriesByIds,
  getMemoryCandidates,
  listMemories,
  pickEvictableMemories,
  setMemoryStatus,
  updateMemory,
} from '@/lib/repos/memories'
import {
  getAppSettings,
  getUserProfile,
} from '@/lib/repos/settings'
import { getRoomBots } from '@/lib/repos/bots'
import { addUsage } from '@/lib/repos/usage'
import { listRecentMessages } from '@/lib/repos/messages'
import { chatCompletion } from '@/lib/tauri'
import { estimateTokens, buildShortTermContext, formatContextMessage } from '@/lib/context'
import { extractJson } from '@/lib/json'
import { sleep } from '@/lib/time'

const FILTER_MODEL = 'deepseek-chat'
const EXTRACT_MODEL = 'deepseek-chat'

type MemoryListener = (roomId: string) => void
const listeners = new Set<MemoryListener>()

export function onMemoriesChanged(listener: MemoryListener): () => void {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

function emitChanged(roomId: string): void {
  for (const listener of listeners) listener(roomId)
}

export interface RelevantMemoryResult {
  memories: Memory[]
  usage?: TokenUsage
}

/**
 * Muse-style relevance filtering. The auxiliary model only sees memory IDs,
 * summaries and tags; full memory text is fetched afterwards for selected IDs.
 * This deliberately uses no local vector/embedding search.
 */
export async function selectRelevantMemories(input: {
  bot: Bot
  roomId: string
  roomBots: Bot[]
  request: string
  timeoutSecs: number
}): Promise<RelevantMemoryResult> {
  const sharedBotIds = input.roomBots
    .filter((bot) => bot.shareMemories)
    .map((bot) => bot.id)
  const candidates = await getMemoryCandidates(
    input.bot,
    input.roomId,
    sharedBotIds,
  )
  if (!candidates.length) return { memories: [] }

  const memoryList = candidates
    .map(
      (memory) =>
        `- id=${memory.id} | 摘要：${memory.summary.slice(0, 180)} | 标签：${
          memory.tags.join('、') || '无'
        } | 重要度：${memory.importance}`,
    )
    .join('\n')

  try {
    const result = await chatCompletion({
      model: FILTER_MODEL,
      messages: [
        {
          role: 'system',
          content:
            '你是 Muse 记忆检索器。根据当前用户需求，从候选记忆中选择真正相关、能辅助当前任务的记忆。只返回 JSON，格式为 {"ids":["记忆ID"]}。宁缺毋滥；最多选择 8 条；不得编造不存在的 ID；不要返回总结或解释。',
        },
        {
          role: 'user',
          content: `当前用户需求：\n${input.request.slice(0, 3000)}\n\n候选记忆（仅摘要、标签、ID）：\n${memoryList}`,
        },
      ],
      temperature: 0,
      maxTokens: 500,
      jsonMode: true,
      timeoutSecs: input.timeoutSecs,
      usageContext: {
        roomId: input.roomId,
        botId: input.bot.id,
        kind: 'memory_filter',
      },
    })

    await addUsage({
      roomId: input.roomId,
      botId: input.bot.id,
      model: result.model || FILTER_MODEL,
      usage: result.usage,
      kind: 'memory_filter',
    })

    const parsed = extractJson<{ ids?: unknown }>(result.content, {})
    const rawIds = Array.isArray(parsed.ids) ? parsed.ids : []
    const allowed = new Set(candidates.map((memory) => memory.id))
    const ids = [...new Set(rawIds.filter((id): id is string => typeof id === 'string'))]
      .filter((id) => allowed.has(id))
      .slice(0, 8)

    if (!ids.length) return { memories: [], usage: result.usage }
    const memories = await getMemoriesByIds(ids)
    // Preserve the model's ordering while dropping duplicates.
    const byId = new Map(memories.map((memory) => [memory.id, memory]))
    return {
      memories: ids.map((id) => byId.get(id)).filter((memory): memory is Memory => !!memory),
      usage: result.usage,
    }
  } catch (error) {
    // A memory-filter failure must not block the actual conversation.
    console.warn('[memory-filter] skipped:', error)
    return { memories: [] }
  }
}

interface ExtractionItem {
  action?: unknown
  id?: unknown
  summary?: unknown
  content?: unknown
  tags?: unknown
  importance?: unknown
  confidence?: unknown
}

const extractionTimers = new Map<string, ReturnType<typeof setTimeout>>()
const runningRooms = new Set<string>()
const dirtyRooms = new Set<string>()

/** Fire-and-forget extraction, debounced per room so a burst costs one call per bot. */
export function scheduleMemoryExtraction(roomId: string, delay = 1600): void {
  const existing = extractionTimers.get(roomId)
  if (existing) clearTimeout(existing)
  extractionTimers.set(
    roomId,
    setTimeout(() => {
      extractionTimers.delete(roomId)
      void runExtraction(roomId)
    }, delay),
  )
}

async function runExtraction(roomId: string): Promise<void> {
  if (runningRooms.has(roomId)) {
    dirtyRooms.add(roomId)
    return
  }
  runningRooms.add(roomId)
  try {
    do {
      dirtyRooms.delete(roomId)
      await extractOnce(roomId)
    } while (dirtyRooms.has(roomId))
  } catch (error) {
    console.warn('[memory-extract] failed:', error)
  } finally {
    runningRooms.delete(roomId)
    emitChanged(roomId)
  }
}

async function extractOnce(roomId: string): Promise<void> {
  const settings = await getAppSettings()
  if (!settings.autoMemoryGlobal) return

  const bots = (await getRoomBots(roomId)).filter((bot) => bot.autoMemory)
  if (!bots.length) return

  const messages = await listRecentMessages(roomId, 16)
  if (!messages.some((message) => message.senderType === 'bot')) return

  const botMap = new Map(bots.map((bot) => [bot.id, bot]))
  const contextBudget = Math.min(5200, Math.floor(settings.maxContextTokens * 0.45))
  const { text: transcript } = buildShortTermContext(messages, botMap, contextBudget)
  if (!transcript.trim()) return

  const userProfile = await getUserProfile()
  const timeoutSecs = Math.min(settings.defaultTimeoutSecs, 120)

  for (const bot of bots) {
    try {
      await extractForBot({ bot, roomId, transcript, userProfile, timeoutSecs })
    } catch (error) {
      console.warn(`[memory-extract] ${bot.name} failed:`, error)
    }
    await sleep(250)
  }

  emitChanged(roomId)
}

async function extractForBot(input: {
  bot: Bot
  roomId: string
  transcript: string
  userProfile: string
  timeoutSecs: number
}): Promise<void> {
  const existingAll = await listMemories(input.bot.id, 'all')
  const existing = existingAll.filter((memory) => memory.status !== 'archived').slice(0, 50)
  const existingPrompt = existing.length
    ? existing
        .map(
          (memory) =>
            `- id=${memory.id} | ${memory.summary} | 标签:${memory.tags.join('、') || '无'} | 重要度:${memory.importance}`,
        )
        .join('\n')
    : '（暂无）'

  const result = await chatCompletion({
    model: EXTRACT_MODEL,
    messages: [
      {
        role: 'system',
        content: [
          `你是「${input.bot.name}」的长期记忆整理器。请从对话中提取未来仍长期有效的信息：稳定偏好、项目规则、参数、约束、已确认共识、可复用结论。`,
          '过滤：寒暄客套、一次性临时问答、明显错误、重复内容、未确认的猜测、敏感密钥。',
          '若新信息与已有记忆语义重复，必须使用 action="update" 并给出已有记忆 id，合并成一条更准确的内容；否则 action="add"；不值得保存则返回空数组。',
          '只输出 JSON 对象：{"items":[{"action":"add|update|skip","id":"已有记忆ID或空","summary":"不超过60字的摘要","content":"精炼完整的记忆文本","tags":["标签"],"importance":1-5,"confidence":0-1}]}。',
          '每轮最多 5 条。用户档案中的长期偏好不必重复存入。confidence 低于 0.65 的条目会进入待审核。',
        ].join('\n'),
      },
      {
        role: 'user',
        content: `全局用户档案：\n${input.userProfile || '（空）'}\n\n已有记忆：\n${existingPrompt}\n\n最近对话：\n${input.transcript}`,
      },
    ],
    temperature: 0.1,
    maxTokens: 1600,
    jsonMode: true,
    timeoutSecs: input.timeoutSecs,
    usageContext: {
      roomId: input.roomId,
      botId: input.bot.id,
      kind: 'memory_extract',
    },
  })

  await addUsage({
    roomId: input.roomId,
    botId: input.bot.id,
    model: result.model || EXTRACT_MODEL,
    usage: result.usage,
    kind: 'memory_extract',
  })

  const parsed = extractJson<{ items?: unknown }>(result.content, {})
  const items = Array.isArray(parsed.items) ? (parsed.items as ExtractionItem[]) : []
  const updatableIds = new Set(
    existing.filter((memory) => memory.status === 'active').map((memory) => memory.id),
  )

  for (const item of items.slice(0, 5)) {
    const summary = typeof item.summary === 'string' ? item.summary.trim() : ''
    const content = typeof item.content === 'string' ? item.content.trim() : ''
    if (!summary || !content) continue
    const action = item.action === 'update' ? 'update' : item.action === 'skip' ? 'skip' : 'add'
    if (action === 'skip') continue

    const tags = Array.isArray(item.tags)
      ? item.tags.filter((tag): tag is string => typeof tag === 'string').slice(0, 5)
      : []
    const importance = Math.max(1, Math.min(5, Math.round(Number(item.importance) || 3)))
    const confidence = Math.max(0, Math.min(1, Number(item.confidence ?? 0.8)))
    const pending = confidence < 0.65
    const id = typeof item.id === 'string' ? item.id : ''

    if (action === 'update' && updatableIds.has(id) && !pending) {
      await updateMemory(id, {
        summary: summary.slice(0, 120),
        content,
        tags,
        importance,
        confidence,
        status: 'active',
      })
      continue
    }

    if (pending) {
      await createMemory({
        botId: input.bot.id,
        roomId: input.roomId,
        summary: summary.slice(0, 120),
        content,
        tags,
        importance,
        confidence,
        status: 'pending',
        source: 'auto',
      })
      continue
    }

    // Local exact-summary de-duplication is a safety net, not vector search.
    const normalized = content.replace(/\s+/g, '')
    const duplicate = existing.find(
      (memory) =>
        memory.status === 'active' &&
        (memory.summary.replace(/\s+/g, '') === summary.replace(/\s+/g, '') ||
          memory.content.replace(/\s+/g, '') === normalized),
    )
    if (duplicate) {
      await updateMemory(duplicate.id, {
        summary: summary.slice(0, 120),
        content,
        tags: [...new Set([...duplicate.tags, ...tags])].slice(0, 6),
        importance: Math.max(duplicate.importance, importance),
        confidence,
        status: 'active',
      })
      continue
    }

    const limit = Math.max(5, input.bot.memoryLimit)
    const activeCount = await countMemories(input.bot.id, 'active')
    if (activeCount >= limit) {
      const evict = await pickEvictableMemories(input.bot.id, limit, importance)
      if (!evict.length) continue
      await setMemoryStatus(evict, 'archived')
    }

    await createMemory({
      botId: input.bot.id,
      roomId: input.roomId,
      summary: summary.slice(0, 120),
      content,
      tags,
      importance,
      confidence,
      status: 'active',
      source: 'auto',
    })
  }
}

/** Debug/helper used by tests and the memory panel's "recent context" preview. */
export function estimateMemoryTokens(memory: Memory): number {
  return estimateTokens(memory.content) + estimateTokens(memory.summary)
}

export function contextPreview(message: Message, botMap: Map<string, Bot>): string {
  return formatContextMessage(message, botMap)
}
