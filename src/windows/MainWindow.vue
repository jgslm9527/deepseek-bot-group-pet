<script setup lang="ts">
import { AnimatePresence, motion } from 'motion-v'
import { useChatStore } from '@/stores/chat'
import { useUiStore } from '@/stores/ui'
import AppSidebar from '@/components/layout/AppSidebar.vue'
import ChatView from '@/components/chat/ChatView.vue'
import DetailsPanel from '@/components/layout/DetailsPanel.vue'

const chat = useChatStore()
const ui = useUiStore()
</script>

<template>
  <div class="app-root">
    <AppSidebar />
    <ChatView />
    <AnimatePresence>
      <motion.div
        v-if="ui.detailsOpen && chat.activeRoom"
        :initial="{ opacity: 0, x: 18 }"
        :animate="{ opacity: 1, x: 0 }"
        :exit="{ opacity: 0, x: 16 }"
        :transition="{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }"
        class="h-full shrink-0"
      >
        <DetailsPanel />
      </motion.div>
    </AnimatePresence>
  </div>
</template>
