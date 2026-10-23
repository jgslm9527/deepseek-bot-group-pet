<script setup lang="ts">
import { computed, nextTick, onMounted, ref, watch } from 'vue'
import { AtSign, CornerDownLeft, FileText, LoaderCircle, Send, Square, X } from 'lucide-vue-next'
import { useChatStore } from '@/stores/chat'
import { useSettingsStore } from '@/stores/settings'
import { useUiStore } from '@/stores/ui'
import { ATTACHMENT_ACCEPT, MAX_ATTACHMENTS, formatBytes, readAttachment } from '@/lib/files'
import { findMentionedBots } from '@/lib/mentions'
import { MODEL_LABELS, ROLE_META } from '@/lib/constants'
import BotAvatar from '@/components/bots/BotAvatar.vue'

const chat = useChatStore()
const settings = useSettingsStore()
const ui = useUiStore()
const textarea = ref<HTMLTextAreaElement | null>(null)
const fileInput = ref<HTMLInputElement | null>(null)
const mentionOpen = ref(false)
const mentionQuery = ref('')
const mentionIndex = ref(0)
const dragOver = ref(false)

const disabled = computed(() => !chat.activeRoom || chat.isGenerating || chat.isSending)
const canSend = computed(
  () => !disabled.value && (!!chat.draft.trim() || chat.attachments.length > 0),
)
const placeholder = computed(() => {
  if (!chat.activeRoom) return '选择一个会话开始'
  if (chat.isGenerating) return 'Bot 正在讨论或生成中… 可点击上方停止'
  if (chat.activeRoom.kind === 'group' && !chat.activeRoom.autoPoll) {
    return '自动轮询已关闭，输入 @Bot 名称 触发回复'
  }
  return '输入需求，Enter 发送，Shift + Enter 换行'
})
const suggestions = computed(() => {
  const query = mentionQuery.value.trim().toLowerCase()
  return chat.activeBots
    .filter((bot) => !bot.muted)
    .filter((bot) => !query || bot.name.toLowerCase().includes(query))
})

function autoResize() {
  const el = textarea.value
  if (!el) return
  el.style.height = '0px'
  el.style.height = `${Math.min(122, Math.max(36, el.scrollHeight))}px`
}

function insertMention(name: string) {
  const el = textarea.value
  const current = chat.draft
  if (!el) {
    chat.draft = `${current}@${name} `
    return
  }
  const start = el.selectionStart ?? current.length
  const before = current.slice(0, start)
  const match = before.match(/@([^\s@]*)$/)
  const replaceStart = match ? start - match[0].length : start
  chat.draft = `${current.slice(0, replaceStart)}@${name} ${current.slice(start)}`
  mentionOpen.value = false
  mentionQuery.value = ''
  nextTick(() => {
    el.focus()
    const position = replaceStart + name.length + 2
    el.setSelectionRange(position, position)
    autoResize()
  })
}

function handleInput(event: Event) {
  const el = event.target as HTMLTextAreaElement
  const before = el.value.slice(0, el.selectionStart ?? el.value.length)
  const match = before.match(/@([^\s@]*)$/)
  if (match && chat.activeRoom?.kind === 'group') {
    mentionQuery.value = match[1]
    mentionOpen.value = true
    mentionIndex.value = 0
  } else {
    mentionOpen.value = false
  }
  autoResize()
}

function onKeydown(event: KeyboardEvent) {
  if (event.isComposing) return
  if (mentionOpen.value && suggestions.value.length) {
    if (event.key === 'ArrowDown') {
      event.preventDefault()
      mentionIndex.value = (mentionIndex.value + 1) % suggestions.value.length
      return
    }
    if (event.key === 'ArrowUp') {
      event.preventDefault()
      mentionIndex.value = (mentionIndex.value - 1 + suggestions.value.length) % suggestions.value.length
      return
    }
    if (event.key === 'Enter' || event.key === 'Tab') {
      event.preventDefault()
      insertMention(suggestions.value[mentionIndex.value].name)
      return
    }
    if (event.key === 'Escape') {
      mentionOpen.value = false
      return
    }
  }
  if (event.key === 'Enter' && !event.shiftKey) {
    event.preventDefault()
    void submit()
  }
}

async function submit() {
  if (!canSend.value) return
  mentionOpen.value = false
  await chat.sendMessage(chat.draft, chat.attachments)
  await nextTick()
  autoResize()
  textarea.value?.focus()
}

function openMention() {
  if (!chat.activeRoom || chat.activeRoom.kind !== 'group') return
  mentionQuery.value = ''
  mentionIndex.value = 0
  mentionOpen.value = !mentionOpen.value
  if (mentionOpen.value) {
    nextTick(() => {
      const el = textarea.value
      if (!el) return
      const at = el.selectionStart ?? el.value.length
      const before = el.value.slice(0, at)
      if (!/@[^\s@]*$/.test(before) && !before.endsWith(' ')) {
        chat.draft = `${el.value}@`
        nextTick(() => {
          el.focus()
          el.setSelectionRange(chat.draft.length, chat.draft.length)
        })
      } else if (!before.includes('@') || before.endsWith(' ')) {
        chat.draft = `${el.value}@`
        nextTick(() => {
          el.focus()
          el.setSelectionRange(chat.draft.length, chat.draft.length)
        })
      }
    })
  }
}

async function addFiles(files: FileList | File[]) {
  const list = Array.from(files)
  for (const file of list) {
    if (chat.attachments.length >= MAX_ATTACHMENTS) {
      ui.toast('最多添加 3 个文件', undefined, 'error')
      break
    }
    try {
      const attachment = await readAttachment(file)
      chat.addAttachments([attachment])
    } catch (error) {
      ui.toast('无法添加文件', error instanceof Error ? error.message : String(error), 'error')
    }
  }
  if (fileInput.value) fileInput.value.value = ''
}

function onFileChange(event: Event) {
  const input = event.target as HTMLInputElement
  if (input.files) void addFiles(input.files)
}

function onDrop(event: DragEvent) {
  dragOver.value = false
  if (event.dataTransfer?.files?.length) void addFiles(event.dataTransfer.files)
}

function stop() {
  void chat.stopGeneration()
}

watch(
  () => chat.draft,
  () => nextTick(autoResize),
)
watch(
  () => chat.activeRoomId,
  () => {
    mentionOpen.value = false
    nextTick(autoResize)
  },
)
onMounted(autoResize)
</script>

<template>
  <div class="composer-zone">
    <div class="relative mx-auto w-full max-w-[760px]">
      <div v-if="mentionOpen" class="mention-menu mention-popover">
        <div class="px-2 pb-1 pt-1 text-[9px] font-semibold uppercase tracking-widest text-[var(--text-3)]">
          提醒 Bot 回复
        </div>
        <button
          v-for="(bot, index) in suggestions"
          :key="bot.id"
          class="mention-item"
          :class="{ 'bg-[var(--hover)]': index === mentionIndex }"
          @mousedown.prevent="insertMention(bot.name)"
        >
          <BotAvatar :bot="bot" :size="24" />
          <span class="min-w-0 flex-1">
            <span class="mention-name block truncate">{{ bot.name }}</span>
            <span class="mention-role">{{ ROLE_META[bot.role].label }} · {{ MODEL_LABELS[bot.model] }}</span>
          </span>
        </button>
        <div v-if="!suggestions.length" class="px-2 py-3 text-center text-[10px] text-[var(--text-3)]">
          没有可提醒的 Bot
        </div>
      </div>

      <div
        class="composer-card"
        :class="dragOver ? 'drop-active' : ''"
        @dragover.prevent="dragOver = true"
        @dragleave="dragOver = false"
        @drop.prevent="onDrop"
      >
        <div v-if="chat.attachments.length" class="composer-attachments">
          <span v-for="file in chat.attachments" :key="file.id" class="attachment-chip">
            <FileText :size="11" class="shrink-0 text-[var(--text-3)]" />
            <span>{{ file.name }}</span>
            <span class="shrink-0 opacity-50">{{ formatBytes(file.size) }}</span>
            <button
              class="ml-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded text-[var(--text-3)] hover:bg-[var(--hover)]"
              aria-label="移除附件"
              @click="chat.removeAttachment(file.id)"
            >
              <X :size="9" />
            </button>
          </span>
        </div>
        <div class="composer-input-row">
          <textarea
            ref="textarea"
            v-model="chat.draft"
            data-composer-input
            class="composer-input"
            rows="1"
            maxlength="20000"
            :placeholder="placeholder"
            :disabled="disabled"
            @keydown="onKeydown"
            @input="handleInput"
          />
          <div class="composer-actions">
            <button
              class="icon-btn"
              title="提醒某个 Bot"
              :disabled="disabled || chat.activeRoom?.kind !== 'group'"
              @click="openMention"
            >
              <AtSign :size="15" :stroke-width="1.9" />
            </button>
            <button class="icon-btn" title="上传文本 / 代码文件" :disabled="disabled" @click="fileInput?.click()">
              <FileText :size="15" :stroke-width="1.9" />
            </button>
            <input
              ref="fileInput"
              type="file"
              multiple
              class="hidden"
              :accept="ATTACHMENT_ACCEPT"
              @change="onFileChange"
            />
            <button
              v-if="chat.isActiveRoomRunning"
              class="send-btn !bg-[var(--danger)]"
              title="停止生成"
              aria-label="停止生成"
              @click="stop"
            >
              <Square :size="12" fill="currentColor" />
            </button>
            <button
              v-else
              class="send-btn"
              :disabled="!canSend"
              title="发送"
              aria-label="发送"
              @click="submit"
            >
              <LoaderCircle v-if="chat.isSending" :size="14" class="animate-spin" />
              <Send v-else :size="14" :stroke-width="2.1" />
            </button>
          </div>
        </div>
      </div>
    </div>
    <div class="composer-footnote">
      <span class="inline-flex items-center gap-1">
        <CornerDownLeft :size="9" />
        Enter 发送 · Shift + Enter 换行
      </span>
      <span class="inline-flex items-center gap-1">
        <span class="h-1 w-1 rounded-full" :style="{ background: settings.hasApiKey ? 'var(--success)' : 'var(--warning)' }" />
        {{ settings.hasApiKey ? '本地存储 · 仅对话时联网' : '尚未配置 API Key' }}
      </span>
    </div>
  </div>
</template>

<style scoped>
.composer-card.drop-active {
  border-color: var(--accent);
  background: var(--accent-faint);
  box-shadow: 0 0 0 3px var(--accent-soft);
}
</style>
