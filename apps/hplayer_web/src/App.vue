<script setup lang="ts">
import { useHistoryStore, usePreviewStore, useSearchHistoryStore } from '@hplayer/core';
import { ImagePreview } from 'vant';
import { onBeforeUnmount, onMounted } from 'vue';

const historyStore = useHistoryStore();
const searchHistoryStore = useSearchHistoryStore();
const previewStore = usePreviewStore();

// 滚轮缩放：Vant 4 ImagePreview 默认不支持 mouse wheel zoom，
// 这里全局监听 wheel 事件 + 修改图片 transform 的 scale 部分（保留 translate 避免破坏双击/双指缩放的状态）
function onWheel(e: WheelEvent) {
  if (!previewStore.show) return;
  // 仅当 mouse 在图片预览内时才响应
  const target = e.target as HTMLElement | null;
  if (!target) return;
  if (!target.closest('.van-image-preview')) return;
  e.preventDefault();
  const delta = e.deltaY > 0 ? -0.1 : 0.1;
  const img =
    (target.closest('.van-image-preview__image') as HTMLElement | null) ??
    (document.querySelector('.van-image-preview__image') as HTMLElement | null);
  if (!img) return;
  const t = img.style.transform || '';
  // 提取 translate3d 中的 x/y 与 scale(x) 部分
  const txMatch = t.match(/translate3d\(\s*([-\d.]+)px\s*,\s*([-\d.]+)px/);
  const tx = txMatch?.[1] ?? '0';
  const ty = txMatch?.[2] ?? '0';
  const scMatch = t.match(/scale\(\s*([\d.]+)\s*\)/);
  const cur = scMatch ? parseFloat(scMatch[1] ?? '1') : 1;
  const next = Math.max(1, Math.min(3, Number.isFinite(cur) ? cur + delta : 1 + delta));
  // 重组 transform：保留平移 + 更新 scale
  img.style.transform = `translate3d(${tx}px, ${ty}px, 0) scale(${next})`;
}

function resetWheelScale() {
  const img = document.querySelector('.van-image-preview__image') as HTMLElement | null;
  if (img) img.style.transform = '';
}

onMounted(() => {
  historyStore.cleanup();
  searchHistoryStore.cleanup();
  window.addEventListener('wheel', onWheel, { passive: false });
});

onBeforeUnmount(() => {
  window.removeEventListener('wheel', onWheel);
});
</script>

<template>
  <router-view />
  <!-- 全局单例图片预览：closeOnClickImage/closeOnClickOverlay 控制点击关闭；doubleScale 启用双击/双指缩放 -->
  <ImagePreview
    v-model:show="previewStore.show"
    :images="previewStore.images"
    :start-position="previewStore.startIndex"
    closeable
    close-on-click-image
    close-on-click-overlay
    double-scale
    :max-zoom="3"
    @closed="resetWheelScale"
  />
</template>
