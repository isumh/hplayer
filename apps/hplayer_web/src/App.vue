<script setup lang="ts">
import { onMounted } from 'vue';
import { useHistoryStore, useSearchHistoryStore } from '@hplayer/core';

const historyStore = useHistoryStore();
const searchHistoryStore = useSearchHistoryStore();

onMounted(() => {
  historyStore.cleanup();
  searchHistoryStore.cleanup();
});
</script>

<template>
  <router-view />
</template>
