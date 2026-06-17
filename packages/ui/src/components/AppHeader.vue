<script setup lang="ts">
import SourcePicker from '../business/SourcePicker.vue';

function openFavorites() {
  // 由 router 注入
}
function openHistory() {
  // 由 router 注入
}
</script>

<template>
  <header class="app-header">
    <div class="left">
      <span class="logo">▶</span>
      <span class="title">hplayer</span>
    </div>
    <div class="center">
      <SourcePicker />
    </div>
    <div class="right">
      <button class="icon-btn" @click="openFavorites" aria-label="收藏">★</button>
      <button class="icon-btn" @click="openHistory" aria-label="历史">🕒</button>
    </div>
  </header>
</template>

<style scoped>
.app-header {
  display: flex;
  align-items: center;
  height: 44px;
  padding: 0 12px;
  background: var(--van-nav-bar-background);
  border-bottom: 1px solid var(--van-border-color);
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
