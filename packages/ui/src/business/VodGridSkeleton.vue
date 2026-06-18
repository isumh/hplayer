<script setup lang="ts">
import { Skeleton } from 'vant'

defineProps<{ count?: number }>()
</script>

<template>
  <!-- 视频列表网格骨架：n 张 1:1.4 比例卡片，每张含图片 + 2 行文字 -->
  <div class="grid-skel">
    <div v-for="i in (count ?? 6)" :key="i" class="grid-skel__card">
      <Skeleton
        :loading="true"
        :row="2"
        :row-width="['90%', '60%']"
        :title="false"
        avatar
        avatar-size="100%"
        avatar-shape="square"
        class="grid-skel__skel"
      />
    </div>
  </div>
</template>

<style scoped>
/* 与 VodList 的 grid 保持完全一致：3 列 / ≥768 5 列 / ≥1024 6 列 + 居中 */
.grid-skel {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 12px;
  padding: 12px;
}
@media (min-width: 768px) {
  .grid-skel { grid-template-columns: repeat(5, 1fr); }
}
@media (min-width: 1024px) {
  .grid-skel { grid-template-columns: repeat(6, 1fr); max-width: 1200px; margin: 0 auto; }
}
.grid-skel__card {
  /* 与 VodCard 1:1.4 封面比例保持一致，骨架高度随之撑开 */
  aspect-ratio: 1 / 1.4;
  border-radius: 8px;
  overflow: hidden;
  min-width: 80px;
}
.grid-skel__skel { width: 100%; height: 100%; }
:deep(.van-skeleton__avatar) { width: 100% !important; height: 70% !important; }
</style>
