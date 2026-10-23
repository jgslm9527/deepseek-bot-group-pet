import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
import type { Bot, Memory, MemoryStatus } from '@/types'
import {
  countMemories,
  clearBotMemories,
  createMemory,
  deleteMemories,
  listMemories,
  pickEvictableMemories,
  setMemoryStatus,
  updateMemory,
} from '@/lib/repos/memories'
import { getBot, updateBot } from '@/lib/repos/bots'
import { onMemoriesChanged } from '@/lib/memory-engine'
import { useUiStore } from '@/stores/ui'

export const useMemoryStore = defineStore('memory', () => {
  const selectedBotId = ref<string | null>(null)
  const filter = ref<MemoryStatus | 'all'>('active')
  const memories = ref<Memory[]>([])
  const activeCount = ref(0)
  const pendingCount = ref(0)
  const loading = ref(false)
  const saving = ref(false)
  const selectedIds = ref<string[]>([])

  const selectedMemories = computed(() => memories.value.filter((item) => selectedIds.value.includes(item.id)))

  let unsubscribe: (() => void) | null = null

  function ensureListener() {
    if (unsubscribe) return
    unsubscribe = onMemoriesChanged(async (roomId) => {
      if (selectedBotId.value) {
        await refresh(selectedBotId.value, false)
      }
      void roomId
    })
  }

  async function selectBot(botId: string) {
    ensureListener()
    selectedBotId.value = botId
    selectedIds.value = []
    await refresh(botId)
  }

  async function refresh(botId?: string, showLoader = true) {
    const target = botId ?? selectedBotId.value
    if (!target) return
    if (showLoader) loading.value = true
    try {
      const [items, active, pending] = await Promise.all([
        listMemories(target, filter.value),
        countMemories(target, 'active'),
        countMemories(target, 'pending'),
      ])
      memories.value = items
      activeCount.value = active
      pendingCount.value = pending
      selectedIds.value = selectedIds.value.filter((id) => items.some((item) => item.id === id))
    } finally {
      if (showLoader) loading.value = false
    }
  }

  async function setFilter(next: MemoryStatus | 'all') {
    filter.value = next
    if (selectedBotId.value) await refresh(selectedBotId.value)
  }

  function toggleSelected(id: string) {
    selectedIds.value = selectedIds.value.includes(id)
      ? selectedIds.value.filter((value) => value !== id)
      : [...selectedIds.value, id]
  }

  function selectAll() {
    selectedIds.value = memories.value.map((item) => item.id)
  }

  function clearSelection() {
    selectedIds.value = []
  }

  async function add(input: {
    summary: string
    content: string
    tags: string[]
    importance: number
  }) {
    if (!selectedBotId.value) return
    const bot = await getBot(selectedBotId.value)
    if (!bot) throw new Error('Bot 不存在')
    const activeCount = await countMemories(bot.id, 'active')
    if (activeCount >= bot.memoryLimit) {
      const evict = await pickEvictableMemories(bot.id, bot.memoryLimit, input.importance)
      if (!evict.length) {
        throw new Error(
          '该 Bot 的记忆已达上限，且现有记忆重要度较高，无法自动淘汰。请先手动归档或删除一条记忆。',
        )
      }
      await setMemoryStatus(evict, 'archived')
    }
    await createMemory({
      ...input,
      botId: selectedBotId.value,
      roomId: null,
      source: 'manual',
      status: 'active',
    })
    await refresh()
  }

  async function edit(
    id: string,
    patch: Partial<Pick<Memory, 'summary' | 'content' | 'tags' | 'importance'>>,
  ) {
    await updateMemory(id, patch)
    await refresh()
  }

  async function remove(ids: string[]) {
    await deleteMemories(ids)
    await refresh()
  }

  async function archive(ids: string[]) {
    await setMemoryStatus(ids, 'archived')
    await refresh()
  }

  async function approve(ids: string[]) {
    await setMemoryStatus(ids, 'active')
    await refresh()
  }

  async function clearAll() {
    if (!selectedBotId.value) return
    await clearBotMemories(selectedBotId.value)
    await refresh()
  }

  async function toggleBotOption(
    bot: Bot,
    key: 'autoMemory' | 'shareMemories' | 'memoryScope' | 'memoryLimit',
    value: boolean | string | number,
  ) {
    const ui = useUiStore()
    try {
      await updateBot(bot.id, { [key]: value } as never)
      if (key === 'autoMemory') bot.autoMemory = Boolean(value)
      if (key === 'shareMemories') bot.shareMemories = Boolean(value)
      if (key === 'memoryScope') bot.memoryScope = value === 'room' ? 'room' : 'all'
      if (key === 'memoryLimit') bot.memoryLimit = Number(value)
      ui.toast('记忆设置已保存', undefined, 'success')
    } catch (error) {
      ui.toast('保存失败', String(error), 'error')
    }
  }

  return {
    selectedBotId,
    filter,
    memories,
    activeCount,
    pendingCount,
    loading,
    saving,
    selectedIds,
    selectedMemories,
    selectBot,
    refresh,
    setFilter,
    toggleSelected,
    selectAll,
    clearSelection,
    add,
    edit,
    remove,
    archive,
    approve,
    clearAll,
    toggleBotOption,
  }
})
