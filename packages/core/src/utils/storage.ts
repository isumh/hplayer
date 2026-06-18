/**
 * 类型安全的 localStorage 封装；V1 持久化方案。
 * V2 将由 Capacitor SQLite 替代（见 migrate.ts）。
 */
export const storage = {
  get<T>(key: string, fallback: T): T {
    try {
      const raw = localStorage.getItem(key);
      if (raw === null) return fallback;
      return JSON.parse(raw) as T;
    } catch {
      return fallback;
    }
  },
  set<T>(key: string, value: T): void {
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch (err) {
      console.error('[storage] set failed', err);
    }
  },
  remove(key: string): void {
    localStorage.removeItem(key);
  },
  clearAll(): void {
    localStorage.clear();
  },
};

export const STORAGE_KEYS = {
  sources: 'hplayer:sources',
  activeSourceId: 'hplayer:activeSourceId',
  sourceOrder: 'hplayer:sourceOrder',
  favorites: 'hplayer:favorites',
  history: 'hplayer:history',
  searchHistory: 'hplayer:searchHistory',
  settings: 'hplayer:settings',
  playbackRate: 'hplayer:playbackRate',
} as const;
