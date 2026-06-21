<script setup lang="ts">
import {
  adapterProxy,
  aggregateSearch,
  usePlayerStore,
  useSearchHistoryStore,
  useSourceStore,
  type VodDetail,
  type VodItem,
} from '@hplayer/core'
import { EmptyState, NavBar, SearchBar, SearchHistory, SearchResultList } from '@hplayer/ui'
import { closeToast, showToast } from 'vant'
import { computed, ref, watch } from 'vue'
import { useRouter } from 'vue-router'

const router = useRouter()
const sourceStore = useSourceStore()
const searchHistoryStore = useSearchHistoryStore()
const playerStore = usePlayerStore()

const keyword = ref('')
const mode = ref<'single' | 'aggregate'>('single')
const sourceName = computed(() => {
  if (mode.value !== 'single') return ''
  return sourceStore.activeSource?.name ?? ''
})
type SearchResult = VodItem & { sourceName?: string }
const items = ref<SearchResult[]>([])
const page = ref(1)
const finished = ref(false)
const loading = ref(false)
const searched = ref(false)
const VIRTUAL_LIST_THRESHOLD = 100
const enableVirtual = computed(
  () => mode.value === 'aggregate' && items.value.length > VIRTUAL_LIST_THRESHOLD,
)

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

// ▶ 直接播放：按 item.sourceId 找到对应视频源并取首集，支持单源/聚合搜索
async function onPlay(it: VodItem) {
  const source = sourceStore.list.find((s) => s.id === it.sourceId && s.enabled)
  if (!source) {
    showToast('未找到该视频对应的源')
    return
  }
  showToast({ type: 'loading', message: '加载中...', duration: 0, forbidClick: true })
  try {
    const detail: VodDetail = await adapterProxy.getDetail(source, it.id)
    const firstLine = detail.playFrom[0]
    const firstEp = firstLine ? detail.playList[firstLine.name]?.[0] : undefined
    if (!firstEp) {
      showToast('没有可播放的剧集')
      return
    }
    playerStore.setCurrent({ vod: detail, sourceId: source.id, episode: firstEp })
    router.push(`/player/${it.id}`)
  } catch (err) {
    console.error(err)
    showToast('加载失败，请重试')
  } finally {
    closeToast()
  }
}

watch(mode, () => {
  if (keyword.value) doSearch(keyword.value)
})
</script>

<template>
  <div class="search-page">
    <NavBar title="搜索" fixed placeholder :show-back="false" />
    <SearchBar v-model="keyword" v-model:mode="mode" :source-name="sourceName" @search="doSearch" />
    <!-- 搜索结果区域：仅此处可垂直滚动 -->
    <div class="search-content">
      <SearchHistory v-if="!searched" @select="onHistorySelect" />
      <SearchResultList
        v-else-if="items.length"
        :items="items"
        :source-name="sourceName"
        :loading="loading"
        :finished="finished"
        :enable-virtual="enableVirtual"
        @load="() => loadResults(keyword)"
        @refresh="() => loadResults(keyword, true)"
        @select="goDetail"
        @play="onPlay"
      />
      <EmptyState v-else-if="searched" text="无搜索结果" />
    </div>
  </div>
</template>

<style scoped>
.search-page {
  display: flex;
  flex-direction: column;
  height: 100vh;
  height: 100dvh;
  overflow: hidden;
}
.search-content {
  flex: 1 1 auto;
  min-height: 0;
  overflow-y: auto;
  overflow-x: hidden;
}
</style>
