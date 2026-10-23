<script setup lang="ts">
import { computed } from 'vue'
import { Clock3, MoreHorizontal, Square } from 'lucide-vue-next'
import { useChatStore } from '@/stores/chat'
import { useUiStore } from '@/stores/ui'
import { MODEL_LABELS, ROLE_META } from '@/lib/constants'
import BotAvatar from '@/components/bots/BotAvatar.vue'
import GroupAvatar from '@/components/bots/GroupAvatar.vue'
import SwitchControl from '@/components/ui/SwitchControl.vue'

const chat = useChatStore()
const ui = useUiStore()

const room = computed(() => chat.activeRoom)
const memberLabel = computed(() => {
  if (!room.value) return ''
  if (room.value.kind === 'direct') {
    const bot = chat.activeBots[0]
    return bot ? `${ROLE_META[bot.role].label} · ${MODEL_LABELS[bot.model]}` : '私聊'
  }
  return `${chat.activeBots.length} 位 Bot · ${chat.activeBots.filter((bot) => !bot.muted).length} 人在线`
})
const canAuto = computed(() => room.value?.kind === 'group')
const autoPoll = computed({
  get: () => !!room.value?.autoPoll,
  set: (value: boolean) => void chat.setAutoPoll(value),
})
</script>

<template>
  <header class="glass-topbar" data-tauri-drag-region>
    <div class="flex min-w-0 items-center gap-9">
      <div v-if="room" class="flex min-w-0 items-center gap-2">
        <GroupAvatar v-if="room.kind === 'group'" :bots="chat.activeBots" :size="30" />
        <BotAvatar v-else-if="chat.activeBots[0]" :bot="chat.activeBots[0]" :size="30" :muted="chat.activeBots[0].muted" />
        <div class="chat-header-title">
          <h1>{{ room.name }}</h1>
          <div class="chat-header-sub">
            <span class="online-dot" />
            <span>{{ memberLabel }}</span>
            <span v-if="room.kind === 'group'" class="opacity-45">·</span>
            <span v-if="room.kind === 'group' && !room.autoPoll">仅 @ 回复</span>
            <span v-else-if="room.kind === 'group'" class="text-[var(--accent)]">流水线已就绪</span>
          </div>
        </div>
      </div>
      <div v-else class="chat-header-title">
        <h1>DeepSeek Bot Group Pet</h1>
        <div class="chat-header-sub">本地多 Bot 协作空间</div>
      </div>
    </div>

    <div class="chat-header-actions">
      <button v-if="chat.isActiveRoomRunning" class="stop-pill" role="button" title="停止自动讨论" @click="chat.stopGeneration">
        <span class="flex items-center gap-1.5">
          <span class="h-1.5 w-1.5 animate-pulse rounded-full bg-[var(--danger)]" />
          自动讨论中
        </span>
        <span class="ml-1 rounded p-0.5">
          <Square :size="10" fill="currentColor" />
        </span>
      </button>
      <button
        v-if="chat.activePending"
        class="pending-trigger"
        title="查看待确认结论"
        @click="chat.openConfirmation"
      >
        <Clock3 :size="13" />
        待确认
      </button>
      <div v-if="canAuto" class="auto-toggle" :class="{ on: autoPoll }">
        <span>自动轮询</span>
        <SwitchControl v-model="autoPoll" label="自动轮询" />
      </div>
      <div class="mx-0.5 h-4 w-px bg-[var(--border)]" />
      <button
        class="icon-btn"
        :class="{ 'is-active': ui.detailsOpen }"
        title="会话详情"
        aria-label="打开会话详情"
        @click="ui.detailsOpen = !ui.detailsOpen"
      >
        <MoreHorizontal :size="17" :stroke-width="2" />
      </button>
    </div>
  </header>
</template>

<style scoped>
.pending-trigger {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  height: 27px;
  border-radius: 999px;
  padding: 0 9px;
  font-size: 10.5px;
  font-weight: 560;
  color: var(--warning);
  background: color-mix(in srgb, var(--warning) 10%, transparent);
  border: 1px solid color-mix(in srgb, var(--warning) 22%, transparent);
}
.pending-trigger:hover {
  background: color-mix(in srgb, var(--warning) 15%, transparent);
}
</style>
