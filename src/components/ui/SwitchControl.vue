<script setup lang="ts">
import { SwitchRoot, SwitchThumb } from 'reka-ui'

withDefaults(
  defineProps<{
    modelValue: boolean
    disabled?: boolean
    label?: string
  }>(),
  { disabled: false, label: '' },
)

const emit = defineEmits<{
  (event: 'update:modelValue', value: boolean): void
}>()
</script>

<template>
  <SwitchRoot
    class="switch-root"
    :model-value="modelValue"
    :disabled="disabled"
    :aria-label="label || '切换'"
    @update:model-value="emit('update:modelValue', $event)"
  >
    <SwitchThumb class="switch-thumb" />
  </SwitchRoot>
</template>
