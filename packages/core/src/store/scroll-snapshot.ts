import { defineStore } from 'pinia'
import { ref } from 'vue'
import type { VodItem } from '../types/vod'

/**
 * 列表页（首页 / 搜索页）从播放页返回时的滚动位置 + 列表数据快照。
 *
 * 背景：
 * - /player/:id 是顶级路由，进入播放会卸载 TabLayout，连带卸载 home/search 组件。
 * - 返回时组件重新 onMounted，会重新拉取分类 + 列表第 1 页，丢失滚动位置。
 *
 * 设计：
 * - 用 Map<key, entry> 存每次离开时的快照，key 形如 "home" 或 "search?keyword=foo&mode=aggregate"。
 * - 30 分钟 TTL：避免隔夜 / 长时间后返回仍跳到旧位置。
 * - take 不删除快照：用户可多次进入播放再返回。
 * - clear 由调用方在主动失效场景触发（切源 / 切分类 / 下拉刷新 / 换关键词）。
 */
export const SCROLL_SNAPSHOT_TTL_MS = 30 * 60 * 1000

export interface ScrollSnapshot {
  items: VodItem[]
  page: number
  finished: boolean
  scrollTop: number
  /** 首页恢复时还原分类选中状态。 */
  categoryId?: string | number
  /** 搜索页恢复时还原关键词 + 模式。 */
  keyword?: string
  mode?: 'single' | 'aggregate'
}

interface SnapshotEntry {
  snapshot: ScrollSnapshot
  savedAt: number
}

export const useScrollSnapshotStore = defineStore('scroll-snapshot', () => {
  // 用 ref<Map> 让 HMR / DevTools 可见；外部不直接消费其响应性
  const entries = ref<Map<string, SnapshotEntry>>(new Map())

  function save(key: string, snapshot: ScrollSnapshot): void {
    if (!key) return
    // 重新构造 Map 以触发响应性（避免 in-place set 不更新）
    const next = new Map(entries.value)
    next.set(key, { snapshot, savedAt: Date.now() })
    entries.value = next
  }

  function take(key: string): ScrollSnapshot | null {
    const entry = entries.value.get(key)
    if (!entry) return null
    if (Date.now() - entry.savedAt > SCROLL_SNAPSHOT_TTL_MS) {
      // 过期惰性删除
      const next = new Map(entries.value)
      next.delete(key)
      entries.value = next
      return null
    }
    return entry.snapshot
  }

  function clear(key: string): void {
    if (!entries.value.has(key)) return
    const next = new Map(entries.value)
    next.delete(key)
    entries.value = next
  }

  function clearAll(): void {
    if (entries.value.size === 0) return
    entries.value = new Map()
  }

  return { save, take, clear, clearAll }
})
