<script setup lang="ts">
import type { Bot } from '@/types'
import BotAvatar from '@/components/bots/BotAvatar.vue'

defineProps<{ bot: Bot; label: string }>()
</script>

<template>
  <div class="typing-row">
    <div class="message-avatar"><BotAvatar :bot="bot" :size="32" /></div>
    <div class="typing-bubble">
      <span class="typing-text">{{ bot.name }} 正在{{ label }}</span>
      <span class="typing-dots"><span /><span /><span /></span>
    </div>
  </div>
</template>
