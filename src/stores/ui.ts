import { defineStore } from 'pinia'
import { ref } from 'vue'
import type { Toast } from '@/types'
import { newId } from '@/lib/id'

export interface ConfirmOptions {
  title: string
  description?: string
  confirmText?: string
  cancelText?: string
  tone?: 'default' | 'danger'
}

export interface BotEditorState {
  open: boolean
  botId: string | null
  mode: 'edit' | 'create'
  addToRoomId?: string | null
}

export type SettingsTab = 'api' | 'profile' | 'usage' | 'about'

export const useUiStore = defineStore('ui', () => {
  const toasts = ref<Toast[]>([])
  const detailsOpen = ref(false)
  const detailsTab = ref<'members' | 'memory'>('members')
  const settingsOpen = ref(false)
  const settingsTab = ref<SettingsTab>('api')
  const newRoomOpen = ref(false)
  const newRoomMode = ref<'group' | 'private'>('group')
  const addMemberOpen = ref(false)
  const botEditor = ref<BotEditorState>({
    open: false,
    botId: null,
    mode: 'edit',
    addToRoomId: null,
  })
  const confirmState = ref<ConfirmOptions | null>(null)
  let confirmResolver: ((value: boolean) => void) | null = null

  function toast(title: string, description?: string, tone: Toast['tone'] = 'default') {
    const item: Toast = { id: newId('toast'), title, description, tone }
    toasts.value.push(item)
    const ttl = tone === 'error' ? 6500 : 3800
    setTimeout(() => dismissToast(item.id), ttl)
  }

  function dismissToast(id: string) {
    toasts.value = toasts.value.filter((item) => item.id !== id)
  }

  function openSettings(tab: SettingsTab = 'api') {
    settingsTab.value = tab
    settingsOpen.value = true
  }

  function openBotEditor(botId: string | null = null, addToRoomId?: string | null) {
    botEditor.value = {
      open: true,
      botId,
      mode: botId ? 'edit' : 'create',
      addToRoomId: addToRoomId ?? null,
    }
  }

  function closeBotEditor() {
    botEditor.value.open = false
  }

  function openNewRoom(mode: 'group' | 'private' = 'group') {
    newRoomMode.value = mode
    newRoomOpen.value = true
  }

  function askConfirm(options: ConfirmOptions): Promise<boolean> {
    if (confirmResolver) confirmResolver(false)
    confirmState.value = options
    return new Promise((resolve) => {
      confirmResolver = resolve
    })
  }

  function resolveConfirm(value: boolean) {
    confirmState.value = null
    confirmResolver?.(value)
    confirmResolver = null
  }

  return {
    toasts,
    detailsOpen,
    detailsTab,
    settingsOpen,
    settingsTab,
    newRoomOpen,
    newRoomMode,
    addMemberOpen,
    botEditor,
    confirmState,
    toast,
    dismissToast,
    openSettings,
    openBotEditor,
    closeBotEditor,
    openNewRoom,
    askConfirm,
    resolveConfirm,
  }
})
