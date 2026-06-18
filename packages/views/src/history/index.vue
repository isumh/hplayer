<script setup lang="ts">
import {
  adapterProxy,
  type HistoryItem,
  useHistoryStore,
  usePlayerStore,
  useSourceStore,
  type VodDetail,
} from '@hplayer/core'
import { EmptyState, NavBar } from '@hplayer/ui'
import type { SwipeCellInstance } from 'vant'
import { Cell, closeToast, SwipeCell, showConfirmDialog, showToast } from 'vant'
import { computed, onBeforeUnmount, onMounted } from 'vue'
import { useRouter } from 'vue-router'

const router = useRouter()
const store = useHistoryStore()
const sourceStore = useSourceStore()
const playerStore = usePlayerStore()

// 时间倒序：最近观看的在前
const list = computed<HistoryItem[]>(() =>
  store.items.slice().sort((a, b) => b.lastWatchTime - a.lastWatchTime),
)

// SwipeCell 实例 Map：互斥关闭
const cells = new Map<string, SwipeCellInstance>()
function bindRef(id: string) {
  return (el: unknown) => {
    const inst = el as SwipeCellInstance | null
    if (inst) cells.set(id, inst)
    else cells.delete(id)
  }
}

function isInsideAnyCell(target: EventTarget | null): boolean {
  if (!(target instanceof Node)) return false
  for (const inst of cells.values()) {
    const el = (inst as unknown as { $el?: HTMLElement }).$el
    if (el && el.contains(target)) return true
  }
  return false
}

function closeAllCells() {
  for (const inst of cells.values()) inst?.close('right')
}

function onDocClick(e: MouseEvent) {
  if (!isInsideAnyCell(e.target)) closeAllCells()
}

onMounted(() => document.addEventListener('click', onDocClick))
onBeforeUnmount(() => document.removeEventListener('click', onDocClick))

function remove(item: HistoryItem) {
  store.remove(item.id)
}

async function clearAll() {
  if (!list.value.length) return
  const ok = await showConfirmDialog({
    title: '清空历史',
    message: `确认清空所有 ${list.value.length} 条观看历史？此操作不可恢复`,
  })
    .then(() => true)
    .catch(() => false)
  if (ok) store.clear()
}

function fmtTime(ts: number): string {
  const d = new Date(ts)
  const now = new Date()
  const diffDay = Math.floor((now.getTime() - d.getTime()) / 86_400_000)
  if (diffDay === 0) return `今天 ${d.getHours()}:${String(d.getMinutes()).padStart(2, '0')}`
  if (diffDay === 1) return '昨天'
  if (diffDay < 7) return `${diffDay} 天前`
  return d.toLocaleDateString()
}

function fmtProgress(progress: number, duration?: number): string {
  const fmt = (sec: number) => {
    const m = Math.floor(sec / 60)
    const s = Math.floor(sec % 60)
    return `${m}:${String(s).padStart(2, '0')}`
  }
  if (duration && duration > 0) {
    return `已看 ${fmt(progress)} / ${fmt(duration)}`
  }
  return `已看 ${fmt(progress)}`
}

// 点击主体：跳播放页 + 续播（progress-10秒）
async function resume(item: HistoryItem) {
  const source = sourceStore.list.find((s) => s.id === item.sourceId)
  if (!source) {
    showToast('视频源已不存在')
    return
  }
  if (!item.episode) {
    showToast('该记录无剧集信息')
    return
  }
  showToast({ type: 'loading', message: '加载中...', duration: 0, forbidClick: true })
  try {
    const detail: VodDetail = await adapterProxy.getDetail(source, item.vod.id)
    // 校验剧集 URL 是否仍在播放列表中
    const allEps = Object.values(detail.playList).flat()
    const epExists = allEps.some((e) => e.url === item.episode?.url)
    if (!epExists) {
      showToast('该剧集已失效')
      return
    }
    // 续播：上次位置往前回 10 秒，下界 0
    const startAt = Math.max(0, (item.progress ?? 0) - 10)
    playerStore.setCurrent({
      vod: detail,
      sourceId: item.sourceId,
      episode: item.episode,
      startAt,
    })
    router.push({
      path: `/player/${item.vod.id}`,
      query: { sourceId: item.sourceId, ep: item.episode.url },
    })
  } catch (err) {
    console.error(err)
    showToast('加载失败，请重试')
  } finally {
    closeToast()
  }
}
</script>

<template>
  <div class="hist-page">
    <NavBar
      title="历史"
      :right-text="list.length ? '清空' : ''"
      @click-right="clearAll"
    />
    <EmptyState v-if="!list.length" text="暂无历史" />
    <ul v-else class="list">
      <li v-for="item in list" :key="item.id" class="row-item">
        <SwipeCell :ref="bindRef(item.id)">
          <Cell center class="row" @click="resume(item)">
            <template #icon>
              <img class="cover" :src="item.vod.pic" :alt="item.vod.name" />
            </template>
            <template #title>
              <span class="name">{{ item.vod.name }}</span>
            </template>
            <template #label>
              <span class="sub">
                {{ item.episode?.name || '未选集' }} · {{ fmtTime(item.lastWatchTime) }} ·
                {{ fmtProgress(item.progress, item.duration) }}
              </span>
            </template>
          </Cell>
          <template #right>
            <button class="swipe-btn" type="button" @click="remove(item)">删除</button>
          </template>
        </SwipeCell>
      </li>
    </ul>
  </div>
</template>

<style scoped>
.hist-page { padding-top: 46px; background: var(--van-background-2); min-height: 100vh; }
.list { list-style: none; padding: 0; margin: 0; }
.row-item + .row-item { border-top: 1px solid var(--van-border-color); }
.row { padding: 10px 12px; cursor: pointer; }
.cover {
  width: 60px; height: 80px; object-fit: cover; border-radius: 4px;
  margin-right: 12px; flex-shrink: 0;
}
.name { font-size: 14px; font-weight: 500; }
.sub { font-size: 12px; color: var(--van-text-color-2); }
.swipe-btn {
  height: 100%;
  width: 80px;
  background: var(--van-danger-color);
  color: #fff;
  border: none;
  font-size: 14px;
  cursor: pointer;
}
.swipe-btn:active { opacity: 0.85; }

/* 给 NavBar 右侧"清空"按钮加边框：穿透 Vant NavBar 的 .van-nav-bar__text */
:deep(.van-nav-bar__text) {
  display: inline-block;
  padding: 2px 10px;
  margin-right: 8px;
  border: 1px solid currentColor;
  border-radius: 4px;
  font-size: 13px;
}
</style>
