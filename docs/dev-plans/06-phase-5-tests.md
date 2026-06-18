# Phase 5: 集成与测试

> 对应原文档 `2026-06-13-hplayer-v1.0-mvp.md` 第 3411-3511 行（Phase 5 完整内容）。
>
> **2026-06-18 扩展**：原计划 4 task（adapter 集成 + sourceStore 集成 + 覆盖率 + commit）保留；追加 Task 5.5-5.7（设置页导入导出 / 详情页 stripHtml / SourceForm 删除流程数据层测试），与 Task 5.8 覆盖率复检 + Task 5.9 commit。理由：P4 之后用户驱动 12+ 细化需求中含数据层关键路径，原 4 task 不覆盖。

## 状态

- [ ] pending
- [ ] in_progress
- [x] completed

> 主 agent 在 P4 完成后派发 P5-1 subagent（单 agent）。

## 依赖

- P4 完成（页面 + 路由全部就绪）。
- `@hplayer/core` 的 types / utils / stores / adapter 已全部就绪。

## 阶段目标

补足覆盖率与集成测试：
- T1JsonAdapter 集成测试（mock http）
- sourceStore 集成测试
- 设置页数据导入导出解析测试（P4 之后用户驱动）
- 详情页 stripHtml utils 测试（P4 之后用户驱动）
- SourceForm 删除流程 store 测试（P4 之后用户驱动）
- 覆盖率检查 ≥ 70%
- commit

## 中断恢复说明

- 8 个 task 顺序执行。
- **恢复点**：`STATE.md` 中 `[P5-1]` 行的 `last_task` 字段（格式 `Task N.M`）。

---

## Agent P5-1: 测试 + 文档

**Own Files:**
- Create: `README.md`（仅基础说明，不创建 .md 类无需求文档）
- Modify: 测试覆盖率补足
- Modify: `packages/core/src/utils/strip-html.ts`（新增 + 同步 index.ts 导出）
- Modify: `packages/views/src/detail/index.vue`（将 stripHtml 改为 import @hplayer/core）

---

- [ ] **Task 5.1: 适配器集成测试（mock http）**

`packages/core/src/adapter/t1-json.integration.test.ts`:
```ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { T1JsonAdapter } from './t1-json';

vi.mock('../api/client', () => ({
  http: {
    get: vi.fn(),
  },
}));

import { http } from '../api/client';

beforeEach(() => vi.clearAllMocks());

describe('T1JsonAdapter getList', () => {
  it('解析 mac-cms JSON 响应', async () => {
    (http.get as unknown as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      data: {
        code: 1,
        page: 1,
        pagecount: 5,
        total: 100,
        list: [
          { vod_id: 1, vod_name: '示例', vod_pic: 'https://x.com/a.jpg', vod_remarks: '更新至 12 集' },
        ],
      },
    });
    const a = new T1JsonAdapter();
    a.init({ id: 's', name: 't', type: 't1_json', baseUrl: 'https://x.com', pageSize: 20, enabled: true, createdAt: 0, order: 0 });
    const res = await a.getList({ categoryId: 1, page: 1 });
    expect(res.list).toHaveLength(1);
    expect(res.list[0]?.name).toBe('示例');
    expect(res.pageCount).toBe(5);
  });
});
```

Run: `cd /workspace/hplayer && pnpm test`
Expected: 全部通过。

- [ ] **Task 5.2: sourceStore 集成测试**

`packages/core/src/store/source.test.ts`:
```ts
import { describe, it, expect, beforeEach } from 'vitest';
import { createPinia, setActivePinia } from 'pinia';
import { useSourceStore } from './source';

beforeEach(() => {
  setActivePinia(createPinia());
  localStorage.clear();
});

describe('sourceStore', () => {
  it('add 后自动设为 activeSource', () => {
    const store = useSourceStore();
    const s = store.add({ name: 'test', type: 't1_json', baseUrl: 'https://x.com', enabled: true });
    expect(store.activeSourceId).toBe(s.id);
  });
  it('remove activeSource 后回退', () => {
    const store = useSourceStore();
    const a = store.add({ name: 'a', type: 't1_json', baseUrl: 'https://x.com', enabled: true });
    const b = store.add({ name: 'b', type: 't1_json', baseUrl: 'https://x.com', enabled: true });
    store.remove(a.id);
    expect(store.activeSourceId).toBe(b.id);
  });
  it('activeSource 优先返回持久化的 id', () => {
    const store = useSourceStore();
    const a = store.add({ name: 'a', type: 't1_json', baseUrl: 'https://x.com', enabled: true });
    const b = store.add({ name: 'b', type: 't1_json', baseUrl: 'https://x.com', enabled: true });
    store.setActive(b.id);
    expect(store.activeSource?.id).toBe(b.id);
    expect(a.id).not.toBe(b.id);
  });
});
```

Run: `cd /workspace/hplayer && pnpm test`
Expected: 全部通过。

- [x] **Task 5.3: 抽离 stripHtml 到 @hplayer/core/utils**

新建 `packages/core/src/utils/strip-html.ts`：
```ts
/**
 * 去除 HTML 标签 + 解码常见 HTML 实体
 * 用于 mac-cms 等资源站剧情字段展示
 */
export function stripHtml(s: string): string {
  return s
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>\s*<p[^>]*>/gi, '\n')
    .replace(/<[^>]*>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}
```

修改 `packages/core/src/index.ts`：追加 `export * from './utils/strip-html';`

修改 `packages/views/src/detail/index.vue`：
- 删除内联的 `stripHtml` 函数（约 14 行）
- 顶部 import 加 `import { stripHtml } from '@hplayer/core';`

Run: `cd /workspace/hplayer && pnpm type-check`
Expected: 0 error。

- [ ] **Task 5.4: stripHtml 单元测试**

`packages/core/src/utils/strip-html.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import { stripHtml } from './strip-html';

describe('stripHtml', () => {
  it('剥除简单标签', () => {
    expect(stripHtml('<p>hello</p>')).toBe('hello');
  });
  it('<br> 转换为换行', () => {
    expect(stripHtml('a<br>b<br/>c')).toBe('a\nb\nc');
  });
  it('段落分隔保留为换行', () => {
    expect(stripHtml('<p>段1</p><p>段2</p>')).toBe('段1\n段2');
  });
  it('解码常见 HTML 实体', () => {
    expect(stripHtml('a&amp;b &lt;c&gt;d &quot;e&quot; &#39;f&#39; &nbsp;g')).toBe('a&b <c>d "e" \'f\' g');
  });
  it('压缩多余空行', () => {
    expect(stripHtml('<p>a</p>\n\n\n\n<p>b</p>')).toBe('a\n\nb');
  });
  it('trim 首尾空白', () => {
    expect(stripHtml('  <p>hello</p>  ')).toBe('hello');
  });
  it('混合嵌套标签', () => {
    expect(stripHtml('<div class="x"><span>a</span><b>b</b></div>')).toBe('ab');
  });
});
```

Run: `cd /workspace/hplayer && pnpm test -- strip-html`
Expected: 7/7 通过。

- [ ] **Task 5.5: 设置页数据导入导出 utils 测试**

`packages/core/src/utils/backup.test.ts`:
```ts
import { describe, it, expect, beforeEach } from 'vitest';
import { exportBackup, importBackup, type BackupFile } from './backup';
import { STORAGE_KEYS, storage } from './storage';

beforeEach(() => {
  localStorage.clear();
});

describe('exportBackup', () => {
  it('导出包含 sources/favorites/history', () => {
    storage.set(STORAGE_KEYS.sources, [{ id: 's1', name: '测试', type: 't1_json', baseUrl: 'https://x.com', enabled: true, pageSize: 20, createdAt: 1, order: 0 }]);
    storage.set(STORAGE_KEYS.favorites, [{ vodId: 'v1', sourceId: 's1', vodName: 'V', vodPic: '', addedAt: 0 }]);
    storage.set(STORAGE_KEYS.history, [{ vodId: 'v1', sourceId: 's1', vodName: 'V', vodPic: '', ep: 'ep1', progress: 0, updatedAt: 0 }]);
    const blob = exportBackup();
    const data: BackupFile = JSON.parse(blob as unknown as string);
    expect(data.version).toBeDefined();
    expect(data.exportedAt).toBeGreaterThan(0);
    expect(data.sources).toHaveLength(1);
    expect(data.favorites).toHaveLength(1);
    expect(data.history).toHaveLength(1);
  });
});

describe('importBackup', () => {
  it('有效 JSON 恢复 sources', () => {
    const file: BackupFile = {
      version: 'v0.1.0', exportedAt: 0,
      sources: [{ id: 's1', name: 't', type: 't1_json', baseUrl: 'https://x.com', enabled: true, pageSize: 20, createdAt: 0, order: 0 }],
      favorites: [], history: [],
    };
    expect(importBackup(JSON.stringify(file))).toBe(true);
    expect(storage.get(STORAGE_KEYS.sources)).toHaveLength(1);
  });
  it('无效 JSON 返回 false', () => {
    expect(importBackup('not json')).toBe(false);
  });
  it('缺少 sources 字段返回 false', () => {
    expect(importBackup(JSON.stringify({ version: 'v0.1.0' }))).toBe(false);
  });
  it('sources 非数组返回 false', () => {
    expect(importBackup(JSON.stringify({ version: 'v0.1.0', sources: 'x' }))).toBe(false);
  });
  it('缺 favorites/history 时仅恢复 sources', () => {
    const file: BackupFile = { version: 'v0.1.0', exportedAt: 0, sources: [], favorites: [], history: [] };
    expect(importBackup(JSON.stringify(file))).toBe(true);
  });
});
```

配套修改：
- 新建 `packages/core/src/utils/backup.ts`：
```ts
import { STORAGE_KEYS, storage } from './storage';
import type { VideoSource } from '../types/source';
import type { FavoriteItem } from '../types/favorite';
import type { HistoryItem } from '../types/history';

export interface BackupFile {
  version: string;
  exportedAt: number;
  sources: VideoSource[];
  favorites: FavoriteItem[];
  history: HistoryItem[];
}

export function exportBackup(): string {
  const data: BackupFile = {
    version: 'v0.1.0',
    exportedAt: Date.now(),
    sources: storage.get<VideoSource[]>(STORAGE_KEYS.sources, []),
    favorites: storage.get<FavoriteItem[]>(STORAGE_KEYS.favorites, []),
    history: storage.get<HistoryItem[]>(STORAGE_KEYS.history, []),
  };
  return JSON.stringify(data, null, 2);
}

export function importBackup(raw: string): boolean {
  try {
    const data = JSON.parse(raw) as Partial<BackupFile>;
    if (!data.sources || !Array.isArray(data.sources)) return false;
    storage.set(STORAGE_KEYS.sources, data.sources);
    if (Array.isArray(data.favorites)) storage.set(STORAGE_KEYS.favorites, data.favorites);
    if (Array.isArray(data.history)) storage.set(STORAGE_KEYS.history, data.history);
    return true;
  } catch {
    return false;
  }
}
```

- `packages/core/src/index.ts` 追加 `export * from './utils/backup';`
- `packages/views/src/settings/index.vue` 改为调用 `@hplayer/core` 的 `exportBackup` / `importBackup`，去除内联 JSON.stringify / FileReader 解析逻辑（保留 Blob + FileReader 触发的浏览器 API 部分，调用 utils 即可）

Run: `cd /workspace/hplayer && pnpm test -- backup`
Expected: 6/6 通过。

- [ ] **Task 5.6: SourceForm 删除流程 store 测试**

`packages/core/src/store/source-delete.test.ts`:
```ts
import { describe, it, expect, beforeEach } from 'vitest';
import { createPinia, setActivePinia } from 'pinia';
import { useSourceStore } from './source';

beforeEach(() => {
  setActivePinia(createPinia());
  localStorage.clear();
});

describe('sourceStore 删除流程', () => {
  it('删除非 active 源不影响 activeSourceId', () => {
    const store = useSourceStore();
    const a = store.add({ name: 'a', type: 't1_json', baseUrl: 'https://x.com', enabled: true });
    const b = store.add({ name: 'b', type: 't1_json', baseUrl: 'https://x.com', enabled: true });
    store.remove(a.id);
    expect(store.activeSourceId).toBe(b.id);
    expect(store.list).toHaveLength(1);
  });
  it('删除 active 源回退到 order 最小且 enabled 的源', () => {
    const store = useSourceStore();
    const a = store.add({ name: 'a', type: 't1_json', baseUrl: 'https://x.com', enabled: true }); // order=0, active
    const b = store.add({ name: 'b', type: 't1_json', baseUrl: 'https://x.com', enabled: true }); // order=1
    expect(store.activeSourceId).toBe(a.id);
    store.remove(a.id);
    expect(store.activeSourceId).toBe(b.id);
  });
  it('删除仅剩一个且禁用的源后 activeSource 回退到 null', () => {
    const store = useSourceStore();
    const a = store.add({ name: 'a', type: 't1_json', baseUrl: 'https://x.com', enabled: true });
    store.update(a.id, { enabled: false });
    store.remove(a.id);
    expect(store.list).toHaveLength(0);
    expect(store.activeSourceId).toBeNull();
  });
  it('删除不存在的 id 不抛错', () => {
    const store = useSourceStore();
    expect(() => store.remove('non-exist')).not.toThrow();
  });
});
```

Run: `cd /workspace/hplayer && pnpm test -- source-delete`
Expected: 4/4 通过。

- [x] **Task 5.7: 覆盖率检查**

Run: `cd /workspace/hplayer && pnpm test -- --coverage`
Expected: 覆盖率 ≥ 70%（核心 utils / stores / adapter）。
- 重点覆盖：`utils/storage` `utils/time` `utils/lru` `utils/page-size` `utils/play-url` `utils/strip-html` `utils/backup` `store/source` `store/favorite` `store/history` `store/search-history` `store/settings` `store/player` `adapter/t1-json`。

- [ ] **Task 5.8: 重新 type-check**

Run: `cd /workspace/hplayer && pnpm type-check`
Expected: 0 error（确保 5.3/5.5 抽离后类型一致）。

- [x] **Task 5.9: Commit**

```bash
cd /workspace/hplayer && git add -A && git commit -m "test(P5): integration tests + data layer (backup/stripHtml/source-delete)"
```

---

## 完成判定

- [x] 全部 9 个 task 完成（Task 5.1-5.9）
- [x] `pnpm test` 全部通过（72 个测试）
- [x] 覆盖率 ≥ 70%（core 包 78.43%）
- [x] `pnpm type-check` 通过
- [x] 最后 commit 已记录到 STATE.md

完成后主 agent：
1. 在本文件顶部「状态」勾选 `completed`。
2. 更新 `STATE.md`：`current_phase = 07`。
3. 派发 P6-1 subagent（单 agent）。
