<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { Check, Plus } from 'lucide-vue-next'
import type { Bot } from '@/types'
import { listBotsOutsideRoom } from '@/lib/repos/bots'
import { useChatStore } from '@/stores/chat'
import { useUiStore } from '@/stores/ui'
import { MODEL_LABELS, ROLE_META } from '@/lib/constants'
import BotAvatar from '@/components/bots/BotAvatar.vue'
import BaseDialog from '@/components/ui/BaseDialog.vue'

const chat = useChatStore()
const ui = useUiStore()
const open = computed({
  get: () => ui.addMemberOpen,
  set: (value: boolean) => (ui.addMemberOpen = value),
})
const candidates = ref<Bot[]>([])
const loading = ref(false)
const addingId = ref<string | null>(null)

watch(
  () => ui.addMemberOpen,
  async (isOpen) => {
    if (!isOpen || !chat.activeRoomId) return
    loading.value = true
    try {
      candidates.value = await listBotsOutsideRoom(chat.activeRoomId)
    } finally {
      loading.value = false
    }
  },
)

async function add(bot: Bot) {
  if (!chat.activeRoomId) return
  addingId.value = bot.id
  try {
    await chat.addMember(chat.activeRoomId, bot.id)
  } catch (error) {
    ui.toast('添加成员失败', String(error), 'error')
  } finally {
    addingId.value = null
  }
}

function createNew() {
  if (!chat.activeRoomId) return
  const roomId = chat.activeRoomId
  ui.addMemberOpen = false
  ui.openBotEditor(null, roomId)
}
</script>

<template>
  <BaseDialog
    :open="open"
    title="添加 Bot 成员"
    description="选择的 Bot 会立即加入当前房间，保留自己的人设与长期记忆。"
    size="sm"
    @update:open="open = $event"
  >
    <div v-if="loading" class="py-8 text-center text-[11px] text-[var(--text-3)]">加载中…</div>
    <div v-else class="bot-picker-grid max-h-[350px] overflow-y-auto pr-0.5">
      <button
        v-for="bot in candidates"
        :key="bot.id"
        class="bot-picker-card"
        :disabled="!!addingId"
        @click="add(bot)"
      >
        <BotAvatar :bot="bot" :size="30" />
        <span class="min-w-0 flex-1">
          <span class="block truncate text-[12px] font-medium">{{ bot.name }}</span>
          <span class="block truncate text-[10px] text-[var(--text-3)]">{{ ROLE_META[bot.role].label }} · {{ MODEL_LABELS[bot.model] }}</span>
        </span>
        <span class="check-circle">
          <Check v-if="addingId === bot.id" :size="10" />
          <Plus v-else :size="11" class="text-[var(--text-3)]" />
        </span>
      </button>
      <div v-if="!candidates.length" class="py-7 text-center text-[11px] text-[var(--text-3)]">
        所有 Bot 都已在该房间，或还没有更多 Bot。
      </div>
    </div>
    <button class="mt-3 flex w-full items-center justify-center gap-1 rounded-lg border border-dashed border-[var(--border-strong)] py-2 text-[11px] text-[var(--text-2)] hover:bg-[var(--hover)]" @click="createNew">
      <Plus :size="11" /> 创建新 Bot 并加入
    </button>
  </BaseDialog>
</template>
