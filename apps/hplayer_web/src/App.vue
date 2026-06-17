<script setup lang="ts">
import { onMounted } from 'vue';

// TODO(P1): 启用 useHistoryStore / useSearchHistoryStore 的 5 天滑动窗口清理
// import { useHistoryStore, useSearchHistoryStore } from '@hplayer/core';
// const historyStore = useHistoryStore();
// const searchHistoryStore = useSearchHistoryStore();

onMounted(() => {
  // P0 占位：仅做主题初始化准备，正式清理逻辑在 P1 接入 store 后启用
  // historyStore.cleanup();
  // searchHistoryStore.cleanup();
});
</script>

<template>
  <router-view />
</template>
