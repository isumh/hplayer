<script setup lang="ts">
import { useRouter } from 'vue-router'
import SourcePicker from '../business/SourcePicker.vue'

// 当前选中分类名（视频源无分类时为空字符串或 undefined）
defineProps<{ categoryName?: string | undefined }>()

const router = useRouter()
function openFavorites() {
  router.push('/favorite')
}
function openHistory() {
  router.push('/history')
}
</script>

<template>
  <header class="app-header">
    <div class="left">
      <span class="logo">▶</span>
      <span class="title">hplayer</span>
    </div>
    <div class="center">
      <SourcePicker :category-name="categoryName" />
    </div>
    <div class="right">
      <button class="icon-btn" @click="openFavorites" aria-label="收藏">★</button>
      <button class="icon-btn" @click="openHistory" aria-label="历史">🕒</button>
    </div>
  </header>
</template>

<style scoped>
/* 导出标题栏高度变量，供 SourcePicker 等 fixed 定位元素避让使用 */
:root {
  --app-header-height: calc(44px + constant(safe-area-inset-top));
  --app-header-height: calc(44px + env(safe-area-inset-top));
}
.app-header {
  display: flex;
  align-items: center;
  /* 最小高度 = 内容区 44px + 顶部安全区域，确保状态栏较高时内容不会被压缩溢出 */
  min-height: calc(44px + constant(safe-area-inset-top));
  min-height: calc(44px + env(safe-area-inset-top));
  padding: 0 12px;
  padding-top: constant(safe-area-inset-top);
  padding-top: env(safe-area-inset-top);
  background: var(--van-nav-bar-background);
  border-bottom: 1px solid var(--van-border-color);
  box-sizing: border-box;
  flex-shrink: 0;
}
.left { display: flex; align-items: center; gap: 6px; flex: 0 0 auto; }
.logo { color: var(--van-primary-color); font-size: 20px; }
.title { font-weight: 600; font-size: 16px; }
.center { flex: 1; display: flex; justify-content: center; min-width: 0; }
.right { display: flex; gap: 4px; flex: 0 0 auto; }
.icon-btn {
  background: none; border: none; padding: 6px;
  font-size: 18px; color: var(--van-text-color);
  cursor: pointer;
}
</style>
