<script setup lang="ts">
withDefaults(defineProps<{ size?: number }>(), { size: 34 })
</script>

<template>
  <span
    class="user-avatar"
    :style="{ width: `${size}px`, height: `${size}px`, fontSize: `${Math.round(size * 0.34)}px` }"
  >我</span>
</template>

<style scoped>
.user-avatar {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex: 0 0 auto;
  border-radius: 33%;
  color: #fff;
  font-weight: 600;
  letter-spacing: 0.02em;
  background:
    radial-gradient(circle at 30% 18%, rgba(255, 255, 255, 0.4), transparent 44%),
    linear-gradient(145deg, #64748b, #334155 62%, #1e293b);
  border: 1px solid rgba(255, 255, 255, 0.23);
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.3), 0 2px 5px rgba(10, 18, 35, 0.14);
  user-select: none;
}
</style>
