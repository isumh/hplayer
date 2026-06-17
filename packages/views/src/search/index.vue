<script setup lang="ts">
import { ref, watch } from 'vue';
import { useRouter } from 'vue-router';
import { VodList, SearchBar, SearchHistory, EmptyState } from '@hplayer/ui';
import {
  useSourceStore,
  useSearchHistoryStore,
  adapterProxy,
  aggregateSearch,
  type VodItem,
} from '@hplayer/core';

const router = useRouter();
const sourceStore = useSourceStore();
const searchHistoryStore = useSearchHistoryStore();

const keyword = ref('');
const mode = ref<'single' | 'aggregate'>('aggregate');
type SearchResult = VodItem & { sourceName?: string };
const items = ref<SearchResult[]>([]);
const page = ref(1);
const finished = ref(false);
const loading = ref(false);
const searched = ref(false);

async function doSearch(kw: string) {
  const trimmed = kw.trim();
  if (!trimmed) return;
  searchHistoryStore.touch(trimmed);
  await loadResults(trimmed, true);
}

async function loadResults(kw: string, reset = false) {
  if (!kw) return;
  searched.value = true;
  loading.value = true;
  try {
    const targetPage = reset ? 1 : page.value;
    if (mode.value === 'single') {
      const src = sourceStore.activeSource;
      if (!src) {
        finished.value = true;
        items.value = [];
        return;
      }
      const res = await adapterProxy.search(src, { keyword: kw, page: targetPage });
      const mapped = res.list.map((it) => ({ ...it, sourceName: src.name }));
      items.value = reset ? mapped : items.value.concat(mapped);
      finished.value = targetPage >= res.pageCount;
    } else {
      const res = await aggregateSearch(sourceStore.list, {
        keyword: kw,
        page: targetPage,
      });
      items.value = reset ? res.list : items.value.concat(res.list);
      finished.value = res.list.length === 0;
    }
    page.value = targetPage + 1;
  } finally {
    loading.value = false;
  }
}

function onHistorySelect(kw: string) {
  keyword.value = kw;
  doSearch(kw);
}

function goDetail(it: VodItem) {
  router.push({ path: `/detail/${it.id}`, query: { sourceId: it.sourceId } });
}

watch(mode, () => {
  if (keyword.value) doSearch(keyword.value);
});
</script>

<template>
  <div class="search-page">
    <SearchBar v-model="keyword" v-model:mode="mode" @search="doSearch" />
    <SearchHistory v-if="!searched" @select="onHistorySelect" />
    <VodList
      v-else-if="items.length"
      :items="items"
      :source-name="(mode === 'single' ? sourceStore.activeSource?.name : '') ?? ''"
      :loading="loading"
      :finished="finished"
      @load="() => loadResults(keyword)"
      @refresh="() => loadResults(keyword, true)"
      @select="goDetail"
    />
    <EmptyState v-else-if="searched" text="无搜索结果" />
  </div>
</template>

<style scoped>
.search-page { display: flex; flex-direction: column; min-height: 100%; }
</style>
