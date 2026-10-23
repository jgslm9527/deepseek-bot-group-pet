<script setup lang="ts">
import { computed } from 'vue'
import { VolumeX } from 'lucide-vue-next'
import type { Bot } from '@/types'

const props = withDefaults(
  defineProps<{
    bot: Bot
    size?: number
    muted?: boolean
    ring?: boolean
  }>(),
  { size: 34, muted: false, ring: false },
)

const avatarStyle = computed(() => ({
  width: `${props.size}px`,
  height: `${props.size}px`,
  background: `linear-gradient(145deg, color-mix(in srgb, ${props.bot.accent} 75%, white) 0%, ${props.bot.accent} 52%, color-mix(in srgb, ${props.bot.accent} 73%, #07102b) 100%)`,
  boxShadow: props.ring
    ? `0 0 0 2px var(--surface), 0 0 0 3.5px color-mix(in srgb, ${props.bot.accent} 35%, transparent)`
    : 'inset 0 1px 0 rgba(255,255,255,.3), 0 2px 5px rgba(10,18,35,.15)',
  fontSize: `${Math.max(13, props.size * 0.45)}px`,
}))
</script>

<template>
  <span class="bot-avatar" :style="avatarStyle" :aria-label="bot.name" :title="bot.name">
    <span class="bot-avatar-emoji">{{ bot.avatar }}</span>
    <span v-if="muted" class="bot-avatar-muted" title="已静音">
      <VolumeX :size="Math.max(8, size * 0.3)" :stroke-width="2.4" />
    </span>
  </span>
</template>

<style scoped>
.bot-avatar {
  position: relative;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border-radius: 33%;
  flex: 0 0 auto;
  line-height: 1;
  user-select: none;
  overflow: hidden;
  border: 1px solid rgba(255, 255, 255, 0.22);
}
.bot-avatar::after {
  content: '';
  position: absolute;
  inset: 0;
  border-radius: inherit;
  background: radial-gradient(circle at 32% 22%, rgba(255, 255, 255, 0.32), transparent 48%);
  pointer-events: none;
}
.bot-avatar-emoji {
  position: relative;
  z-index: 2;
  filter: drop-shadow(0 1px 1px rgba(0, 0, 0, 0.15));
  transform: translateY(-0.3px);
}
.bot-avatar-muted {
  position: absolute;
  right: -1px;
  bottom: -1px;
  z-index: 3;
  width: 14px;
  height: 14px;
  border-radius: 999px;
  background: var(--surface);
  color: var(--text-3);
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.18);
}
</style>
