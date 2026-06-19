import { defineStore } from 'pinia'
import { ref } from 'vue'
import type { FavoriteItem } from '../types/favorite'
import { STORAGE_KEYS, storage } from '../utils/storage'

function uuid(): string {
  return `fav-${Math.random().toString(36).slice(2, 11)}${Date.now().toString(36)}`
}

export const useFavoriteStore = defineStore('favorite', () => {
  const items = ref<FavoriteItem[]>(storage.get<FavoriteItem[]>(STORAGE_KEYS.favorites, []))

  function persist(): void {
    storage.set(STORAGE_KEYS.favorites, items.value)
  }

  function isFavorited(vodId: string, sourceId: string): boolean {
    return items.value.some((i) => i.vod.id === vodId && i.sourceId === sourceId)
  }

  function add(item: Omit<FavoriteItem, 'id' | 'createdAt'>): void {
    if (isFavorited(item.vod.id, item.sourceId)) return
    items.value.unshift({ ...item, id: uuid(), createdAt: Date.now() })
    persist()
  }

  function remove(vodId: string, sourceId: string): void {
    items.value = items.value.filter((i) => !(i.vod.id === vodId && i.sourceId === sourceId))
    persist()
  }

  function toggle(item: Omit<FavoriteItem, 'id' | 'createdAt'>): boolean {
    if (isFavorited(item.vod.id, item.sourceId)) {
      remove(item.vod.id, item.sourceId)
      return false
    }
    add(item)
    return true
  }

  return { items, isFavorited, add, remove, toggle }
})
