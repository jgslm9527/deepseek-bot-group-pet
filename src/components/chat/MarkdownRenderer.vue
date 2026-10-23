<script setup lang="ts">
import { computed, ref } from 'vue'
import { renderMarkdown } from '@/lib/markdown'

const props = defineProps<{ content: string }>()
const root = ref<HTMLElement | null>(null)
const html = computed(() => renderMarkdown(props.content))

async function onClick(event: MouseEvent) {
  const target = event.target as HTMLElement | null
  const button = target?.closest<HTMLButtonElement>('.md-copy')
  if (!button) return
  const code = button.closest('.md-code')?.querySelector('code')?.textContent ?? ''
  try {
    await navigator.clipboard.writeText(code)
    const previous = button.textContent
    button.textContent = '已复制'
    setTimeout(() => {
      button.textContent = previous ?? '复制'
    }, 1400)
  } catch {
    button.textContent = '复制失败'
    setTimeout(() => {
      button.textContent = '复制'
    }, 1400)
  }
}
</script>

<template>
  <div ref="root" class="markdown-body" @click="onClick" v-html="html" />
</template>
