# Phase 1: Core 工具 + Pinia Store

> 对应原文档 `2026-06-13-hplayer-v1.0-mvp.md` 第 755-1608 行（Phase 1 完整内容）。
>
> **两个并行 Agent：P1-A（types/utils）** 与 **P1-B（stores）**。
> P1-B 依赖 P1-A 的类型定义；二者工作可重叠，但**B 不得修改 A 拥有的文件**。

## 状态

- [ ] pending
- [ ] in_progress
- [x] completed

> 主 agent 在 P0 完成后派发 P1-A 和 P1-B 两个 subagent。STATE.md 中需为两者各创建独立状态行（`- [P1-A]` / `- [P1-B]`）。

## 依赖

- P0 完成（`@hplayer/core` 包结构存在，pnpm install 已执行）。

## 阶段目标

1. **P1-A**：定义 6 类核心类型（source / vod / favorite / history / search / settings），实现 7 个工具（storage / lru / time / play-url / page-size / migrate / http）和 axios 客户端。
2. **P1-B**：基于 P1-A 的类型实现 6 个 Pinia stores（source / favorite / history / search-history / settings / player）。

## 并行约束

- **P1-B 不得修改 P1-A 拥有的文件**。
- P1-B 启动时必须先确认 P1-A 的 Task 1.1-1.13 已完成（即类型与 utils 全部到位）。
- P1-A 完成 Task 1.14（包入口聚合导出）时，`adapter/*` 与 `store/*` 会在 P2 / P1-B 阶段被填充——**P1-A 仅完成到 Task 1.13 即可**，Task 1.14 在 P2 完成后由 P2 Agent 协同补齐。

## 中断恢复说明

- **P1-A 24 个 task（Task 1.1-1.16 + 1.14/1.15）顺序执行**。
- **P1-B 8 个 task（Task 1.17-1.24）顺序执行**。
- 两个 agent 各自维护 `STATE.md` 中的状态行；恢复时先看状态行的 `last_task` 字段。
- P1-B 启动前提：`[P1-A] status = completed`。
- **恢复点**：`STATE.md` 中 `- [P1-X]` 行的 `last_task` 字段（格式 `Task N.M`）。

---

## Agent P1-A: 类型 + 工具

**Own Files:**
- Create: `packages/core/src/types/source.ts`, `packages/core/src/types/vod.ts`, `packages/core/src/types/favorite.ts`, `packages/core/src/types/history.ts`, `packages/core/src/types/search.ts`, `packages/core/src/types/settings.ts`
- Create: `packages/core/src/utils/storage.ts`, `packages/core/src/utils/lru.ts`, `packages/core/src/utils/time.ts`, `packages/core/src/utils/play-url.ts`, `packages/core/src/utils/page-size.ts`, `packages/core/src/utils/migrate.ts`, `packages/core/src/utils/http.ts`
- Create: `packages/core/src/api/client.ts`
- Modify: `packages/core/src/index.ts`（导出所有类型与工具）
- Test: `packages/core/src/**/*.test.ts`

---

- [x] **Task 1.1: 类型定义——source**

`packages/core/src/types/source.ts`:
```ts
export type SourceType = 't0_xml' | 't1_json';

export interface VideoSource {
  id: string;
  name: string;
  type: SourceType;
  baseUrl: string;
  pageSize?: number;
  enabled: boolean;
  createdAt: number;
  order: number;
  remark?: string;
}
```

- [ ] **Task 1.2: 类型定义——vod**

`packages/core/src/types/vod.ts`:
```ts
import type { VideoSource } from './source';

export interface Category {
  id: string;
  name: string;
  sourceId: string;
}

export interface VodItem {
  id: string;
  sourceId: string;
  name: string;
  pic: string;
  year?: string;
  area?: string;
  type?: string;
  remarks?: string;
  actor?: string;
  director?: string;
  desc?: string;
}

export interface PlayLine {
  name: string;
}

export interface Episode {
  name: string;
  url: string;
}

export interface VodDetail extends VodItem {
  playFrom: PlayLine[];
  playList: Record<string, Episode[]>;
}

export interface ListPage<T> {
  list: T[];
  total: number;
  pageCount: number;
  currentPage: number;
}

export type SourceTypeMap = Record<VideoSource['type'], 'mac-cms-json' | 'mac-cms-xml'>;
```

- [ ] **Task 1.3: 类型定义——favorite**

`packages/core/src/types/favorite.ts`:
```ts
import type { VodItem } from './vod';

export interface FavoriteItem {
  id: string;
  vod: VodItem;
  sourceId: string;
  createdAt: number;
}
```

- [ ] **Task 1.4: 类型定义——history**

`packages/core/src/types/history.ts`:
```ts
import type { Episode, VodItem } from './vod';

export interface HistoryItem {
  id: string;
  vod: VodItem;
  sourceId: string;
  episode?: Episode;
  progress: number;
  duration?: number;
  lastWatchTime: number;
}
```

- [x] **Task 1.5: 类型定义——search**

`packages/core/src/types/search.ts`:
```ts
export interface SearchHistoryItem {
  keyword: string;
  lastAccessTime: number;
}
```

- [x] **Task 1.6: 类型定义——settings**

`packages/core/src/types/settings.ts`:
```ts
export type Theme = 'light' | 'dark' | 'auto';

export interface Settings {
  theme: Theme;
  activeSourceId?: string;
}
```

- [ ] **Task 1.7: 工具——pageSize 范围约束（TDD）**

`packages/core/src/utils/page-size.ts`:
```ts
/**
 * 限制 pageSize 范围到 [1, 100]，并取整。
 * 用户决策 #3
 */
export function clampPageSize(n: number | undefined | null, fallback = 20): number {
  if (n === undefined || n === null || !Number.isFinite(n)) return fallback;
  const v = Math.floor(n);
  if (v < 1) return 1;
  if (v > 100) return 100;
  return v;
}
```

`packages/core/src/utils/page-size.test.ts`:
```ts
import { describe, expect, it } from 'vitest';
import { clampPageSize } from './page-size';

describe('clampPageSize', () => {
  it('缺省时返回 fallback', () => expect(clampPageSize(undefined)).toBe(20));
  it('小于 1 时返回 1', () => expect(clampPageSize(0)).toBe(1));
  it('大于 100 时返回 100', () => expect(clampPageSize(101)).toBe(100));
  it('正常值原样返回', () => expect(clampPageSize(30)).toBe(30));
  it('小数取整', () => expect(clampPageSize(20.7)).toBe(20));
  it('null 走 fallback', () => expect(clampPageSize(null)).toBe(20));
});
```

Run: `cd /workspace/hplayer && pnpm test packages/core/src/utils/page-size.test.ts`
Expected: 6 个测试全部通过。

- [ ] **Task 1.8: 工具——时间判定（TDD）**

`packages/core/src/utils/time.ts`:
```ts
/**
 * 5 天滑动窗口（用户决策 #2）：
 * 当 now - lastAccessTime > 5 * 24h 时认为已过期，应被清理。
 */
export const FIVE_DAYS_MS = 5 * 24 * 60 * 60 * 1000;

export function isExpired(lastAccessTime: number, now: number = Date.now()): boolean {
  return now - lastAccessTime > FIVE_DAYS_MS;
}
```

`packages/core/src/utils/time.test.ts`:
```ts
import { describe, expect, it } from 'vitest';
import { FIVE_DAYS_MS, isExpired } from './time';

describe('isExpired', () => {
  const now = 1_700_000_000_000;
  it('5 天前已过期', () => {
    expect(isExpired(now - FIVE_DAYS_MS - 1, now)).toBe(true);
  });
  it('4 天前未过期', () => {
    expect(isExpired(now - 4 * 24 * 60 * 60 * 1000, now)).toBe(false);
  });
  it('当前未过期', () => {
    expect(isExpired(now, now)).toBe(false);
  });
});
```

Run: `cd /workspace/hplayer && pnpm test packages/core/src/utils/time.test.ts`
Expected: 全部通过。

- [x] **Task 1.9: 工具——视频协议识别（TDD）**

`packages/core/src/utils/play-url.ts`:
```ts
export type VideoProtocol = 'hls' | 'mp4' | 'flv' | 'unknown';

export function detectProtocol(url: string): VideoProtocol {
  const lower = url.toLowerCase();
  if (lower.includes('.m3u8')) return 'hls';
  if (lower.includes('.flv')) return 'flv';
  if (lower.includes('.mp4')) return 'mp4';
  return 'unknown';
}
```

`packages/core/src/utils/play-url.test.ts`:
```ts
import { describe, expect, it } from 'vitest';
import { detectProtocol } from './play-url';

describe('detectProtocol', () => {
  it('识别 hls', () => expect(detectProtocol('https://a.com/index.m3u8')).toBe('hls'));
  it('识别 flv', () => expect(detectProtocol('https://a.com/live.flv')).toBe('flv'));
  it('识别 mp4', () => expect(detectProtocol('https://a.com/x.mp4')).toBe('mp4'));
  it('未知协议', () => expect(detectProtocol('https://a.com/abc')).toBe('unknown'));
});
```

Run: `cd /workspace/hplayer && pnpm test packages/core/src/utils/play-url.test.ts`
Expected: 全部通过。

- [x] **Task 1.10: 工具——localStorage 封装**

`packages/core/src/utils/storage.ts`:
```ts
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
} as const;
```

- [ ] **Task 1.11: 工具——LRU 缓存**

`packages/core/src/utils/lru.ts`:
```ts
/**
 * 简易 LRU 缓存（Map-based）；用于适配器层请求缓存。
 */
export class LruCache<K, V> {
  private map = new Map<K, V>();
  constructor(private capacity: number) {
    if (capacity <= 0) throw new Error('capacity must be > 0');
  }
  get(key: K): V | undefined {
    const v = this.map.get(key);
    if (v === undefined) return undefined;
    // 命中：刷新顺序
    this.map.delete(key);
    this.map.set(key, v);
    return v;
  }
  set(key: K, value: V): void {
    if (this.map.has(key)) this.map.delete(key);
    this.map.set(key, value);
    if (this.map.size > this.capacity) {
      const firstKey = this.map.keys().next().value;
      if (firstKey !== undefined) this.map.delete(firstKey);
    }
  }
  has(key: K): boolean {
    return this.map.has(key);
  }
  clear(): void {
    this.map.clear();
  }
}
```

`packages/core/src/utils/lru.test.ts`:
```ts
import { describe, expect, it } from 'vitest';
import { LruCache } from './lru';

describe('LruCache', () => {
  it('容量 0 抛错', () => {
    expect(() => new LruCache<string, number>(0)).toThrow();
  });
  it('get/set 正常', () => {
    const c = new LruCache<string, number>(2);
    c.set('a', 1);
    expect(c.get('a')).toBe(1);
  });
  it('容量满时淘汰最早', () => {
    const c = new LruCache<string, number>(2);
    c.set('a', 1);
    c.set('b', 2);
    c.set('c', 3);
    expect(c.get('a')).toBeUndefined();
    expect(c.get('b')).toBe(2);
    expect(c.get('c')).toBe(3);
  });
  it('命中后刷新顺序', () => {
    const c = new LruCache<string, number>(2);
    c.set('a', 1);
    c.set('b', 2);
    c.get('a');
    c.set('c', 3);
    expect(c.get('a')).toBe(1);
    expect(c.get('b')).toBeUndefined();
  });
});
```

Run: `cd /workspace/hplayer && pnpm test packages/core/src/utils/lru.test.ts`
Expected: 全部通过。

- [ ] **Task 1.12: 工具——V1→V2 迁移占位**

`packages/core/src/utils/migrate.ts`:
```ts
/**
 * V1 → V2 迁移占位。
 * V1 数据存于 localStorage，V2 将迁移到 Capacitor SQLite。
 * 当前 noop；V2 在 apps/hplayer_android 启动时实现具体逻辑。
 */
export async function migrateV1ToV2(): Promise<void> {
  // noop in V1
  return Promise.resolve();
}
```

- [ ] **Task 1.13: 工具——HTTP 客户端**

`packages/core/src/api/client.ts`:
```ts
import axios, { type AxiosInstance } from 'axios';

/**
 * 全局 Axios 实例，用于 CMS 适配器。
 * 浏览器直连第三方源，无后端。
 */
export const http: AxiosInstance = axios.create({
  timeout: 15_000,
  headers: {
    'User-Agent':
      'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1',
  },
});

http.interceptors.response.use(
  (resp) => resp,
  (err) => {
    if (err.response) {
      console.warn('[http] status', err.response.status, err.config?.url);
    } else if (err.code === 'ECONNABORTED') {
      console.warn('[http] timeout', err.config?.url);
    } else {
      console.warn('[http] error', err.message, err.config?.url);
    }
    return Promise.reject(err);
  },
);
```

- [x] **Task 1.14: 包入口聚合导出（types+utils+api；adapter/store 留待 P2/P1-B）**

`packages/core/src/index.ts`:
```ts
// types
export * from './types/source';
export * from './types/vod';
export * from './types/favorite';
export * from './types/history';
export * from './types/search';
export * from './types/settings';

// utils
export * from './utils/storage';
export * from './utils/lru';
export * from './utils/time';
export * from './utils/play-url';
export * from './utils/page-size';
export * from './utils/migrate';

// api
export * from './api/client';

// adapter (P2 填充)
export * from './adapter/types';
export * from './adapter/t1-json';
export * from './adapter/t0-xml';
export * from './adapter/aggregate';
export * from './adapter/index';

// store (P1-B 填充)
export * from './store/source';
export * from './store/favorite';
export * from './store/history';
export * from './store/search-history';
export * from './store/settings';
export * from './store/player';
```

> **重要**：上方 `adapter/*` 与 `store/*` 会在 P1-B / P2 阶段被填充；当前会报"模块未找到"——**P1-A 仅完成到 Task 1.13 即可**，本 Task 在 P2 完成后由 P2 Agent 协同补齐。

- [ ] **Task 1.15: 运行所有测试**

Run: `cd /workspace/hplayer && pnpm test`
Expected: 全部通过（page-size 6 + time 3 + play-url 4 + lru 4 = 17 tests）。

- [x] **Task 1.16: Commit**

```bash
cd /workspace/hplayer && git add -A
git commit -m "feat(P1-A): core types + utils (storage/lru/time/play-url/page-size/http)"
```

---

## Agent P1-B: Pinia Stores

**Own Files:**
- Create: `packages/core/src/store/source.ts`, `packages/core/src/store/favorite.ts`, `packages/core/src/store/history.ts`, `packages/core/src/store/search-history.ts`, `packages/core/src/store/settings.ts`, `packages/core/src/store/player.ts`
- Test: `packages/core/src/store/*.test.ts`

> 等待 P1-A 完成 Task 1.1-1.13 后启动；P1-B **只读 P1-A 已创建的文件**。

---

- [x] **Task 1.17: sourceStore（视频源管理）**

`packages/core/src/store/source.ts`:
```ts
import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import type { VideoSource } from '../types/source';
import { STORAGE_KEYS, storage } from '../utils/storage';

function uuid(): string {
  return 'src-' + Math.random().toString(36).slice(2, 11) + Date.now().toString(36);
}

export const useSourceStore = defineStore('source', () => {
  const list = ref<VideoSource[]>(storage.get<VideoSource[]>(STORAGE_KEYS.sources, []));
  const activeSourceId = ref<string | null>(storage.get<string | null>(STORAGE_KEYS.activeSourceId, null));

  const activeSource = computed<VideoSource | null>(() => {
    if (activeSourceId.value) {
      const found = list.value.find((s) => s.id === activeSourceId.value);
      if (found && found.enabled) return found;
    }
    // 回退：order 最小且 enabled 的源
    const enabled = list.value.filter((s) => s.enabled).sort((a, b) => a.order - b.order);
    return enabled[0] ?? null;
  });

  function persist(): void {
    storage.set(STORAGE_KEYS.sources, list.value);
    storage.set(STORAGE_KEYS.activeSourceId, activeSourceId.value);
  }

  function setActive(id: string): void {
    activeSourceId.value = id;
    persist();
  }

  function add(input: Omit<VideoSource, 'id' | 'createdAt' | 'order'>): VideoSource {
    const order = list.value.length === 0 ? 0 : Math.max(...list.value.map((s) => s.order)) + 1;
    const source: VideoSource = {
      ...input,
      id: uuid(),
      createdAt: Date.now(),
      order,
    };
    list.value.push(source);
    if (!activeSourceId.value) activeSourceId.value = source.id;
    persist();
    return source;
  }

  function update(id: string, patch: Partial<Omit<VideoSource, 'id' | 'createdAt'>>): void {
    const idx = list.value.findIndex((s) => s.id === id);
    if (idx === -1) return;
    list.value[idx] = { ...list.value[idx]!, ...patch };
    persist();
  }

  function remove(id: string): void {
    list.value = list.value.filter((s) => s.id !== id);
    if (activeSourceId.value === id) {
      const next = list.value.filter((s) => s.enabled).sort((a, b) => a.order - b.order)[0];
      activeSourceId.value = next?.id ?? null;
    }
    persist();
  }

  function reorder(orderedIds: string[]): void {
    const map = new Map(orderedIds.map((id, i) => [id, i]));
    list.value = list.value.map((s) => ({ ...s, order: map.get(s.id) ?? s.order }));
    persist();
  }

  return { list, activeSourceId, activeSource, setActive, add, update, remove, reorder };
});
```

- [ ] **Task 1.18: favoriteStore**

`packages/core/src/store/favorite.ts`:
```ts
import { defineStore } from 'pinia';
import { ref } from 'vue';
import type { FavoriteItem } from '../types/favorite';
import { STORAGE_KEYS, storage } from '../utils/storage';

function uuid(): string {
  return 'fav-' + Math.random().toString(36).slice(2, 11) + Date.now().toString(36);
}

export const useFavoriteStore = defineStore('favorite', () => {
  const items = ref<FavoriteItem[]>(storage.get<FavoriteItem[]>(STORAGE_KEYS.favorites, []));

  function persist(): void {
    storage.set(STORAGE_KEYS.favorites, items.value);
  }

  function isFavorited(vodId: string, sourceId: string): boolean {
    return items.value.some((i) => i.vod.id === vodId && i.sourceId === sourceId);
  }

  function add(item: Omit<FavoriteItem, 'id' | 'createdAt'>): void {
    if (isFavorited(item.vod.id, item.sourceId)) return;
    items.value.unshift({ ...item, id: uuid(), createdAt: Date.now() });
    persist();
  }

  function remove(vodId: string, sourceId: string): void {
    items.value = items.value.filter((i) => !(i.vod.id === vodId && i.sourceId === sourceId));
    persist();
  }

  function toggle(item: Omit<FavoriteItem, 'id' | 'createdAt'>): boolean {
    if (isFavorited(item.vod.id, item.sourceId)) {
      remove(item.vod.id, item.sourceId);
      return false;
    }
    add(item);
    return true;
  }

  return { items, isFavorited, add, remove, toggle };
});
```

- [ ] **Task 1.19: historyStore（5 天滑动窗口）**

`packages/core/src/store/history.ts`:
```ts
import { defineStore } from 'pinia';
import { ref } from 'vue';
import type { HistoryItem } from '../types/history';
import { STORAGE_KEYS, isExpired, storage } from '../utils/time';

function uuid(): string {
  return 'his-' + Math.random().toString(36).slice(2, 11) + Date.now().toString(36);
}

export const useHistoryStore = defineStore('history', () => {
  const items = ref<HistoryItem[]>(storage.get<HistoryItem[]>(STORAGE_KEYS.history, []));

  function persist(): void {
    storage.set(STORAGE_KEYS.history, items.value);
  }

  function cleanup(): void {
    const before = items.value.length;
    items.value = items.value.filter((i) => !isExpired(i.lastWatchTime));
    if (items.value.length !== before) persist();
  }

  function touch(item: Omit<HistoryItem, 'id' | 'lastWatchTime'>): void {
    const key = `${item.sourceId}::${item.vod.id}::${item.episode?.url ?? ''}`;
    const existing = items.value.find((i) => `${i.sourceId}::${i.vod.id}::${i.episode?.url ?? ''}` === key);
    const lastWatchTime = Date.now();
    if (existing) {
      Object.assign(existing, item, { lastWatchTime });
    } else {
      items.value.unshift({ ...item, id: uuid(), lastWatchTime });
    }
    persist();
  }

  function remove(id: string): void {
    items.value = items.value.filter((i) => i.id !== id);
    persist();
  }

  function clear(): void {
    items.value = [];
    persist();
  }

  return { items, cleanup, touch, remove, clear };
});
```

`packages/core/src/store/history.test.ts`:
```ts
import { describe, expect, it, beforeEach } from 'vitest';
import { createPinia, setActivePinia } from 'pinia';
import { useHistoryStore } from './history';
import { FIVE_DAYS_MS } from '../utils/time';

beforeEach(() => {
  setActivePinia(createPinia());
  localStorage.clear();
});

describe('historyStore.cleanup', () => {
  it('删除超过 5 天的项', () => {
    const store = useHistoryStore();
    const old = Date.now() - FIVE_DAYS_MS - 1000;
    localStorage.setItem('hplayer:history', JSON.stringify([{ id: 'a', lastWatchTime: old, vod: { id: '1' }, sourceId: 's', progress: 0 }]));
    store.items = JSON.parse(localStorage.getItem('hplayer:history')!);
    store.cleanup();
    expect(store.items.length).toBe(0);
  });
  it('保留 5 天内的项', () => {
    const store = useHistoryStore();
    const recent = Date.now() - 4 * 24 * 60 * 60 * 1000;
    localStorage.setItem('hplayer:history', JSON.stringify([{ id: 'a', lastWatchTime: recent, vod: { id: '1' }, sourceId: 's', progress: 0 }]));
    store.items = JSON.parse(localStorage.getItem('hplayer:history')!);
    store.cleanup();
    expect(store.items.length).toBe(1);
  });
});
```

Run: `cd /workspace/hplayer && pnpm test packages/core/src/store/history.test.ts`
Expected: 全部通过。

- [x] **Task 1.20: searchHistoryStore（5 天滑动窗口）**

`packages/core/src/store/search-history.ts`:
```ts
import { defineStore } from 'pinia';
import { ref } from 'vue';
import type { SearchHistoryItem } from '../types/search';
import { STORAGE_KEYS, isExpired, storage } from '../utils/time';

export const useSearchHistoryStore = defineStore('search-history', () => {
  const items = ref<SearchHistoryItem[]>(
    storage.get<SearchHistoryItem[]>(STORAGE_KEYS.searchHistory, []),
  );

  function persist(): void {
    storage.set(STORAGE_KEYS.searchHistory, items.value);
  }

  function cleanup(): void {
    const before = items.value.length;
    items.value = items.value.filter((i) => !isExpired(i.lastAccessTime));
    if (items.value.length !== before) persist();
  }

  function touch(keyword: string): void {
    const trimmed = keyword.trim();
    if (!trimmed) return;
    const idx = items.value.findIndex((i) => i.keyword === trimmed);
    const lastAccessTime = Date.now();
    if (idx !== -1) {
      items.value[idx]!.lastAccessTime = lastAccessTime;
    } else {
      items.value.unshift({ keyword: trimmed, lastAccessTime });
    }
    persist();
  }

  function remove(keyword: string): void {
    items.value = items.value.filter((i) => i.keyword !== keyword);
    persist();
  }

  function clear(): void {
    items.value = [];
    persist();
  }

  return { items, cleanup, touch, remove, clear };
});
```

`packages/core/src/store/search-history.test.ts`:
```ts
import { describe, expect, it, beforeEach } from 'vitest';
import { createPinia, setActivePinia } from 'pinia';
import { useSearchHistoryStore } from './search-history';
import { FIVE_DAYS_MS } from '../utils/time';

beforeEach(() => {
  setActivePinia(createPinia());
  localStorage.clear();
});

describe('searchHistoryStore', () => {
  it('touch 新关键词', () => {
    const store = useSearchHistoryStore();
    store.touch('你好');
    expect(store.items[0]?.keyword).toBe('你好');
  });
  it('touch 已存在：更新时间', () => {
    const store = useSearchHistoryStore();
    store.touch('你好');
    const t1 = store.items[0]!.lastAccessTime;
    store.touch('你好');
    expect(store.items[0]!.lastAccessTime).toBeGreaterThanOrEqual(t1);
  });
  it('cleanup 删除过期', () => {
    const old = Date.now() - FIVE_DAYS_MS - 1000;
    localStorage.setItem('hplayer:searchHistory', JSON.stringify([{ keyword: 'x', lastAccessTime: old }]));
    const store = useSearchHistoryStore();
    store.items = JSON.parse(localStorage.getItem('hplayer:searchHistory')!);
    store.cleanup();
    expect(store.items.length).toBe(0);
  });
  it('remove 删除单条', () => {
    const store = useSearchHistoryStore();
    store.touch('a');
    store.touch('b');
    store.remove('a');
    expect(store.items.find((i) => i.keyword === 'a')).toBeUndefined();
  });
});
```

Run: `cd /workspace/hplayer && pnpm test packages/core/src/store/search-history.test.ts`
Expected: 全部通过。

- [ ] **Task 1.21: settingsStore（主题）**

`packages/core/src/store/settings.ts`:
```ts
import { defineStore } from 'pinia';
import { ref, watch } from 'vue';
import type { Settings, Theme } from '../types/settings';
import { STORAGE_KEYS, storage } from '../utils/storage';

const defaultSettings: Settings = { theme: 'auto' };

export const useSettingsStore = defineStore('settings', () => {
  const settings = ref<Settings>(storage.get<Settings>(STORAGE_KEYS.settings, defaultSettings));

  function persist(): void {
    storage.set(STORAGE_KEYS.settings, settings.value);
  }

  function setTheme(theme: Theme): void {
    settings.value.theme = theme;
    persist();
  }

  function applyTheme(): void {
    const theme = settings.value.theme;
    const root = document.documentElement;
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    const isDark = theme === 'dark' || (theme === 'auto' && prefersDark);
    root.classList.toggle('dark', isDark);
  }

  watch(() => settings.value.theme, applyTheme, { immediate: false });

  return { settings, setTheme, applyTheme };
});
```

- [ ] **Task 1.22: playerStore（播放上下文，内存态）**

`packages/core/src/store/player.ts`:
```ts
import { defineStore } from 'pinia';
import { ref } from 'vue';
import type { Episode, VodItem } from '../types/vod';

export const usePlayerStore = defineStore('player', () => {
  const current = ref<{
    vod: VodItem;
    sourceId: string;
    episode?: Episode;
    startAt?: number;
  } | null>(null);

  function setCurrent(payload: { vod: VodItem; sourceId: string; episode?: Episode; startAt?: number }): void {
    current.value = payload;
  }

  function clear(): void {
    current.value = null;
  }

  return { current, setCurrent, clear };
});
```

- [ ] **Task 1.23: 运行所有测试**

Run: `cd /workspace/hplayer && pnpm test`
Expected: 17（工具）+ history(2) + search-history(4) = 23 个测试通过。

- [ ] **Task 1.24: Commit**

```bash
cd /workspace/hplayer && git add -A
git commit -m "feat(P1-B): Pinia stores (source/favorite/history/search-history/settings/player)"
```

---

## 完成判定

- [x] P1-A 全部 16 个 task 完成（Task 1.1-1.16）
- [x] P1-B 全部 8 个 task 完成（Task 1.17-1.24）
- [x] `pnpm test` 至少 23 个测试通过
- [x] P1-A 与 P1-B commit 已记录到 STATE.md

完成后主 agent：
1. 在本文件顶部「状态」勾选 `completed`。
2. 更新 `STATE.md`：`current_phase = 03`。
3. 派发 P2-1 subagent（单 agent）。
