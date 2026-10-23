<script setup lang="ts">
import { computed } from 'vue'
import { ArrowUpRight, MessagesSquare, Plus, Sparkles } from 'lucide-vue-next'
import { useChatStore } from '@/stores/chat'
import { useUiStore } from '@/stores/ui'
import { EMPTY_STATE_SUGGESTIONS } from '@/lib/constants'

const chat = useChatStore()
const ui = useUiStore()
const hasRoom = computed(() => !!chat.activeRoom)

function useSuggestion(text: string) {
  chat.draft = text
  setTimeout(() => document.querySelector<HTMLTextAreaElement>('[data-composer-input]')?.focus(), 80)
}
</script>

<template>
  <div class="empty-chat">
    <div class="empty-orb">
      <Sparkles :size="27" :stroke-width="1.5" />
    </div>
    <template v-if="!hasRoom">
      <h2>把想法交给一支小队</h2>
      <p>
        创建群聊，邀请方案、评审和实现三种 Bot。它们会按流水线讨论，
        讨论闭环后停下来等你确认，确认前不会产出代码。
      </p>
      <div class="mt-1 flex items-center gap-2">
        <button class="primary-btn" @click="ui.openNewRoom('group')">
          <Plus :size="14" /> 新建群聊
        </button>
        <button class="secondary-btn" @click="ui.openNewRoom('private')">
          <MessagesSquare :size="14" /> 新建私聊
        </button>
      </div>
    </template>
    <template v-else>
      <h2>{{ chat.activeRoom?.name }}</h2>
      <p>这个会话还没有消息。发出第一条需求，或从一个示例开始。</p>
      <div class="suggestion-list">
        <button
          v-for="suggestion in EMPTY_STATE_SUGGESTIONS"
          :key="suggestion"
          class="suggestion-chip"
          @click="useSuggestion(suggestion)"
        >
          {{ suggestion }}
          <ArrowUpRight :size="10" class="ml-1 inline opacity-55" />
        </button>
      </div>
    </template>
  </div>
</template>
