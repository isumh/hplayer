<script setup lang="ts">
import {
  adapterProxy,
  aggregateSearch,
  useSearchHistoryStore,
  useSourceStore,
  type VodItem,
} from '@hplayer/core'
import { EmptyState, SearchBar, SearchHistory, VodList } from '@hplayer/ui'
import { closeToast, showToast } from 'vant'
import { ref, watch } from 'vue'
import { useRouter } from 'vue-router'

const router = useRouter()
const sourceStore = useSourceStore()
const searchHistoryStore = useSearchHistoryStore()

const keyword = ref('')
const mode = ref<'single' | 'aggregate'>('single')
type SearchResult = VodItem & { sourceName?: string }
const items = ref<SearchResult[]>([])
const page = ref(1)
const finished = ref(false)
const loading = ref(false)
const searched = ref(false)

async function doSearch(kw: string) {
  const trimmed = kw.trim()
  if (!trimmed) return
  searchHistoryStore.touch(trimmed)
  await loadResults(trimmed, true)
}

async function loadResults(kw: string, reset = false) {
  if (!kw) return
  searched.value = true
  loading.value = true
  // 仅"上滑分页"时（reset=false）弹 loading Toast
  const isPaginate = !reset
  if (isPaginate) {
    showToast({ type: 'loading', message: '加载中...', duration: 0, forbidClick: true })
  }
  try {
    const targetPage = reset ? 1 : page.value
    if (mode.value === 'single') {
      const src = sourceStore.activeSource
      if (!src) {
        finished.value = true
        items.value = []
        return
      }
      const res = await adapterProxy.search(src, { keyword: kw, page: targetPage })
      const mapped = res.list.map((it) => ({ ...it, sourceName: src.name }))
      items.value = reset ? mapped : items.value.concat(mapped)
      finished.value = targetPage >= res.pageCount
    } else {
      const res = await aggregateSearch(sourceStore.list, {
        keyword: kw,
        page: targetPage,
      })
      items.value = reset ? res.list : items.value.concat(res.list)
      finished.value = res.list.length === 0
    }
    page.value = targetPage + 1
  } finally {
    loading.value = false
    if (isPaginate) closeToast()
  }
}

function onHistorySelect(kw: string) {
  keyword.value = kw
  doSearch(kw)
}

function goDetail(it: VodItem) {
  router.push({ path: `/detail/${it.id}`, query: { sourceId: it.sourceId } })
}

watch(mode, () => {
  if (keyword.value) doSearch(keyword.value)
})
</script>

<template>
  <div class="search-page">
    <SearchBar v-model="keyword" v-model:mode="mode" :source-name="sourceStore.activeSource?.name ?? ''" @search="doSearch" />
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
