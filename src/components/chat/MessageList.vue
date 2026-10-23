<script setup lang="ts">
import { computed, nextTick, onMounted, ref, watch } from 'vue'
import { AnimatePresence, motion } from 'motion-v'
import { ArrowDown } from 'lucide-vue-next'
import type { Message } from '@/types'
import { useChatStore } from '@/stores/chat'
import { useUiStore } from '@/stores/ui'
import { isSameDay } from '@/lib/time'
import MessageItem from './MessageItem.vue'
import TypingIndicator from './TypingIndicator.vue'
import ChatEmpty from './ChatEmpty.vue'
import RoomStarter from './RoomStarter.vue'

const chat = useChatStore()
const ui = useUiStore()
const scroller = ref<HTMLElement | null>(null)
const atBottom = ref(true)
const followLatest = ref(true)
const copiedId = ref<string | null>(null)
let copyTimer: ReturnType<typeof setTimeout> | null = null

function isNearBottom(): boolean {
  const el = scroller.value
  if (!el) return true
  return el.scrollHeight - el.scrollTop - el.clientHeight < 140
}

function scrollToBottom(behavior: ScrollBehavior = 'auto') {
  const el = scroller.value
  if (!el) return
  el.scrollTo({ top: el.scrollHeight, behavior })
  atBottom.value = true
  followLatest.value = true
}

function onScroll() {
  atBottom.value = isNearBottom()
  followLatest.value = atBottom.value
}

function showDay(index: number): boolean {
  if (index === 0) return true
  return !isSameDay(chat.messages[index].createdAt, chat.messages[index - 1].createdAt)
}

function dayLabel(iso: string): string {
  const date = new Date(iso)
  const today = new Date()
  const yesterday = new Date()
  yesterday.setDate(today.getDate() - 1)
  if (date.toDateString() === today.toDateString()) return '今天'
  if (date.toDateString() === yesterday.toDateString()) return '昨天'
  return new Intl.DateTimeFormat('zh-CN', { month: 'long', day: 'numeric', weekday: 'short' }).format(date)
}

async function copyMessage(message: Message) {
  try {
    await navigator.clipboard.writeText(message.content)
    copiedId.value = message.id
    if (copyTimer) clearTimeout(copyTimer)
    copyTimer = setTimeout(() => (copiedId.value = null), 1500)
  } catch {
    ui.toast('复制失败', '系统剪贴板不可用。', 'error')
  }
}

watch(
  () => chat.messages.at(-1)?.id,
  async () => {
    const last = chat.messages.at(-1)
    if (last?.senderType === 'user') followLatest.value = true
    await nextTick()
    if (followLatest.value) scrollToBottom('auto')
  },
  { flush: 'post' },
)

watch(
  () => chat.typingForActive.length,
  async () => {
    await nextTick()
    if (followLatest.value) scrollToBottom('auto')
  },
  { flush: 'post' },
)

watch(
  () => chat.activeRoomId,
  async () => {
    followLatest.value = true
    await nextTick()
    requestAnimationFrame(() => scrollToBottom('auto'))
  },
)

watch(
  () => chat.loadingRoom,
  async (loading) => {
    if (loading) return
    followLatest.value = true
    await nextTick()
    requestAnimationFrame(() => scrollToBottom('auto'))
  },
  { flush: 'post' },
)

onMounted(() => {
  requestAnimationFrame(() => scrollToBottom('auto'))
})

const hasConversation = computed(() =>
  chat.messages.some((message) => message.senderType !== 'system'),
)
</script>

<template>
  <div class="relative flex min-h-0 flex-1 flex-col overflow-hidden">
    <div ref="scroller" class="chat-scroll" @scroll.passive="onScroll">
      <div v-if="chat.loadingRoom" class="chat-inner space-y-5 py-6">
        <div v-for="n in 3" :key="n" class="flex items-start gap-3 opacity-35">
          <div class="h-8 w-8 rounded-[10px] bg-[var(--surface-3)]" />
          <div class="flex-1 space-y-2">
            <div class="h-2.5 w-24 rounded-full bg-[var(--surface-3)]" />
            <div class="h-14 w-2/3 rounded-[10px] bg-[var(--surface-3)]" />
          </div>
        </div>
      </div>

      <div v-else-if="!chat.messages.length" class="h-full">
        <ChatEmpty />
      </div>

      <div v-else class="chat-inner">
        <template v-for="(message, index) in chat.messages" :key="message.id">
          <div v-if="showDay(index)" class="day-divider">
            <span>{{ dayLabel(message.createdAt) }}</span>
          </div>
          <AnimatePresence :initial="false">
            <motion.div
              :key="message.id"
              :initial="{ opacity: 0, y: 9 }"
              :animate="{ opacity: 1, y: 0 }"
              :transition="{ duration: 0.24, ease: [0.16, 1, 0.3, 1] }"
            >
              <MessageItem :message="message" :copied-id="copiedId" @copy="copyMessage" />
            </motion.div>
          </AnimatePresence>
        </template>

        <AnimatePresence>
          <motion.div
            v-for="item in chat.typingForActive"
            :key="`${item.roomId}-${item.botId}`"
            :initial="{ opacity: 0, y: 8 }"
            :animate="{ opacity: 1, y: 0 }"
            :exit="{ opacity: 0, y: -4 }"
            :transition="{ duration: 0.2 }"
          >
            <TypingIndicator
              v-if="chat.botMap.get(item.botId)"
              :bot="chat.botMap.get(item.botId)!"
              :label="item.label"
            />
          </motion.div>
        </AnimatePresence>

        <RoomStarter v-if="!hasConversation" />
      </div>
    </div>

    <transition name="fade">
      <button
        v-if="!atBottom && chat.messages.length"
        class="scroll-latest"
        aria-label="回到最新消息"
        @click="scrollToBottom('smooth')"
      >
        <ArrowDown :size="14" />
      </button>
    </transition>
  </div>
</template>

<style scoped>
.scroll-latest {
  position: absolute;
  right: 22px;
  bottom: 12px;
  width: 30px;
  height: 30px;
  border-radius: 999px;
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--text-2);
  background: color-mix(in srgb, var(--surface) 92%, transparent);
  border: 1px solid var(--border-strong);
  box-shadow: var(--shadow-sm);
  backdrop-filter: blur(12px);
  transition: transform 140ms ease, background 140ms ease;
}
.scroll-latest:hover {
  background: var(--surface);
  transform: translateY(-1px);
}
.fade-enter-active,
.fade-leave-active {
  transition: opacity 140ms ease;
}
.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}
</style>
