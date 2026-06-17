<script setup lang="ts">
import type { Category } from '@hplayer/core';
import { ref } from 'vue';

defineProps<{ items: Category[] }>();
const emit = defineEmits<(e: 'select', cat: Category) => void>();
const activeId = ref<string | number | null>(null);

function pick(c: Category) {
  activeId.value = c.id;
  emit('select', c);
}
</script>

<template>
  <div class="cat-bar">
    <button
      v-for="c in items"
      :key="c.id"
      :class="['cat-item', { active: c.id === activeId }]"
      @click="pick(c)"
    >
      {{ c.name }}
    </button>
  </div>
</template>

<style scoped>
.cat-bar {
  display: flex; gap: 6px; padding: 8px 12px;
  overflow-x: auto; white-space: nowrap;
  background: var(--van-background);
  border-bottom: 1px solid var(--van-border-color);
}
.cat-item {
  flex: 0 0 auto;
  padding: 6px 14px; border-radius: 16px;
  background: var(--van-background-2);
  color: var(--van-text-color);
  border: none; font-size: 13px; cursor: pointer;
}
.cat-item.active { background: var(--van-primary-color); color: white; }
</style>
