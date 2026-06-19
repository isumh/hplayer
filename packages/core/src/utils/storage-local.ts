export interface StorageAdapter {
  get<T>(key: string, fallback: T): T
  set<T>(key: string, value: T): void
  remove(key: string): void
  clearAll(): void
}

export function createLocalStorageAdapter(): StorageAdapter {
  return {
    get<T>(key: string, fallback: T): T {
      try {
        const raw = localStorage.getItem(key)
        if (raw === null) return fallback
        return JSON.parse(raw) as T
      } catch (err) {
        console.warn(`[storage] failed to parse ${key}`, err)
        return fallback
      }
    },
    set<T>(key: string, value: T): void {
      try {
        localStorage.setItem(key, JSON.stringify(value))
      } catch (err) {
        console.error('[storage] set failed', err)
      }
    },
    remove(key: string): void {
      localStorage.removeItem(key)
    },
    clearAll(): void {
      localStorage.clear()
    },
  }
}
