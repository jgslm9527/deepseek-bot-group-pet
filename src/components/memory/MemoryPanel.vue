<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import {
  Archive,
  Check,
  ChevronDown,
  CircleCheck,
  Pencil,
  Plus,
  RotateCcw,
  Sparkles,
  Trash2,
} from 'lucide-vue-next'
import type { Memory } from '@/types'
import { useChatStore } from '@/stores/chat'
import { useMemoryStore } from '@/stores/memory'
import { useUiStore } from '@/stores/ui'
import { formatDateTime, formatRelative } from '@/lib/time'
import BotAvatar from '@/components/bots/BotAvatar.vue'
import SwitchControl from '@/components/ui/SwitchControl.vue'
import MemoryEditDialog from './MemoryEditDialog.vue'

const chat = useChatStore()
const store = useMemoryStore()
const ui = useUiStore()
const editingOpen = ref(false)
const editingMemory = ref<Memory | null>(null)

const selectedBot = computed(() => chat.activeBots.find((bot) => bot.id === store.selectedBotId) ?? null)
const roomName = (roomId: string | null) => {
  if (!roomId) return '手动添加'
  return chat.rooms.find((room) => room.id === roomId)?.name ?? '已删除会话'
}
const tabs = [
  { value: 'active', label: '生效中' },
  { value: 'pending', label: '待审核' },
  { value: 'archived', label: '已归档' },
] as const

watch(
  () => chat.activeBots.map((bot) => bot.id).join(','),
  async () => {
    if (!chat.activeBots.length) return
    if (!store.selectedBotId || !chat.activeBots.some((bot) => bot.id === store.selectedBotId)) {
      await store.selectBot(chat.activeBots[0].id)
    }
  },
  { immediate: true },
)

function openCreate() {
  editingMemory.value = null
  editingOpen.value = true
}

function openEdit(memory: Memory) {
  editingMemory.value = memory
  editingOpen.value = true
}

async function remove(memory: Memory) {
  const okay = await ui.askConfirm({
    title: '删除这条记忆？',
    description: memory.summary,
    confirmText: '删除',
    tone: 'danger',
  })
  if (!okay) return
  await store.remove([memory.id])
}

async function removeSelected() {
  const okay = await ui.askConfirm({
    title: `删除选中的 ${store.selectedIds.length} 条记忆？`,
    description: '此操作不可撤销。',
    confirmText: '删除',
    tone: 'danger',
  })
  if (!okay) return
  await store.remove([...store.selectedIds])
}

async function clearAll() {
  const okay = await ui.askConfirm({
    title: `清空「${selectedBot.value?.name ?? 'Bot'}」的全部记忆？`,
    description: '包括生效中、待审核和已归档的记忆，全部从本机 SQLite 删除。',
    confirmText: '清空全部',
    tone: 'danger',
  })
  if (!okay) return
  await store.clearAll()
  ui.toast('记忆已清空')
}

function setScope(event: Event) {
  if (!selectedBot.value) return
  void store.toggleBotOption(selectedBot.value, 'memoryScope', (event.target as HTMLSelectElement).value)
}

function setLimit(event: Event) {
  if (!selectedBot.value) return
  const value = Math.max(5, Math.min(200, Number((event.target as HTMLInputElement).value) || 30))
  ;(event.target as HTMLInputElement).value = String(value)
  void store.toggleBotOption(selectedBot.value, 'memoryLimit', value)
}
</script>

<template>
  <div class="memory-panel">
    <div v-if="chat.activeBots.length" class="memory-toolbar">
      <select
        :value="store.selectedBotId ?? ''"
        class="memory-bot-select"
        aria-label="选择 Bot 的记忆"
        @change="store.selectBot(($event.target as HTMLSelectElement).value)"
      >
        <option v-for="bot in chat.activeBots" :key="bot.id" :value="bot.id">
          {{ bot.avatar }} {{ bot.name }}
        </option>
      </select>
      <button class="icon-btn !h-7 !w-7" title="新增记忆" @click="openCreate">
        <Plus :size="14" />
      </button>
      <button
        class="icon-btn !h-7 !w-7"
        title="清空该 Bot 记忆"
        :disabled="!selectedBot"
        @click="clearAll"
      >
        <Trash2 :size="13" />
      </button>
    </div>

    <template v-if="selectedBot">
      <div class="flex items-center gap-2 px-0.5 pb-2">
        <BotAvatar :bot="selectedBot" :size="30" />
        <div class="min-w-0 flex-1">
          <div class="truncate text-[12px] font-semibold">{{ selectedBot.name }}</div>
          <div class="text-[9.5px] text-[var(--text-3)]">
            {{ store.activeCount }} / {{ selectedBot.memoryLimit }} 条生效记忆
            <span v-if="store.pendingCount"> · {{ store.pendingCount }} 条待审核</span>
          </div>
        </div>
        <span class="pill !px-1.5 !py-0.5 !text-[9px]">
          <Sparkles :size="9" /> Muse
        </span>
      </div>

      <div class="memory-settings">
        <div class="memory-setting-row">
          <span>自动记忆抽取</span>
          <SwitchControl
            :model-value="selectedBot.autoMemory"
            label="自动记忆"
            @update:model-value="store.toggleBotOption(selectedBot, 'autoMemory', $event)"
          />
        </div>
        <div class="memory-setting-row">
          <span>本群共享我的记忆</span>
          <SwitchControl
            :model-value="selectedBot.shareMemories"
            label="本群共享记忆"
            @update:model-value="store.toggleBotOption(selectedBot, 'shareMemories', $event)"
          />
        </div>
        <div class="memory-setting-row">
          <span>读取范围</span>
          <select class="mini-number !w-[76px]" :value="selectedBot.memoryScope" @change="setScope">
            <option value="all">全部房间</option>
            <option value="room">仅本房间</option>
          </select>
        </div>
        <div class="memory-setting-row">
          <span>记忆条数上限</span>
          <input
            class="mini-number"
            type="number"
            min="5"
            max="200"
            :value="selectedBot.memoryLimit"
            @change="setLimit"
          />
        </div>
      </div>

      <div class="memory-status-tabs">
        <button
          v-for="tab in tabs"
          :key="tab.value"
          class="memory-status-tab"
          :class="{ active: store.filter === tab.value }"
          @click="store.setFilter(tab.value)"
        >
          {{ tab.label }}
          <span v-if="tab.value === 'pending' && store.pendingCount" class="ml-0.5 text-[var(--warning)]">
            {{ store.pendingCount }}
          </span>
        </button>
      </div>

      <div v-if="store.selectedIds.length" class="mb-2 flex items-center gap-1 rounded-lg border border-[var(--border)] bg-[var(--surface-2)] px-2 py-1">
        <span class="flex-1 text-[10px] text-[var(--text-3)]">已选 {{ store.selectedIds.length }} 条</span>
        <button class="text-[10px] text-[var(--accent)]" @click="store.selectAll()">全选</button>
        <button class="text-[10px] text-[var(--text-2)]" @click="store.archive([...store.selectedIds])">归档</button>
        <button class="text-[10px] text-[var(--danger)]" @click="removeSelected">删除</button>
        <button class="icon-btn !h-5 !w-5" title="取消选择" @click="store.clearSelection()">
          <ChevronDown :size="10" />
        </button>
      </div>

      <div v-if="store.loading" class="py-8 text-center text-[10.5px] text-[var(--text-3)]">加载记忆…</div>
      <div v-else-if="!store.memories.length" class="empty-memory">
        <span class="empty-memory-icon"><Sparkles :size="17" :stroke-width="1.6" /></span>
        <div class="text-[11px] font-medium text-[var(--text-2)]">
          {{ store.filter === 'pending' ? '没有待审核记忆' : store.filter === 'archived' ? '没有归档记忆' : '还没有长期记忆' }}
        </div>
        <div class="mt-1 text-[10px] leading-relaxed text-[var(--text-3)]">
          {{ store.filter === 'active' ? '讨论结束后会自动提炼长期规则，也可以手动添加。' : '较低置信度的记忆会先进入待审核。' }}
        </div>
        <button v-if="store.filter === 'active'" class="secondary-btn mt-2 !px-2.5 !py-1 !text-[10px]" @click="openCreate">
          <Plus :size="10" /> 手动添加
        </button>
      </div>

      <div v-else class="memory-list">
        <div
          v-for="memory in store.memories"
          :key="memory.id"
          class="memory-card"
          :class="{ selected: store.selectedIds.includes(memory.id), pending: memory.status === 'pending' }"
        >
          <div class="memory-card-head">
            <button
              class="memory-check"
              :class="{ checked: store.selectedIds.includes(memory.id) }"
              :aria-label="store.selectedIds.includes(memory.id) ? '取消选择' : '选择记忆'"
              @click="store.toggleSelected(memory.id)"
            >
              <Check v-if="store.selectedIds.includes(memory.id)" :size="9" :stroke-width="3" />
            </button>
            <span class="memory-summary">{{ memory.summary }}</span>
            <span class="importance shrink-0" :title="`重要度 ${memory.importance}/5`">
              <i
                v-for="n in 5"
                :key="n"
                class="importance-dot"
                :class="{ on: n <= memory.importance }"
              />
            </span>
          </div>
          <p class="memory-content">{{ memory.content }}</p>
          <div class="memory-meta">
            <span class="memory-tag" v-for="tag in memory.tags.slice(0, 3)" :key="tag">{{ tag }}</span>
            <span>{{ roomName(memory.roomId) }}</span>
            <span>·</span>
            <span :title="formatDateTime(memory.createdAt)">{{ formatRelative(memory.createdAt) }}</span>
            <span v-if="memory.status === 'pending'" class="text-[var(--warning)]">· 置信度 {{ Math.round(memory.confidence * 100) }}%</span>
          </div>
          <div class="memory-actions">
            <button
              v-if="memory.status === 'pending'"
              class="icon-btn !h-6 !w-6"
              title="审核通过"
              @click="store.approve([memory.id])"
            >
              <CircleCheck :size="12" class="text-[var(--success)]" />
            </button>
            <button
              v-if="memory.status === 'archived'"
              class="icon-btn !h-6 !w-6"
              title="恢复"
              @click="store.approve([memory.id])"
            >
              <RotateCcw :size="11" />
            </button>
            <button class="icon-btn !h-6 !w-6" title="编辑" @click="openEdit(memory)">
              <Pencil :size="11" />
            </button>
            <button
              v-if="memory.status !== 'archived'"
              class="icon-btn !h-6 !w-6"
              title="归档"
              @click="store.archive([memory.id])"
            >
              <Archive :size="11" />
            </button>
            <button class="icon-btn !h-6 !w-6 hover:!text-[var(--danger)]" title="删除" @click="remove(memory)">
              <Trash2 :size="11" />
            </button>
          </div>
        </div>
      </div>
    </template>
    <div v-else class="empty-memory">
      <Sparkles :size="18" class="opacity-40" />
      <span>添加 Bot 后即可管理长期记忆</span>
    </div>

    <MemoryEditDialog v-model:open="editingOpen" :memory="editingMemory" />
  </div>
</template>

<style scoped>
.empty-memory {
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
  padding: 28px 12px;
  color: var(--text-3);
}
.empty-memory-icon {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 34px;
  height: 34px;
  border-radius: 11px;
  margin-bottom: 8px;
  color: var(--accent);
  background: var(--accent-faint);
  border: 1px solid color-mix(in srgb, var(--accent) 14%, transparent);
}
</style>
