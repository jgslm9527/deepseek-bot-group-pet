<script setup lang="ts">
import { computed } from 'vue'
import {
  MessageSquarePlus,
  Plus,
  Search,
  Settings2,
  Users,
  X,
} from 'lucide-vue-next'
import { useChatStore } from '@/stores/chat'
import { useUiStore } from '@/stores/ui'
import { formatRelative } from '@/lib/time'
import BotAvatar from '@/components/bots/BotAvatar.vue'
import GroupAvatar from '@/components/bots/GroupAvatar.vue'
import appIcon from '@/assets/app-icon.png'

const chat = useChatStore()
const ui = useUiStore()

function roomBots(memberIds?: string[]) {
  if (!memberIds?.length) return []
  const set = new Set(memberIds)
  return chat.bots.filter((bot) => set.has(bot.id))
}

function directBot(memberIds?: string[]) {
  return roomBots(memberIds)[0]
}

const totalUnread = computed(() => 0)
</script>

<template>
  <aside class="sidebar-pane">
    <div class="top-dragbar pl-[78px] pr-[14px]" data-tauri-drag-region>
      <div class="brand">
        <img :src="appIcon" alt="" class="brand-mark" draggable="false" />
        <div class="min-w-0">
          <div class="brand-title">DeepSeek Pet</div>
          <div class="brand-sub">local ai studio</div>
        </div>
      </div>
      <div class="ml-auto flex items-center gap-1">
        <button class="icon-btn" title="设置" aria-label="打开设置" @click="ui.openSettings('api')">
          <Settings2 :size="16" :stroke-width="1.8" />
        </button>
      </div>
    </div>

    <div class="sidebar-search">
      <label class="search-box">
        <Search :size="13" :stroke-width="2" />
        <input
          v-model="chat.searchQuery"
          type="text"
          placeholder="搜索会话"
          spellcheck="false"
        />
        <button
          v-if="chat.searchQuery"
          class="flex h-4 w-4 items-center justify-center rounded-full text-[var(--text-3)] hover:bg-[var(--hover)]"
          aria-label="清除搜索"
          @click="chat.searchQuery = ''"
        >
          <X :size="10" />
        </button>
      </label>
    </div>

    <div class="sidebar-scroll">
      <div class="sidebar-section-label">
        <span>群聊房间</span>
        <span class="font-mono text-[9px] tracking-normal text-[var(--text-3)]">{{ chat.activeRooms.length }}</span>
      </div>
      <div v-if="chat.filteredGroups.length" class="flex flex-col gap-[2px]">
        <button
          v-for="room in chat.filteredGroups"
          :key="room.id"
          class="room-item"
          :class="{ active: room.id === chat.activeRoomId }"
          @click="chat.selectRoom(room.id)"
        >
          <span v-if="chat.pendingRooms.has(room.id)" class="pending-dot" title="等待确认" />
          <GroupAvatar :bots="roomBots(room.memberIds)" :size="38" />
          <span class="min-w-0 flex-1">
            <span class="flex items-baseline gap-2">
              <span class="room-name flex-1">{{ room.name }}</span>
              <span class="room-time">{{ formatRelative(room.lastMessageAt || room.updatedAt) }}</span>
            </span>
            <span class="room-preview">
              {{ room.lastMessage || '开始一场多 Bot 协作讨论' }}
            </span>
          </span>
        </button>
      </div>
      <div v-else-if="chat.normalizedQuery" class="sidebar-empty">没有匹配的群聊</div>
      <div v-else class="sidebar-empty !py-4">
        <Users :size="17" class="mx-auto mb-1 opacity-40" />
        暂无群聊，点击下方新建
      </div>

      <div class="sidebar-section-label mt-1">
        <span>单 Bot 私聊</span>
        <span class="font-mono text-[9px] tracking-normal text-[var(--text-3)]">{{ chat.directRooms.length }}</span>
      </div>
      <div v-if="chat.filteredDirects.length" class="flex flex-col gap-[2px]">
        <button
          v-for="room in chat.filteredDirects"
          :key="room.id"
          class="room-item"
          :class="{ active: room.id === chat.activeRoomId }"
          @click="chat.selectRoom(room.id)"
        >
          <span v-if="chat.pendingRooms.has(room.id)" class="pending-dot" title="等待确认" />
          <template v-if="directBot(room.memberIds)">
            <BotAvatar :bot="directBot(room.memberIds)!" :size="38" :muted="directBot(room.memberIds)!.muted" />
          </template>
          <span
            v-else
            class="flex h-[38px] w-[38px] shrink-0 items-center justify-center rounded-[12px] bg-[var(--surface-2)] text-[var(--text-3)]"
          >
            <MessageSquarePlus :size="16" />
          </span>
          <span class="min-w-0 flex-1">
            <span class="flex items-baseline gap-2">
              <span class="room-name flex-1">{{ room.name }}</span>
              <span class="room-time">{{ formatRelative(room.lastMessageAt || room.updatedAt) }}</span>
            </span>
            <span class="room-preview">{{ room.lastMessage || '一对一对话' }}</span>
          </span>
        </button>
      </div>
      <div v-else-if="chat.normalizedQuery" class="sidebar-empty">没有匹配的私聊</div>
      <div v-else class="sidebar-empty !py-4">
        <MessageSquarePlus :size="17" class="mx-auto mb-1 opacity-40" />
        暂无私聊
      </div>
    </div>

    <div class="sidebar-footer">
      <button class="compose-new-btn" @click="ui.openNewRoom('group')">
        <Users :size="13" :stroke-width="2" />
        新建群聊
      </button>
      <button class="compose-new-btn" @click="ui.openNewRoom('private')">
        <Plus :size="13" :stroke-width="2.2" />
        新建私聊
      </button>
    </div>
  </aside>
</template>
