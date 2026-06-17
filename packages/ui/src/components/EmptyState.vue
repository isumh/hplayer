<script setup lang="ts">
withDefaults(defineProps<{ text?: string; icon?: string }>(), {
  text: '暂无数据',
  icon: 'inbox-o',
});
</script>

<template>
  <div class="empty">
    <span class="icon">📭</span>
    <p class="text">{{ text }}</p>
  </div>
</template>

<style scoped>
.empty {
  display: flex; flex-direction: column; align-items: center;
  justify-content: center; padding: 60px 20px; gap: 12px;
  color: var(--van-text-color-2);
}
.icon { font-size: 48px; }
.text { margin: 0; font-size: 14px; }
</style>
