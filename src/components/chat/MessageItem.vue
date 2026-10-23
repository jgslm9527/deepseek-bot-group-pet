<script setup lang="ts">
import { computed } from 'vue'
import { Check, Copy, TriangleAlert } from 'lucide-vue-next'
import type { Message } from '@/types'
import { useChatStore } from '@/stores/chat'
import { MODEL_LABELS } from '@/lib/constants'
import { formatClock } from '@/lib/time'
import BotAvatar from '@/components/bots/BotAvatar.vue'
import UserAvatar from './UserAvatar.vue'
import MarkdownRenderer from './MarkdownRenderer.vue'

const props = defineProps<{ message: Message; copiedId: string | null }>()
const emit = defineEmits<{ (event: 'copy', message: Message): void }>()
const chat = useChatStore()
const bot = computed(() => chat.botForMessage(props.message))
const isError = computed(() => props.message.meta?.kind === 'error')
const copied = computed(() => props.copiedId === props.message.id)
const botBubbleStyle = computed(() => {
  if (!bot.value) return {}
  return {
    background: `color-mix(in srgb, ${bot.value.accent} 7%, var(--bot-bubble))`,
    borderColor: `color-mix(in srgb, ${bot.value.accent} 17%, var(--border))`,
  }
})
const botNameStyle = computed(() => {
  if (!bot.value) return {}
  return { color: `color-mix(in srgb, ${bot.value.accent} 68%, var(--text-2))` }
})
</script>

<template>
  <div v-if="message.senderType === 'system'" class="system-message">
    <div class="system-message-inner" :class="{ error: isError }">
      <span class="inline-flex items-start gap-1.5">
        <TriangleAlert v-if="isError" :size="11" class="mt-[2px] shrink-0" />
        <span>{{ message.content }}</span>
      </span>
    </div>
  </div>

  <div v-else class="message-row" :class="message.senderType">
    <div class="message-avatar">
      <UserAvatar v-if="message.senderType === 'user'" :size="32" />
      <BotAvatar v-else-if="bot" :bot="bot" :size="32" :muted="bot.muted" />
      <span
        v-else
        class="flex h-8 w-8 items-center justify-center rounded-[10px] bg-[var(--surface-3)] text-[11px] text-[var(--text-3)]"
      >?</span>
    </div>

    <div class="message-body">
      <div v-if="message.senderType === 'bot'" class="message-meta">
        <span class="bot-name" :style="botNameStyle">{{ bot?.name || message.meta?.botName || 'Bot' }}</span>
        <span v-if="bot" class="model-chip">{{ MODEL_LABELS[bot.model] }}</span>
        <span v-if="message.meta?.stage" class="model-chip">{{ message.meta.stage }}</span>
      </div>

      <div
        class="bubble"
        :class="message.senderType === 'user' ? 'user' : 'bot'"
        :style="message.senderType === 'bot' ? botBubbleStyle : undefined"
      >
        <MarkdownRenderer :content="message.content" />
        <div v-if="message.attachments.length" class="bubble-attachments">
          <span v-for="file in message.attachments" :key="file.id" class="bubble-attachment">
            <span class="truncate">{{ file.name }}</span>
            <span class="opacity-55">{{ Math.max(1, Math.round(file.size / 1024)) }} KB</span>
          </span>
        </div>
      </div>

      <div class="bubble-footer">
        <span class="bubble-time">{{ formatClock(message.createdAt) }}</span>
        <button
          class="copy-reply"
          :title="copied ? '已复制' : '复制内容'"
          @click="emit('copy', message)"
        >
          <span class="inline-flex items-center gap-1">
            <Check v-if="copied" :size="9" />
            <Copy v-else :size="9" />
            {{ copied ? '已复制' : '复制' }}
          </span>
        </button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.bubble-attachments {
  display: flex;
  flex-wrap: wrap;
  gap: 5px;
  margin-top: 7px;
}
.bubble-attachment {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  max-width: 240px;
  font-size: 10px;
  border-radius: 6px;
  padding: 3px 6px;
  background: color-mix(in srgb, var(--text-3) 9%, transparent);
  border: 1px solid color-mix(in srgb, var(--text-3) 10%, transparent);
  color: var(--text-2);
}
</style>
