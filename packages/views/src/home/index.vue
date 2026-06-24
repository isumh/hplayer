<script setup lang="ts">
import {
  adapterProxy,
  type Category,
  filterCategoriesByReserved,
  usePlayerStore,
  useScrollSnapshotStore,
  useSourceStore,
  type VodDetail,
  type VodItem,
} from '@hplayer/core'
import {
  AppHeader,
  CategoryBar,
  CategoryBarSkeleton,
  EmptyState,
  VodGridSkeleton,
  VodList,
} from '@hplayer/ui'
import { closeToast, showToast } from 'vant'
import { computed, nextTick, onMounted, ref, watch } from 'vue'
import { onBeforeRouteLeave, useRouter } from 'vue-router'

const router = useRouter()
const sourceStore = useSourceStore()
const playerStore = usePlayerStore()
const scrollSnapshot = useScrollSnapshotStore()

const SNAPSHOT_KEY = 'home'

const categories = ref<Category[]>([])
// 选中的分类 ID（用于 v-model 绑定到 CategoryBar）
const activeCategoryId = ref<string | number | null>(null)
const activeCategory = ref<Category | null>(null)
// 列表滚动容器 ref（用于离开时记录 scrollTop / 回来时还原）
const contentRef = ref<HTMLElement | null>(null)

// 无分类视频源时的默认分类，固定使用 categoryId = '0' 加载全部视频
const DEFAULT_CATEGORY = (sourceId: string): Category => ({ id: '0', name: '全部', sourceId })
const items = ref<VodItem[]>([])
const page = ref(1)
const loading = ref(false)
const finished = ref(false)
// 错误状态：用于区分"无源"和"加载失败"两种空态
const error = ref<string | null>(null)

async function loadCategories() {
  // 无源时不报错（路由守卫已拦截），直接返回
  if (!sourceStore.activeSource) {
    error.value = null
    return
  }
  error.value = null
  try {
    const all = await adapterProxy.getCategories(sourceStore.activeSource)
    // 按视频源配置的"保留分类"过滤（按名称不区分大小写精确匹配）
    const list = filterCategoriesByReserved(all, sourceStore.activeSource.reservedCategories)
    categories.value = list

    // 优先尝试从快照恢复（从播放页返回场景）
    const snap = scrollSnapshot.take(SNAPSHOT_KEY)
    if (snap && snap.items.length > 0) {
      items.value = snap.items
      page.value = snap.page
      finished.value = snap.finished
      // 恢复分类选中（如果该分类在保留过滤后仍存在）
      if (snap.categoryId != null) {
        const found = list.find((c) => c.id === snap.categoryId)
        if (found) {
          activeCategory.value = found
          activeCategoryId.value = found.id
        } else {
          // 快照中的分类已被过滤掉，回退到第一个
          const first = list[0] ?? DEFAULT_CATEGORY(sourceStore.activeSource.id)
          activeCategory.value = first
          activeCategoryId.value = first.id
        }
      } else {
        const first = list[0]
        if (first) {
          activeCategory.value = first
          activeCategoryId.value = first.id
        }
      }
      // 等 DOM 渲染完再恢复 scrollTop（虚拟列表 + 图片占位可能更晚）
      await nextTick()
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          if (contentRef.value) contentRef.value.scrollTop = snap.scrollTop
        })
      })
      setTimeout(() => {
        if (contentRef.value) contentRef.value.scrollTop = snap.scrollTop
      }, 80)
      return
    }

    if (list.length) {
      // 有分类：默认选中第一个（如已选过，保持现状并同步对象）
      if (activeCategoryId.value == null) {
        const first = list[0]
        if (first) {
          activeCategoryId.value = first.id
          activeCategory.value = first
          await loadList(true)
        }
      } else {
        const found = list.find((c) => c.id === activeCategoryId.value)
        if (found) activeCategory.value = found
      }
    } else {
      // 无分类：使用默认 categoryId = '0' 加载全部视频
      activeCategory.value = DEFAULT_CATEGORY(sourceStore.activeSource.id)
      activeCategoryId.value = '0'
      await loadList(true)
    }
  } catch (err) {
    console.error(err)
    error.value = '加载分类失败'
    showToast('加载失败，请检查网络或视频源')
  }
}

async function loadList(reset = false) {
  if (!sourceStore.activeSource || !activeCategory.value) return
  loading.value = true
  // 仅"上滑分页"时（reset=false）弹 loading Toast；首次加载/重置时由骨架屏承担占位
  const isPaginate = !reset
  if (isPaginate) {
    showToast({ type: 'loading', message: '加载中...', duration: 0, forbidClick: true })
  }
  // 下拉刷新 / 切分类后的重置 = 用户期望从顶重新浏览，清掉旧快照
  if (reset) scrollSnapshot.clear(SNAPSHOT_KEY)
  try {
    const ps = sourceStore.activeSource.pageSize ?? 20
    const targetPage = reset ? 1 : page.value
    const res = await adapterProxy.getList(sourceStore.activeSource, {
      categoryId: activeCategory.value.id,
      page: targetPage,
      pageSize: ps,
    })
    if (reset) {
      items.value = res.list
      page.value = 1
    } else {
      items.value = items.value.concat(res.list)
    }
    finished.value = targetPage >= res.pageCount
    if (!finished.value) page.value = targetPage + 1
  } catch (err) {
    console.error(err)
    error.value = '加载列表失败'
    showToast('加载失败，请检查网络或视频源')
  } finally {
    loading.value = false
    if (isPaginate) closeToast()
  }
}

function onCategorySelect(c: Category) {
  // 切换分类 = 用户期望从该分类的顶部开始，旧快照失效
  scrollSnapshot.clear(SNAPSHOT_KEY)
  activeCategory.value = c
  activeCategoryId.value = c.id
  finished.value = false
  items.value = []
  loadList(true)
}

function goDetail(it: VodItem) {
  router.push({ path: `/detail/${it.id}`, query: { sourceId: it.sourceId } })
}

// ▶ 直接播放：调 getDetail 拿首个 episode → 跳 player
async function onPlay(it: VodItem) {
  const source = sourceStore.activeSource
  if (!source) {
    showToast('请先选择视频源')
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

function retry() {
  error.value = null
  loadCategories()
}

function goAddSource() {
  router.push('/settings/source/add')
}

// 渲染判断：基于"业务数据存在性"而非 loading ref（避免分类未加载完时骨架不显示）
const showCatSkeleton = computed(() => !categories.value.length && !error.value)
const showGridSkeleton = computed(() => !items.value.length && !error.value)

// 三种空态：加载失败 / 有源但无数据 / 无源
const emptyText = computed(() => {
  if (error.value) return error.value
  if (sourceStore.activeSource) return '暂无内容'
  return '请先在设置中添加视频源'
})

onMounted(loadCategories)

// 切源 = 旧源列表/滚动位置全部失效
watch(
  () => sourceStore.activeSourceId,
  () => {
    scrollSnapshot.clear(SNAPSHOT_KEY)
    activeCategory.value = null
    activeCategoryId.value = null
    items.value = []
    error.value = null
    loadCategories()
  },
)

// 离开当前路由（进入 /player 或 /detail）时保存列表 + 滚动位置
onBeforeRouteLeave((to) => {
  if (!to.path.startsWith('/player') && !to.path.startsWith('/detail')) return
  if (items.value.length === 0) return
  // 条件展开避免在 exactOptionalPropertyTypes 下塞 undefined
  const catId = activeCategoryId.value ?? undefined
  scrollSnapshot.save(SNAPSHOT_KEY, {
    items: items.value,
    page: page.value,
    finished: finished.value,
    scrollTop: contentRef.value?.scrollTop ?? 0,
    ...(catId !== undefined ? { categoryId: catId } : {}),
  })
})
</script>

<template>
  <div class="home">
    <AppHeader :category-name="activeCategory?.name" />

    <!-- 分类栏：已加载显示真实，未加载显示骨架 -->
    <CategoryBar
      v-if="categories.length"
      :items="categories"
      v-model:active-id="activeCategoryId"
      @select="onCategorySelect"
    />
    <CategoryBarSkeleton v-else-if="showCatSkeleton" />

    <!-- 视频列表区域：仅此处可垂直滚动 -->
    <div ref="contentRef" class="home-content">
      <!-- 视频列表骨架（首次/重置时占位，分页时由 Toast 提示） -->
      <VodGridSkeleton v-if="showGridSkeleton" />

      <VodList
        v-else-if="items.length"
        :items="items"
        :loading="loading"
        :finished="finished"
        @load="() => loadList()"
        @refresh="() => loadList(true)"
        @select="goDetail"
        @play="onPlay"
      />

      <EmptyState v-else :text="emptyText">
        <button v-if="error" class="empty-btn" @click="retry">重试</button>
        <button v-else-if="!sourceStore.activeSource" class="empty-btn" @click="goAddSource">
          去添加
        </button>
      </EmptyState>
    </div>
  </div>
</template>

<style scoped>
.home {
  display: flex;
  flex-direction: column;
  height: 100vh;
  height: 100dvh;
  overflow: hidden;
}
.home-content {
  flex: 1 1 auto;
  min-height: 0;
  overflow-y: auto;
  overflow-x: hidden;
}
.empty-btn {
  padding: 8px 24px;
  background: var(--van-primary-color);
  color: #fff;
  border: none;
  border-radius: 8px;
  font-size: 14px;
  cursor: pointer;
}
.empty-btn:active { opacity: 0.8; }
</style>
