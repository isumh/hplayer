import { defineStore } from 'pinia'
import { ref } from 'vue'
import type { HistoryItem } from '../types/history'
import { STORAGE_KEYS, storage } from '../utils/storage'
import { isExpired } from '../utils/time'

function uuid(): string {
  return `his-${Math.random().toString(36).slice(2, 11)}${Date.now().toString(36)}`
}

export const useHistoryStore = defineStore('history', () => {
  const items = ref<HistoryItem[]>(storage.get<HistoryItem[]>(STORAGE_KEYS.history, []))

  function persist(): void {
    storage.set(STORAGE_KEYS.history, items.value)
  }

  function cleanup(): void {
    const before = items.value.length
    items.value = items.value.filter((i) => !isExpired(i.lastWatchTime))
    if (items.value.length !== before) persist()
  }

  function touch(item: Omit<HistoryItem, 'id' | 'lastWatchTime'>): void {
    const key = `${item.sourceId}::${item.vod.id}::${item.episode?.url ?? ''}`
    const existing = items.value.find(
      (i) => `${i.sourceId}::${i.vod.id}::${i.episode?.url ?? ''}` === key,
    )
    const lastWatchTime = Date.now()
    if (existing) {
      Object.assign(existing, item, { lastWatchTime })
    } else {
      items.value.unshift({ ...item, id: uuid(), lastWatchTime })
    }
    persist()
  }

  function remove(id: string): void {
    items.value = items.value.filter((i) => i.id !== id)
    persist()
  }

  function clear(): void {
    items.value = []
    persist()
  }

  return { items, cleanup, touch, remove, clear }
})
