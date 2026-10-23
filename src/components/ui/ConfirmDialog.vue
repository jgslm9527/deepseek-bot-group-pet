<script setup lang="ts">
import { computed } from 'vue'
import { TriangleAlert } from 'lucide-vue-next'
import BaseDialog from './BaseDialog.vue'
import { useUiStore } from '@/stores/ui'

const ui = useUiStore()
const open = computed({
  get: () => !!ui.confirmState,
  set: (value: boolean) => {
    if (!value) ui.resolveConfirm(false)
  },
})
const tone = computed(() => ui.confirmState?.tone ?? 'default')
</script>

<template>
  <BaseDialog
    :open="open"
    :title="ui.confirmState?.title ?? ''"
    :description="ui.confirmState?.description"
    size="sm"
    @update:open="open = $event"
  >
    <div class="flex items-start gap-3 py-1">
      <span
        class="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full"
        :style="{
          background: tone === 'danger' ? 'var(--danger-soft)' : 'var(--accent-faint)',
          color: tone === 'danger' ? 'var(--danger)' : 'var(--accent)',
        }"
      >
        <TriangleAlert :size="16" :stroke-width="1.9" />
      </span>
      <p class="m-0 text-[12px] leading-relaxed text-[var(--text-2)]">
        {{ ui.confirmState?.description || '请确认是否继续。' }}
      </p>
    </div>
    <template #footer>
      <button class="secondary-btn" @click="ui.resolveConfirm(false)">
        {{ ui.confirmState?.cancelText || '取消' }}
      </button>
      <button
        :class="tone === 'danger' ? 'danger-btn' : 'primary-btn'"
        @click="ui.resolveConfirm(true)"
      >
        {{ ui.confirmState?.confirmText || '确认' }}
      </button>
    </template>
  </BaseDialog>
</template>
