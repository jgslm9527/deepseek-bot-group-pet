<script setup lang="ts">
import {
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogOverlay,
  DialogPortal,
  DialogRoot,
  DialogTitle,
} from 'reka-ui'
import { X } from 'lucide-vue-next'

withDefaults(
  defineProps<{
    open: boolean
    title: string
    description?: string
    size?: 'sm' | 'md' | 'lg' | 'xl'
    hideClose?: boolean
  }>(),
  { size: 'md', hideClose: false, description: '' },
)

const emit = defineEmits<{
  (event: 'update:open', value: boolean): void
}>()
</script>

<template>
  <DialogRoot :open="open" @update:open="emit('update:open', $event)">
    <DialogPortal>
      <DialogOverlay class="dialog-overlay" />
      <DialogContent
        class="dialog-content"
        :class="`size-${size}`"
        @pointer-down-outside="emit('update:open', false)"
        @escape-key-down="emit('update:open', false)"
      >
        <header class="dialog-header">
          <div class="min-w-0">
            <DialogTitle class="dialog-title">{{ title }}</DialogTitle>
            <DialogDescription class="dialog-description" :class="{ 'sr-only': !description }">
              {{ description || title }}
            </DialogDescription>
          </div>
          <DialogClose v-if="!hideClose" as-child>
            <button class="icon-btn dialog-close" aria-label="关闭">
              <X :size="15" :stroke-width="1.9" />
            </button>
          </DialogClose>
        </header>
        <div class="dialog-body">
          <slot />
        </div>
        <footer v-if="$slots.footer" class="dialog-footer">
          <slot name="footer" />
        </footer>
      </DialogContent>
    </DialogPortal>
  </DialogRoot>
</template>
