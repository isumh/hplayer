<script setup lang="ts">
import { useSearchHistoryStore } from '@hplayer/core';
import { Dialog, Tag } from 'vant';

const store = useSearchHistoryStore();
const emit = defineEmits<(e: 'select', keyword: string) => void>();

async function clearAll() {
  const confirmed = await Dialog.confirm({
    title: '清空搜索历史',
    message: '确认删除所有搜索历史？',
  })
    .then(() => true)
    .catch(() => false);
  if (confirmed) store.clear();
}

function removeOne(keyword: string) {
  store.remove(keyword);
}
</script>

<template>
  <div class="search-history" v-if="store.items.length">
    <div class="header">
      <span>搜索历史</span>
      <button class="clear-btn" @click="clearAll">全部删除</button>
    </div>
    <div class="tags">
      <Tag
        v-for="item in store.items"
        :key="item.keyword"
        closeable
        @click="emit('select', item.keyword)"
        @close="removeOne(item.keyword)"
        class="tag"
      >
        {{ item.keyword }}
      </Tag>
    </div>
  </div>
</template>

<style scoped>
.search-history { padding: 12px; }
.header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px; }
.clear-btn { background: none; border: none; color: var(--van-text-color-2); font-size: 12px; cursor: pointer; }
.tags { display: flex; flex-wrap: wrap; gap: 6px; }
.tag { cursor: pointer; }
</style>
