<script setup lang="ts">
import { onBeforeUnmount, onMounted } from 'vue'
import { listen, type UnlistenFn } from '@tauri-apps/api/event'
import { RotateCw } from 'lucide-vue-next'
import { useChatStore } from '@/stores/chat'
import { useSettingsStore } from '@/stores/settings'
import { useUiStore } from '@/stores/ui'
import { isTauriRuntime } from '@/lib/tauri'
import { resetPetState } from '@/lib/pet-bus'
import MainWindow from '@/windows/MainWindow.vue'
import ToastHost from '@/components/ui/ToastHost.vue'
import ConfirmDialog from '@/components/ui/ConfirmDialog.vue'
import SettingsDialog from '@/components/settings/SettingsDialog.vue'
import NewRoomDialog from '@/components/rooms/NewRoomDialog.vue'
import BotEditDialog from '@/components/bots/BotEditDialog.vue'
import AddMemberDialog from '@/components/rooms/AddMemberDialog.vue'
import DiscussionConfirmDialog from '@/components/chat/DiscussionConfirmDialog.vue'

const chat = useChatStore()
const settings = useSettingsStore()
const ui = useUiStore()
let unlisteners: UnlistenFn[] = []

async function boot() {
  await Promise.all([settings.load(), chat.initialize()])
  if (!settings.hasApiKey && !chat.fatalError) {
    setTimeout(() => {
      if (!settings.hasApiKey) ui.openSettings('api')
    }, 700)
  }
  resetPetState()
}

function onKeydown(event: KeyboardEvent) {
  const meta = event.metaKey
  if (meta && event.key === ',') {
    event.preventDefault()
    ui.openSettings('api')
  }
  if (meta && event.key.toLowerCase() === 'n') {
    event.preventDefault()
    ui.openNewRoom(event.shiftKey ? 'private' : 'group')
  }
}

onMounted(async () => {
  window.addEventListener('keydown', onKeydown)
  if (isTauriRuntime()) {
    unlisteners.push(
      await listen<{ action: string }>('pet://menu', async (event) => {
        if (event.payload.action === 'open-settings') {
          ui.openSettings('api')
        }
        if (event.payload.action === 'mute-all') {
          await chat.muteAll()
        }
      }),
    )
  }
  await boot()
})

onBeforeUnmount(() => {
  window.removeEventListener('keydown', onKeydown)
  for (const unlisten of unlisteners) unlisten()
  unlisteners = []
})
</script>

<template>
  <div v-if="chat.loading || settings.loading" class="boot-screen">
    <div class="boot-card">
      <div class="empty-orb !mb-1 !h-[54px] !w-[54px] !rounded-[17px]">
        <span class="text-[23px]">🛰️</span>
      </div>
      <div class="boot-title">DeepSeek Bot Group Pet</div>
      <div class="boot-sub">正在打开本地工作区…<br />所有聊天与记忆都留在这台 Mac 上。</div>
      <div class="boot-dots"><i /><i /><i /></div>
    </div>
  </div>

  <div v-else-if="chat.fatalError" class="boot-screen">
    <div class="fatal-card">
      <h2>无法打开本地数据库</h2>
      <p>{{ chat.fatalError }}</p>
      <p class="mt-3">首次启动会自动建表，不需要手动执行 SQL。请确认应用拥有配置目录写权限后重试。</p>
      <button class="primary-btn mt-3" @click="chat.reloadAll()">
        <RotateCw :size="13" /> 重试
      </button>
    </div>
  </div>

  <MainWindow v-else />

  <SettingsDialog />
  <NewRoomDialog />
  <BotEditDialog />
  <AddMemberDialog />
  <DiscussionConfirmDialog />
  <ConfirmDialog />
  <ToastHost />
</template>
