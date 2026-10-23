<script setup lang="ts">
import { Clock3 } from 'lucide-vue-next'
import { useChatStore } from '@/stores/chat'
import ChatHeader from './ChatHeader.vue'
import MessageList from './MessageList.vue'
import Composer from './Composer.vue'
import ChatEmpty from './ChatEmpty.vue'

const chat = useChatStore()
</script>

<template>
  <main class="chat-pane">
    <ChatHeader />
    <div v-if="chat.activePending" class="pending-banner">
      <Clock3 :size="14" class="shrink-0 text-[var(--warning)]" />
      <span class="min-w-0 flex-1">
        讨论已闭环，等待你确认。确认前不会生成最终代码。
      </span>
      <button @click="chat.openConfirmation">查看结论并确认</button>
    </div>

    <template v-if="chat.activeRoom">
      <MessageList />
      <Composer />
    </template>
    <template v-else>
      <div class="min-h-0 flex-1 overflow-y-auto">
        <ChatEmpty />
      </div>
    </template>
  </main>
</template>
