<script setup lang="ts">
import { ref } from 'vue';
import { PullRefresh, List } from 'vant';
import type { VodItem } from '@hplayer/core';
import VodCard from './VodCard.vue';

defineProps<{
  items: VodItem[];
  sourceName?: string;
  loading: boolean;
  finished: boolean;
}>();

const emit = defineEmits<{
  (e: 'load'): void;
  (e: 'refresh'): void;
  (e: 'select', item: VodItem): void;
}>();

const refreshing = ref(false);

function onLoad() { emit('load'); }
function onRefresh() { emit('refresh'); }
</script>

<template>
  <PullRefresh v-model="refreshing" @refresh="onRefresh">
    <List :loading="loading" :finished="finished" finished-text="没有更多了" @load="onLoad">
      <div class="grid">
        <VodCard
          v-for="item in items"
          :key="`${item.sourceId}-${item.id}`"
          :item="item"
          :source-name="sourceName ?? ''"
          @click="(it: VodItem) => emit('select', it)"
        />
      </div>
    </List>
  </PullRefresh>
</template>

<style scoped>
.grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 12px;
  padding: 12px;
}
@media (min-width: 768px) {
  .grid { grid-template-columns: repeat(5, 1fr); }
}
@media (min-width: 1024px) {
  .grid { grid-template-columns: repeat(6, 1fr); max-width: 1200px; margin: 0 auto; }
}
</style>
