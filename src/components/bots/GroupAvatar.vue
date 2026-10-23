<script setup lang="ts">
import { computed } from 'vue'
import { Users } from 'lucide-vue-next'
import type { Bot } from '@/types'

const props = withDefaults(
  defineProps<{
    bots: Bot[]
    size?: number
  }>(),
  { size: 38 },
)

const shown = computed(() => props.bots.slice(0, 3))
</script>

<template>
  <span
    class="group-avatar"
    :style="{ width: `${size}px`, height: `${size}px`, borderRadius: `${Math.round(size * 0.3)}px` }"
  >
    <template v-if="shown.length">
      <span
        v-for="(bot, index) in shown"
        :key="bot.id"
        class="group-avatar-cell"
        :style="{
          background: `linear-gradient(145deg, color-mix(in srgb, ${bot.accent} 72%, white), ${bot.accent})`,
          fontSize: `${Math.round(size * (shown.length === 1 ? 0.48 : 0.28))}px`,
          zIndex: 3 - index,
        }"
      >{{ bot.avatar }}</span>
    </template>
    <Users v-else :size="Math.round(size * 0.44)" :stroke-width="1.7" />
  </span>
</template>

<style scoped>
.group-avatar {
  position: relative;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex: 0 0 auto;
  background:
    radial-gradient(circle at 28% 20%, rgba(255, 255, 255, 0.42), transparent 42%),
    linear-gradient(145deg, #4d6bfe, #263c9a 58%, #111b44);
  color: white;
  border: 1px solid rgba(255, 255, 255, 0.18);
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.32), 0 2px 6px rgba(20, 32, 80, 0.18);
  overflow: hidden;
}
.group-avatar-cell {
  position: absolute;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 48%;
  height: 48%;
  border-radius: 36%;
  border: 1px solid rgba(255, 255, 255, 0.24);
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.2);
  line-height: 1;
}
.group-avatar-cell:nth-child(1) {
  left: 5%;
  top: 6%;
}
.group-avatar-cell:nth-child(2) {
  right: 5%;
  top: 6%;
}
.group-avatar-cell:nth-child(3) {
  left: 27%;
  bottom: 4%;
}
</style>
