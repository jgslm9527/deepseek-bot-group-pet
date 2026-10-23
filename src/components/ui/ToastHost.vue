<script setup lang="ts">
import { AnimatePresence, motion } from 'motion-v'
import { AlertCircle, CheckCircle2, Info, X } from 'lucide-vue-next'
import { useUiStore } from '@/stores/ui'

const ui = useUiStore()

function toneIcon(tone: string) {
  if (tone === 'success') return CheckCircle2
  if (tone === 'error') return AlertCircle
  return Info
}
</script>

<template>
  <div class="toast-host">
    <AnimatePresence>
      <motion.div
        v-for="toast in ui.toasts"
        :key="toast.id"
        layout
        :initial="{ opacity: 0, y: 10, scale: 0.98 }"
        :animate="{ opacity: 1, y: 0, scale: 1 }"
        :exit="{ opacity: 0, x: 16, scale: 0.98 }"
        :transition="{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }"
        class="toast"
        :class="toast.tone"
      >
        <span class="toast-icon">
          <component :is="toneIcon(toast.tone)" :size="12" :stroke-width="2.2" />
        </span>
        <div class="min-w-0 flex-1">
          <div class="toast-title">{{ toast.title }}</div>
          <div v-if="toast.description" class="toast-desc">{{ toast.description }}</div>
        </div>
        <button class="icon-btn -mr-1 -mt-1 h-5 w-5" aria-label="关闭提示" @click="ui.dismissToast(toast.id)">
          <X :size="11" />
        </button>
      </motion.div>
    </AnimatePresence>
  </div>
</template>
