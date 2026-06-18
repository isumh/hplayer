import { defineStore } from 'pinia'
import { ref } from 'vue'
import type { SearchHistoryItem } from '../types/search'
import { STORAGE_KEYS, storage } from '../utils/storage'
import { isExpired } from '../utils/time'

export const useSearchHistoryStore = defineStore('search-history', () => {
  const items = ref<SearchHistoryItem[]>(
    storage.get<SearchHistoryItem[]>(STORAGE_KEYS.searchHistory, []),
  )

  function persist(): void {
    storage.set(STORAGE_KEYS.searchHistory, items.value)
  }

  function cleanup(): void {
    const before = items.value.length
    items.value = items.value.filter((i) => !isExpired(i.lastAccessTime))
    if (items.value.length !== before) persist()
  }

  function touch(keyword: string): void {
    const trimmed = keyword.trim()
    if (!trimmed) return
    const idx = items.value.findIndex((i) => i.keyword === trimmed)
    const lastAccessTime = Date.now()
    if (idx !== -1) {
      items.value[idx]!.lastAccessTime = lastAccessTime
    } else {
      items.value.unshift({ keyword: trimmed, lastAccessTime })
    }
    persist()
  }

  function remove(keyword: string): void {
    items.value = items.value.filter((i) => i.keyword !== keyword)
    persist()
  }

  function clear(): void {
    items.value = []
    persist()
  }

  return { items, cleanup, touch, remove, clear }
})
