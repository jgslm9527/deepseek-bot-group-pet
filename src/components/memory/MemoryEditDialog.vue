<script setup lang="ts">
import { reactive, watch } from 'vue'
import { useMemoryStore } from '@/stores/memory'
import { useUiStore } from '@/stores/ui'
import type { Memory } from '@/types'
import BaseDialog from '@/components/ui/BaseDialog.vue'

const props = defineProps<{
  open: boolean
  memory: Memory | null
}>()
const emit = defineEmits<{ (event: 'update:open', value: boolean): void }>()
const store = useMemoryStore()
const ui = useUiStore()

const form = reactive({
  summary: '',
  content: '',
  tags: '',
  importance: 3,
})
const saving = reactive({ value: false })

watch(
  () => [props.open, props.memory] as const,
  ([open, memory]) => {
    if (!open) return
    form.summary = memory?.summary ?? ''
    form.content = memory?.content ?? ''
    form.tags = memory?.tags.join('、') ?? ''
    form.importance = memory?.importance ?? 3
  },
  { immediate: true },
)

async function save() {
  if (!form.summary.trim() || !form.content.trim()) {
    ui.toast('无法保存', '摘要和记忆正文都不能为空。', 'error')
    return
  }
  saving.value = true
  try {
    const tags = form.tags
      .split(/[,，、\s]+/)
      .map((tag) => tag.trim())
      .filter(Boolean)
      .slice(0, 6)
    if (props.memory) {
      await store.edit(props.memory.id, {
        summary: form.summary.trim(),
        content: form.content.trim(),
        tags,
        importance: form.importance,
      })
    } else {
      await store.add({
        summary: form.summary.trim(),
        content: form.content.trim(),
        tags,
        importance: form.importance,
      })
    }
    ui.toast('记忆已保存', undefined, 'success')
    emit('update:open', false)
  } catch (error) {
    ui.toast('保存记忆失败', String(error), 'error')
  } finally {
    saving.value = false
  }
}
</script>

<template>
  <BaseDialog
    :open="open"
    :title="memory ? '编辑记忆' : '新增记忆'"
    description="记忆会作为普通文本存入本机 SQLite，仅在相关话题下被检索加载。"
    size="md"
    @update:open="emit('update:open', $event)"
  >
    <div class="form-stack">
      <label class="form-field">
        <span class="form-label">摘要</span>
        <input v-model="form.summary" class="input" maxlength="120" placeholder="一句话概括这条长期记忆" />
      </label>
      <label class="form-field">
        <span class="form-label">记忆正文</span>
        <textarea
          v-model="form.content"
          class="input !min-h-[120px]"
          placeholder="完整、长期有效的规则、参数、偏好或共识"
        />
      </label>
      <div class="form-grid-2">
        <label class="form-field">
          <span class="form-label">标签（逗号分隔）</span>
          <input v-model="form.tags" class="input" placeholder="项目约束, 偏好" />
        </label>
        <label class="form-field">
          <span class="form-label">重要度</span>
          <select v-model.number="form.importance" class="input">
            <option :value="1">1 · 很低</option>
            <option :value="2">2 · 较低</option>
            <option :value="3">3 · 普通</option>
            <option :value="4">4 · 重要</option>
            <option :value="5">5 · 关键</option>
          </select>
        </label>
      </div>
    </div>
    <template #footer>
      <button class="secondary-btn" @click="emit('update:open', false)">取消</button>
      <button class="primary-btn" :disabled="saving.value" @click="save">保存记忆</button>
    </template>
  </BaseDialog>
</template>
