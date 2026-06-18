<script setup lang="ts">
defineProps<{ count?: number }>();
</script>

<template>
  <!-- 横向分类栏骨架：n 个圆角矩形，与 CategoryBar 视觉一致 -->
  <div class="cat-skel">
    <div v-for="i in (count ?? 6)" :key="i" class="cat-skel__item" />
  </div>
</template>

<style scoped>
.cat-skel {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 10px 16px;
  overflow: hidden;
  background: var(--van-background);
  border-bottom: 1px solid var(--van-border-color);
}
.cat-skel__item {
  flex: 0 0 auto;
  width: 64px;
  height: 28px;
  border-radius: 14px;
  background: linear-gradient(90deg, #f2f3f5 25%, #e6e7eb 50%, #f2f3f5 75%);
  background-size: 200% 100%;
  animation: shimmer 1.4s ease-in-out infinite;
}
@keyframes shimmer {
  0% { background-position: 200% 0; }
  100% { background-position: -200% 0; }
}
</style>
