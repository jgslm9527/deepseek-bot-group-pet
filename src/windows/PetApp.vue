<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { AnimatePresence, motion } from 'motion-v'
import { listen, type UnlistenFn } from '@tauri-apps/api/event'
import { AlertTriangle, MousePointerClick, VolumeX } from 'lucide-vue-next'
import type { PetNotification } from '@/types'
import PetRobot from '@/components/pet/PetRobot.vue'
import {
  isTauriRuntime,
  openMainWindow,
  rememberPetPosition,
  showPetMenu,
  startPetDrag,
  updatePetHitTest,
} from '@/lib/tauri'

type PetMode = 'idle' | 'thinking' | 'new-message' | 'error' | 'muted'

const mode = ref<PetMode>('idle')
const bubbleText = ref('')
const bubbleName = ref('')
const bubbleAccent = ref('#22D3EE')
const bubbleVisible = ref(false)
const hovered = ref(false)
const dragging = ref(false)
const bounceTick = ref(0)
const root = ref<HTMLElement | null>(null)
let unlisteners: UnlistenFn[] = []
let bubbleTimer: ReturnType<typeof setTimeout> | null = null
let modeTimer: ReturnType<typeof setTimeout> | null = null
let hitTimer: ReturnType<typeof setInterval> | null = null
let pointerStart: { x: number; y: number; id: number } | null = null
let dragTriggered = false
let hitPaused = false

const zone = { cx: 60, cy: 68, rx: 38, ry: 47 }
const modeLabel = computed(() => {
  if (mode.value === 'thinking') return '思考中'
  if (mode.value === 'new-message') return '新消息'
  if (mode.value === 'error') return '连接异常'
  if (mode.value === 'muted') return '已静音'
  return '待命'
})

function clearTimers() {
  if (bubbleTimer) clearTimeout(bubbleTimer)
  if (modeTimer) clearTimeout(modeTimer)
  bubbleTimer = null
  modeTimer = null
}

function showBubble(name: string, text: string, accent: string, timeout = 5200) {
  bubbleName.value = name
  bubbleText.value = text
  bubbleAccent.value = accent
  bubbleVisible.value = true
  if (bubbleTimer) clearTimeout(bubbleTimer)
  bubbleTimer = setTimeout(() => {
    bubbleVisible.value = false
    if (mode.value === 'new-message' || mode.value === 'muted' || mode.value === 'error') mode.value = 'idle'
  }, timeout)
}

function handleNotification(payload: PetNotification) {
  if (modeTimer) clearTimeout(modeTimer)
  switch (payload.mode) {
    case 'thinking':
      mode.value = 'thinking'
      break
    case 'new-message':
      mode.value = 'new-message'
      bounceTick.value += 1
      showBubble(payload.botName || 'Bot', payload.text || '发来一条新消息', payload.accent || '#22D3EE')
      break
    case 'error':
      mode.value = 'error'
      showBubble('连接异常', payload.text || 'DeepSeek 请求失败', '#FB7185', 7000)
      break
    case 'muted':
      mode.value = 'muted'
      showBubble('已静音', payload.text || '全部 Bot 已静音', '#94A3B8', 3600)
      break
    case 'idle':
      if (!['new-message', 'error', 'muted'].includes(mode.value)) mode.value = 'idle'
      modeTimer = setTimeout(() => {
        if (mode.value === 'thinking') mode.value = 'idle'
      }, 500)
      break
  }
}

async function pollHitTest() {
  if (!isTauriRuntime() || dragging.value || hitPaused) return
  try {
    hovered.value = await updatePetHitTest(zone)
  } catch {
    // The helper window must never become unusable because a probe failed.
    hovered.value = true
  }
}

function onPointerDown(event: PointerEvent) {
  if (event.button !== 0) return
  pointerStart = { x: event.screenX, y: event.screenY, id: event.pointerId }
  dragTriggered = false
  try {
    root.value?.setPointerCapture(event.pointerId)
  } catch {
    // ignore
  }
}

async function onPointerMove(event: PointerEvent) {
  if (!pointerStart || dragTriggered || dragging.value) return
  const dx = event.screenX - pointerStart.x
  const dy = event.screenY - pointerStart.y
  if (Math.hypot(dx, dy) < 5) return
  dragTriggered = true
  dragging.value = true
  hitPaused = true
  try {
    await startPetDrag()
  } catch {
    // If native dragging is unavailable, do not wedge hit-testing.
    dragging.value = false
    hitPaused = false
  }
  setTimeout(() => {
    dragging.value = false
    hitPaused = false
    void rememberPetPosition()
    void pollHitTest()
  }, 2200)
}

async function onPointerUp(event: PointerEvent) {
  if (!pointerStart) return
  try {
    root.value?.releasePointerCapture(event.pointerId)
  } catch {
    // ignore
  }
  const moved = dragTriggered || dragging.value
  pointerStart = null
  if (moved) {
    setTimeout(() => void rememberPetPosition(), 500)
  } else {
    hovered.value = true
    await openMainWindow()
  }
}

function onPointerCancel() {
  pointerStart = null
  dragTriggered = false
  dragging.value = false
  hitPaused = false
}

/** Built-in Tauri drag region on the small feet handle: reliable native drag. */
function onHandlePointerDown() {
  dragTriggered = true
  dragging.value = true
  hitPaused = true
  const remember = () => {
    void rememberPetPosition()
    void pollHitTest()
  }
  setTimeout(remember, 700)
  setTimeout(remember, 1800)
  setTimeout(() => {
    dragging.value = false
    hitPaused = false
    remember()
  }, 3000)
}

async function onContextMenu() {
  if (!isTauriRuntime()) return
  try {
    await showPetMenu()
  } catch {
    // ignore
  }
}

async function setupListeners() {
  if (!isTauriRuntime()) {
    hovered.value = true
    return
  }
  unlisteners.push(
    await listen<PetNotification>('pet://notification', (event) => handleNotification(event.payload)),
  )
  unlisteners.push(
    await listen<{ action: string }>('pet://menu', (event) => {
      if (event.payload.action === 'mute-all') {
        mode.value = 'muted'
        showBubble('已静音', '全部 Bot 已静音', '#94A3B8', 3600)
      }
    }),
  )
}

const bounceKey = computed(() => `${mode.value}-${bounceTick.value}`)

onMounted(async () => {
  await setupListeners()
  await pollHitTest()
  hitTimer = setInterval(() => void pollHitTest(), 160)
})

onBeforeUnmount(() => {
  clearTimers()
  if (hitTimer) clearInterval(hitTimer)
  for (const unlisten of unlisteners) unlisten()
  unlisteners = []
})
</script>

<template>
  <div
    ref="root"
    class="pet-root"
    :class="{ hovered, dragging, 'has-bubble': bubbleVisible }"
    :data-mode="mode"
    @pointerdown="onPointerDown"
    @pointermove="onPointerMove"
    @pointerup="onPointerUp"
    @pointercancel="onPointerCancel"
    @contextmenu.prevent="onContextMenu"
  >
    <AnimatePresence>
      <motion.div
        v-if="bubbleVisible"
        class="pet-bubble"
        :style="{ borderColor: `color-mix(in srgb, ${bubbleAccent} 55%, transparent)` }"
        :initial="{ opacity: 0, y: -6, scale: 0.92 }"
        :animate="{ opacity: 1, y: 0, scale: 1 }"
        :exit="{ opacity: 0, y: -4, scale: 0.95 }"
        :transition="{ type: 'spring', stiffness: 430, damping: 30 }"
      >
        <div class="pet-bubble-head">
          <span class="pet-bubble-dot" :style="{ background: bubbleAccent }" />
          <span class="pet-bubble-name">{{ bubbleName }}</span>
          <VolumeX v-if="mode === 'muted'" :size="9" />
          <AlertTriangle v-else-if="mode === 'error'" :size="9" class="text-[#FB7185]" />
        </div>
        <p class="pet-bubble-text">{{ bubbleText }}</p>
      </motion.div>
    </AnimatePresence>

    <div class="pet-breathe">
      <motion.div
        :key="bounceKey"
        class="pet-bounce"
        :initial="{ scale: 1, y: 0 }"
        :animate="
          mode === 'new-message'
            ? { scale: [1, 1.07, 0.98, 1.02, 1], y: [0, -11, 0, -3, 0] }
            : { scale: 1, y: 0 }
        "
        :transition="
          mode === 'new-message'
            ? { duration: 0.75, ease: [0.22, 1, 0.36, 1] }
            : { duration: 0.25 }
        "
      >
        <PetRobot :mode="mode" :hovered="hovered" />
      </motion.div>
    </div>

    <div
      class="pet-drag-handle"
      data-tauri-drag-region
      title="拖动桌宠"
      @pointerdown="onHandlePointerDown"
    >
      <i /><i /><i />
    </div>

    <transition name="pet-tip">
      <div v-if="hovered && !bubbleVisible && !dragging" class="pet-tip">
        <MousePointerClick :size="9" />
        点击进入 · 底部拖动
      </div>
    </transition>

    <span class="pet-state" :data-mode="mode" :title="modeLabel" />
  </div>
</template>

<style scoped>
.pet-root {
  position: relative;
  width: 120px;
  height: 120px;
  display: flex;
  align-items: flex-end;
  justify-content: center;
  cursor: grab;
  user-select: none;
  -webkit-user-select: none;
  touch-action: none;
  background: transparent;
}
.pet-root.dragging {
  cursor: grabbing;
}
.pet-root::after {
  content: '';
  position: absolute;
  inset: 12px 12px 4px;
  border-radius: 40px;
  background: radial-gradient(circle, rgba(34, 211, 238, 0.16), transparent 66%);
  opacity: 0;
  transition: opacity 180ms ease;
  pointer-events: none;
}
.pet-root.hovered::after {
  opacity: 1;
}
.pet-breathe {
  width: 120px;
  height: 120px;
  display: flex;
  align-items: flex-end;
  justify-content: center;
  transform-origin: 50% 88%;
  animation: pet-idle-breathe 4.2s ease-in-out infinite;
}
.pet-root[data-mode="thinking"] .pet-breathe {
  animation: pet-think-breathe 1.5s ease-in-out infinite;
}
@keyframes pet-idle-breathe {
  0%, 100% { transform: translateY(0) rotate(0deg); }
  50% { transform: translateY(-2.2px) rotate(0.35deg); }
}
@keyframes pet-think-breathe {
  0%, 100% { transform: translateY(0) rotate(0deg); }
  50% { transform: translateY(-1.4px) rotate(0.2deg); }
}
.pet-bounce {
  width: 120px;
  height: 120px;
}
.pet-root.hovered .pet-bounce {
  filter: drop-shadow(0 0 14px rgba(56, 232, 255, 0.24));
}
.pet-bubble {
  position: absolute;
  z-index: 10;
  top: 0;
  left: 3px;
  right: 3px;
  padding: 5px 7px 6px;
  border-radius: 9px;
  border: 1px solid;
  background: rgba(8, 15, 34, 0.9);
  backdrop-filter: blur(14px) saturate(150%);
  color: #e9f8ff;
  box-shadow: 0 8px 24px rgba(0, 8, 26, 0.4);
  pointer-events: none;
  transform-origin: 50% 100%;
}
.pet-bubble-head {
  display: flex;
  align-items: center;
  gap: 4px;
  font-size: 8px;
  color: #9fe8ff;
  letter-spacing: 0.01em;
}
.pet-bubble-dot {
  width: 4px;
  height: 4px;
  border-radius: 999px;
  box-shadow: 0 0 6px currentColor;
}
.pet-bubble-name {
  flex: 1;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-weight: 600;
}
.pet-bubble-text {
  margin: 2px 0 0;
  font-size: 9px;
  line-height: 1.38;
  color: #d8e7f8;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
  word-break: break-word;
}
.pet-tip {
  position: absolute;
  bottom: 16px;
  left: 50%;
  transform: translateX(-50%);
  display: flex;
  align-items: center;
  gap: 3px;
  white-space: nowrap;
  font-size: 7.5px;
  color: rgba(219, 244, 255, 0.8);
  background: rgba(7, 15, 32, 0.76);
  border: 1px solid rgba(91, 199, 255, 0.16);
  border-radius: 999px;
  padding: 2px 6px;
  pointer-events: none;
  backdrop-filter: blur(8px);
}
.pet-drag-handle {
  position: absolute;
  left: 50%;
  bottom: 3px;
  transform: translateX(-50%);
  width: 42px;
  height: 11px;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 3px;
  border-radius: 999px;
  opacity: 0;
  transition: opacity 160ms ease, background 160ms ease;
  cursor: grab;
  z-index: 5;
}
.pet-root:hover .pet-drag-handle {
  opacity: 0.75;
  background: rgba(8, 20, 42, 0.48);
}
.pet-drag-handle i {
  width: 2.5px;
  height: 2.5px;
  border-radius: 999px;
  background: #8fe9ff;
  box-shadow: 0 0 4px rgba(72, 224, 255, 0.7);
}
.pet-drag-handle:active {
  cursor: grabbing;
}
.pet-state {
  position: absolute;
  right: 28px;
  bottom: 16px;
  width: 5px;
  height: 5px;
  border-radius: 999px;
  background: #45e6ff;
  box-shadow: 0 0 7px #45e6ff;
  pointer-events: none;
  opacity: 0.9;
}
.pet-state[data-mode="thinking"] {
  animation: pet-state-pulse 0.9s ease-in-out infinite;
}
.pet-state[data-mode="new-message"] {
  background: #a78bfa;
  box-shadow: 0 0 8px #a78bfa;
}
.pet-state[data-mode="error"] {
  background: #fb7185;
  box-shadow: 0 0 8px #fb7185;
}
.pet-state[data-mode="muted"] {
  background: #94a3b8;
  box-shadow: none;
}
@keyframes pet-state-pulse {
  0%, 100% { opacity: 0.3; transform: scale(0.8); }
  50% { opacity: 1; transform: scale(1.2); }
}
.pet-tip-enter-active,
.pet-tip-leave-active {
  transition: opacity 140ms ease, transform 140ms ease;
}
.pet-tip-enter-from,
.pet-tip-leave-to {
  opacity: 0;
  transform: translate(-50%, 3px);
}
@media (prefers-reduced-motion: reduce) {
  .pet-breathe,
  .pet-bounce {
    animation: none !important;
  }
}
</style>
