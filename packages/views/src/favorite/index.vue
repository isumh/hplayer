<script setup lang="ts">
import { type FavoriteItem, useFavoriteStore } from '@hplayer/core'
import { EmptyState, NavBar } from '@hplayer/ui'
import type { SwipeCellInstance } from 'vant'
import { Cell, SwipeCell, showConfirmDialog } from 'vant'
import { computed, onBeforeUnmount, onMounted } from 'vue'
import { useRouter } from 'vue-router'

const router = useRouter()
const store = useFavoriteStore()

// 时间倒序：最新收藏的在前
const list = computed<FavoriteItem[]>(() =>
  store.items.slice().sort((a, b) => b.createdAt - a.createdAt),
)

// SwipeCell 实例 Map：互斥关闭用
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

function openDetail(item: FavoriteItem) {
  router.push({ path: `/detail/${item.vod.id}`, query: { sourceId: item.sourceId } })
}

function remove(item: FavoriteItem) {
  store.remove(item.vod.id, item.sourceId)
}

async function clearAll() {
  if (!list.value.length) return
  const ok = await showConfirmDialog({
    title: '清空收藏',
    message: `确认清空所有 ${list.value.length} 条收藏？此操作不可恢复`,
  })
    .then(() => true)
    .catch(() => false)
  if (ok) {
    for (const i of list.value) {
      store.remove(i.vod.id, i.sourceId)
    }
  }
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
</script>

<template>
  <div class="fav-page">
    <NavBar
      title="收藏"
      :right-text="list.length ? '清空' : ''"
      @click-right="clearAll"
    />
    <EmptyState v-if="!list.length" text="暂无收藏" />
    <ul v-else class="list">
      <li v-for="item in list" :key="item.id" class="row-item">
        <SwipeCell :ref="bindRef(item.id)">
          <Cell center class="row" @click="openDetail(item)">
            <template #icon>
              <img class="cover" :src="item.vod.pic" :alt="item.vod.name" />
            </template>
            <template #title>
              <span class="name">{{ item.vod.name }}</span>
            </template>
            <template #label>
              <span class="sub">
                <template v-if="item.vod.remarks">{{ item.vod.remarks }} · </template>
                <span>{{ fmtTime(item.createdAt) }}</span>
              </span>
            </template>
          </Cell>
          <template #right>
            <button class="swipe-btn" type="button" @click="remove(item)">取消收藏</button>
          </template>
        </SwipeCell>
      </li>
    </ul>
  </div>
</template>

<style scoped>
.fav-page { padding-top: 46px; background: var(--van-background-2); min-height: 100vh; }
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
  width: 96px;
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
