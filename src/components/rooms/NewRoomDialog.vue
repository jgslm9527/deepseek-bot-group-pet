<script setup lang="ts">
import { computed, reactive, ref, watch } from 'vue'
import { Check, MessageSquare, Plus, Users } from 'lucide-vue-next'
import { useChatStore } from '@/stores/chat'
import { useUiStore } from '@/stores/ui'
import { MODEL_LABELS, ROLE_META } from '@/lib/constants'
import BotAvatar from '@/components/bots/BotAvatar.vue'
import BaseDialog from '@/components/ui/BaseDialog.vue'

const chat = useChatStore()
const ui = useUiStore()
const open = computed({
  get: () => ui.newRoomOpen,
  set: (value: boolean) => (ui.newRoomOpen = value),
})
const mode = computed({
  get: () => ui.newRoomMode,
  set: (value: 'group' | 'private') => (ui.newRoomMode = value),
})
const name = ref('')
const selected = ref<string[]>([])
const directSelected = ref<string | null>(null)
const saving = ref(false)

const availableBots = computed(() => chat.bots)
const canSubmit = computed(() => {
  if (mode.value === 'group') return !!name.value.trim() && selected.value.length > 0
  return !!directSelected.value
})

watch(
  () => ui.newRoomOpen,
  (isOpen) => {
    if (!isOpen) return
    name.value = ''
    selected.value = []
    directSelected.value = null
    saving.value = false
  },
)

function toggle(id: string) {
  selected.value = selected.value.includes(id)
    ? selected.value.filter((item) => item !== id)
    : [...selected.value, id]
}

function chooseDirect(id: string) {
  directSelected.value = id
  const bot = availableBots.value.find((item) => item.id === id)
  if (bot) name.value = bot.name
}

async function submit() {
  if (!canSubmit.value || saving.value) return
  saving.value = true
  try {
    if (mode.value === 'group') {
      await chat.createGroup(name.value, selected.value)
    } else if (directSelected.value) {
      await chat.createPrivate(directSelected.value)
    }
  } catch (error) {
    ui.toast('创建失败', String(error), 'error')
  } finally {
    saving.value = false
  }
}

function createBotFirst() {
  ui.newRoomOpen = false
  ui.openBotEditor(null, null)
}
</script>

<template>
  <BaseDialog
    :open="open"
    :title="mode === 'group' ? '新建群聊房间' : '新建单 Bot 私聊'"
    :description="mode === 'group' ? '选择参会的 Bot，每个 Bot 继续使用自己独立的人设与记忆。' : '一对一会话，不会启动多 Bot 流水线。'"
    size="md"
    @update:open="open = $event"
  >
    <div class="settings-tabs">
      <button class="settings-tab" :class="{ active: mode === 'group' }" @click="mode = 'group'">
        <Users :size="11" class="mr-1 inline" /> 群聊房间
      </button>
      <button class="settings-tab" :class="{ active: mode === 'private' }" @click="mode = 'private'">
        <MessageSquare :size="11" class="mr-1 inline" /> 单 Bot 私聊
      </button>
    </div>

    <div class="form-stack">
      <label v-if="mode === 'group'" class="form-field">
        <span class="form-label">群聊名称</span>
        <input v-model="name" class="input" maxlength="40" placeholder="例如：产品共创小组" @keydown.enter="submit" />
      </label>

      <div class="form-field">
        <span class="form-label">
          {{ mode === 'group' ? '选择 Bot' : '选择一位 Bot' }}
          <span class="font-normal text-[var(--text-3)]">· {{ availableBots.length }} 个可用</span>
        </span>
        <div class="bot-picker-grid max-h-[310px] overflow-y-auto pr-0.5">
          <button
            v-for="bot in availableBots"
            :key="bot.id"
            class="bot-picker-card"
            :class="{
              selected: mode === 'group' ? selected.includes(bot.id) : directSelected === bot.id,
            }"
            @click="mode === 'group' ? toggle(bot.id) : chooseDirect(bot.id)"
          >
            <BotAvatar :bot="bot" :size="32" :muted="bot.muted" />
            <span class="min-w-0 flex-1">
              <span class="block truncate text-[12px] font-medium">{{ bot.name }}</span>
              <span class="block truncate text-[10px] text-[var(--text-3)]">
                {{ ROLE_META[bot.role].label }} · {{ MODEL_LABELS[bot.model] }}
                <span v-if="bot.muted"> · 已静音</span>
              </span>
            </span>
            <span class="check-circle">
              <Check :size="10" :stroke-width="3" />
            </span>
          </button>
          <div v-if="!availableBots.length" class="rounded-lg border border-dashed border-[var(--border-strong)] px-4 py-7 text-center">
            <div class="text-[11.5px] text-[var(--text-2)]">还没有任何 Bot</div>
            <button class="secondary-btn mt-2 !py-1 !text-[10.5px]" @click="createBotFirst">
              <Plus :size="10" /> 先创建一个 Bot
            </button>
          </div>
        </div>
      </div>

      <div v-if="mode === 'group'" class="guard-notice !my-0">
        <Users :size="13" class="mt-0.5 shrink-0 text-[var(--accent)]" />
        <span>
          推荐同时包含 Chat、R1 与 Flash/V4 Pro 三个角色。缺少实现角色时，
          讨论仍可进行，但无法在确认后生成最终代码。
        </span>
      </div>
    </div>

    <template #footer>
      <button class="secondary-btn" @click="open = false">取消</button>
      <button class="primary-btn" :disabled="!canSubmit || saving" @click="submit">
        {{ saving ? '创建中…' : mode === 'group' ? '创建群聊' : '开始私聊' }}
      </button>
    </template>
  </BaseDialog>
</template>
