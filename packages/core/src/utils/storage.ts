import { createLocalStorageAdapter, type StorageAdapter } from './storage-local'

/**
 * 类型安全的存储封装。
 * V1 默认使用 localStorage；V2 Android 端通过 switchStorage 切换到 SQLite 实现。
 */
let adapter: StorageAdapter = createLocalStorageAdapter()

export function switchStorage(newAdapter: StorageAdapter): void {
  adapter = newAdapter
}

export function getStorageAdapter(): StorageAdapter {
  return adapter
}

export const storage = {
  get<T>(key: string, fallback: T): T {
    return adapter.get(key, fallback)
  },
  set<T>(key: string, value: T): void {
    adapter.set(key, value)
  },
  remove(key: string): void {
    adapter.remove(key)
  },
  clearAll(): void {
    adapter.clearAll()
  },
}

export const STORAGE_KEYS = {
  sources: 'hplayer:sources',
  activeSourceId: 'hplayer:activeSourceId',
  sourceOrder: 'hplayer:sourceOrder',
  favorites: 'hplayer:favorites',
  history: 'hplayer:history',
  searchHistory: 'hplayer:searchHistory',
  settings: 'hplayer:settings',
  playbackRate: 'hplayer:playbackRate',
} as const

export type { StorageAdapter }
