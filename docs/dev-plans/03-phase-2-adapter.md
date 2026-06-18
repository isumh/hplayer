# Phase 2: CMS Adapter

> 对应原文档 `2026-06-13-hplayer-v1.0-mvp.md` 第 1612-2006 行（Phase 2 完整内容）。

## 状态

- [ ] pending
- [ ] in_progress
- [x] completed

> 主 agent 在 P1 完成后派发 P2-1 subagent（单 agent）。

## 依赖

- P1 完成（types / utils / http client / Pinia stores）。

## 阶段目标

实现 CMS 适配器系统（Adapter Pattern）：
- `CmsAdapter` 统一接口（`getCategories` / `getList` / `getDetail` / `search`）
- `T1JsonAdapter`：主适配器，兼容 mac-cms JSON 接口
- `T0XmlAdapter`：V1 占位（V1.1 完整实现）
- `adapterProxy`：工厂 + LRU 缓存 + sourceId 修正
- `aggregateSearch`：跨源聚合搜索（用户决策 #16）
- T1JsonAdapter 单元测试（字段映射 / pageSize 越界）

## 中断恢复说明

- 8 个 task 顺序执行。
- **Task 2.4 末尾**需在 `packages/core/src/index.ts` 顶部添加 `export * from './adapter/types'` 等 P1-A 留下的占位导出（因为 P1-A 当时还没创建 adapter 文件）。
- **恢复点**：`STATE.md` 中 `[P2-1]` 行的 `last_task` 字段（格式 `Task N.M`）。

---

## Agent P2-1: 适配器系统

**Own Files:**
- Create: `packages/core/src/adapter/types.ts`, `packages/core/src/adapter/t1-json.ts`, `packages/core/src/adapter/t0-xml.ts`, `packages/core/src/adapter/aggregate.ts`, `packages/core/src/adapter/index.ts`
- Test: `packages/core/src/adapter/*.test.ts`
- Modify: `packages/core/src/index.ts`（补齐 P1-A 留下的 adapter 占位导出）

---

- [ ] **Task 2.1: 适配器接口**

`packages/core/src/adapter/types.ts`:
```ts
import type { Category, ListPage, VodDetail, VodItem } from '../types/vod';
import type { VideoSource } from '../types/source';

export interface GetListParams {
  categoryId: string | number;
  page: number;
  pageSize?: number;
}

export interface SearchParams {
  keyword: string;
  page: number;
  pageSize?: number;
}

export interface CmsAdapter {
  readonly type: VideoSource['type'];
  init(config: VideoSource): void;
  getCategories(): Promise<Category[]>;
  getList(params: GetListParams): Promise<ListPage<VodItem>>;
  getDetail(id: string | number): Promise<VodDetail>;
  search(params: SearchParams): Promise<ListPage<VodItem>>;
}
```

- [ ] **Task 2.2: T1_JSON 适配器（主）**

`packages/core/src/adapter/t1-json.ts`:
```ts
import { http } from '../api/client';
import { clampPageSize } from '../utils/page-size';
import type { Category, ListPage, VodDetail, VodItem } from '../types/vod';
import type { VideoSource } from '../types/source';
import type { CmsAdapter, GetListParams, SearchParams } from './types';

interface MacCmsListItem {
  vod_id: number | string;
  vod_name: string;
  vod_pic: string;
  vod_remarks?: string;
  vod_year?: string;
  vod_area?: string;
  vod_class?: string;
  vod_actor?: string;
  vod_director?: string;
  vod_content?: string;
  type_id?: number | string;
  type_name?: string;
}

interface MacCmsListResp {
  code: number;
  msg?: string;
  page?: number;
  pagecount?: number;
  total?: number;
  list?: MacCmsListItem[];
}

interface MacCmsDetailResp {
  code: number;
  msg?: string;
  list?: MacCmsListItem[];
}

function mapItem(it: MacCmsListItem, sourceId: string): VodItem {
  return {
    id: String(it.vod_id),
    sourceId,
    name: it.vod_name,
    pic: it.vod_pic,
    year: it.vod_year,
    area: it.vod_area,
    type: it.vod_class ?? it.type_name,
    remarks: it.vod_remarks,
    actor: it.vod_actor,
    director: it.vod_director,
    desc: it.vod_content,
  };
}

function parsePlayLists(playFrom: string, playUrl: string): {
  playFromArr: { name: string }[];
  playList: Record<string, { name: string; url: string }[]>;
} {
  const fromArr = playFrom.split('$$$').map((s) => s.trim()).filter(Boolean);
  const urlArr = playUrl.split('$$$');
  const playList: Record<string, { name: string; url: string }[]> = {};
  fromArr.forEach((name, i) => {
    const lineRaw = urlArr[i] ?? '';
    playList[name] = lineRaw
      .split('#')
      .map((seg) => {
        const [n, u] = seg.split('$');
        return { name: (n ?? '').trim(), url: (u ?? '').trim() };
      })
      .filter((e) => e.url);
  });
  return { playFromArr: fromArr.map((n) => ({ name: n })), playList };
}

export class T1JsonAdapter implements CmsAdapter {
  readonly type = 't1_json' as const;
  private baseUrl = '';
  private defaultPageSize = 20;

  init(config: VideoSource): void {
    this.baseUrl = config.baseUrl.replace(/\/+$/, '');
    this.defaultPageSize = clampPageSize(config.pageSize, 20);
  }

  private async get<T>(params: Record<string, string | number>): Promise<T> {
    const qs = new URLSearchParams();
    for (const [k, v] of Object.entries(params)) qs.set(k, String(v));
    const { data } = await http.get<T>(`${this.baseUrl}?${qs.toString()}`);
    return data;
  }

  async getCategories(): Promise<Category[]> {
    const data = await this.get<MacCmsListResp>({ ac: 2 });
    // ac=2 返回分类列表，字段为 list，每个含 type_id/type_name
    const list = (data as unknown as { class?: { type_id: number | string; type_name: string }[] }).class ?? [];
    const sourceId = this.baseUrl; // 用 baseUrl 作为 sourceId 占位，由调用方覆盖
    return list.map((c) => ({ id: String(c.type_id), name: c.type_name, sourceId }));
  }

  async getList({ categoryId, page, pageSize }: GetListParams): Promise<ListPage<VodItem>> {
    const ps = clampPageSize(pageSize, this.defaultPageSize);
    const data = await this.get<MacCmsListResp>({ ac: 'videolist', t: categoryId, pg: page, pagesize: ps });
    const list = data.list ?? [];
    return {
      list: list.map((it) => mapItem(it, this.baseUrl)),
      total: data.total ?? 0,
      pageCount: data.pagecount ?? 1,
      currentPage: data.page ?? page,
    };
  }

  async getDetail(id: string | number): Promise<VodDetail> {
    const data = await this.get<MacCmsDetailResp>({ ac: 'detail', ids: id });
    const it = (data.list ?? [])[0];
    if (!it) throw new Error('detail not found');
    const base = mapItem(it, this.baseUrl);
    const playFrom = (it as unknown as { vod_play_from?: string }).vod_play_from ?? '';
    const playUrl = (it as unknown as { vod_play_url?: string }).vod_play_url ?? '';
    const { playFromArr, playList } = parsePlayLists(playFrom, playUrl);
    return { ...base, playFrom: playFromArr, playList };
  }

  async search({ keyword, page, pageSize }: SearchParams): Promise<ListPage<VodItem>> {
    const ps = clampPageSize(pageSize, this.defaultPageSize);
    const data = await this.get<MacCmsListResp>({ ac: 'videolist', wd: keyword, pg: page, pagesize: ps });
    const list = data.list ?? [];
    return {
      list: list.map((it) => mapItem(it, this.baseUrl)),
      total: data.total ?? 0,
      pageCount: data.pagecount ?? 1,
      currentPage: data.page ?? page,
    };
  }
}
```

> **注意**：`VodItem.sourceId` 应为 VideoSource.id 而非 baseUrl。Caller 在收到结果后会覆盖。

- [x] **Task 2.3: T0_XML 适配器（V1.1 占位）**

`packages/core/src/adapter/t0-xml.ts`:
```ts
import type { Category, ListPage, VodDetail, VodItem } from '../types/vod';
import type { VideoSource } from '../types/source';
import { clampPageSize } from '../utils/page-size';
import type { CmsAdapter, GetListParams, SearchParams } from './types';

/**
 * T0_XML 适配器（V1 占位实现）。
 * V1 重点是 T1_JSON；T0_XML 接口在 V1.1 完整实现。
 */
export class T0XmlAdapter implements CmsAdapter {
  readonly type = 't0_xml' as const;
  private baseUrl = '';
  private defaultPageSize = 20;

  init(config: VideoSource): void {
    this.baseUrl = config.baseUrl.replace(/\/+$/, '');
    this.defaultPageSize = clampPageSize(config.pageSize, 20);
  }

  async getCategories(): Promise<Category[]> {
    throw new Error('T0_XML 适配器将在 V1.1 实现');
  }
  async getList(_params: GetListParams): Promise<ListPage<VodItem>> {
    throw new Error('T0_XML 适配器将在 V1.1 实现');
  }
  async getDetail(_id: string | number): Promise<VodDetail> {
    throw new Error('T0_XML 适配器将在 V1.1 实现');
  }
  async search(_params: SearchParams): Promise<ListPage<VodItem>> {
    throw new Error('T0_XML 适配器将在 V1.1 实现');
  }
}
```

- [ ] **Task 2.4: 适配器工厂 + 缓存 + sourceId 修正**

`packages/core/src/adapter/index.ts`:
```ts
import type { Category, ListPage, VodDetail, VodItem } from '../types/vod';
import type { VideoSource } from '../types/source';
import { LruCache } from '../utils/lru';
import type { CmsAdapter, GetListParams, SearchParams } from './types';
import { T0XmlAdapter } from './t0-xml';
import { T1JsonAdapter } from './t1-json';

const factories: Record<VideoSource['type'], new () => CmsAdapter> = {
  t0_xml: T0XmlAdapter,
  t1_json: T1JsonAdapter,
};

const cache = new LruCache<string, CmsAdapter>(50);

export function getAdapter(source: VideoSource): CmsAdapter {
  const existing = cache.get(source.id);
  if (existing) {
    existing.init(source);
    return existing;
  }
  const Adapter = factories[source.type];
  const inst = new Adapter();
  inst.init(source);
  cache.set(source.id, inst);
  return inst;
}

export function clearAdapterCache(sourceId?: string): void {
  if (sourceId) cache.clear();
  else cache.clear();
}

/**
 * 修正 VodItem 的 sourceId（适配器内部用 baseUrl 占位，调用方需要替换为真实 id）
 */
function fixSourceId<T extends { sourceId: string }>(list: T[], sourceId: string): T[] {
  return list.map((it) => ({ ...it, sourceId }));
}

export interface AdapterProxy {
  getCategories(source: VideoSource): Promise<Category[]>;
  getList(source: VideoSource, params: GetListParams): Promise<ListPage<VodItem>>;
  getDetail(source: VideoSource, id: string | number): Promise<VodDetail>;
  search(source: VideoSource, params: SearchParams): Promise<ListPage<VodItem>>;
}

export const adapterProxy: AdapterProxy = {
  async getCategories(source) {
    const a = getAdapter(source);
    return a.getCategories();
  },
  async getList(source, params) {
    const a = getAdapter(source);
    const res = await a.getList(params);
    return { ...res, list: fixSourceId(res.list, source.id) };
  },
  async getDetail(source, id) {
    const a = getAdapter(source);
    const res = await a.getDetail(id);
    return { ...res, sourceId: source.id };
  },
  async search(source, params) {
    const a = getAdapter(source);
    const res = await a.search(params);
    return { ...res, list: fixSourceId(res.list, source.id) };
  },
};
```

- [x] **Task 2.5: 聚合搜索**

`packages/core/src/adapter/aggregate.ts`:
```ts
import type { ListPage, VodItem } from '../types/vod';
import type { VideoSource } from '../types/source';
import { adapterProxy } from './index';

export interface AggregateSearchResult {
  list: (VodItem & { sourceName: string })[];
  errors: { sourceId: string; sourceName: string; error: string }[];
}

/**
 * 聚合搜索（用户决策 #16 确认）：并发请求所有 enabled 源，结果合并。
 * 单源失败不影响整体。
 */
export async function aggregateSearch(
  sources: VideoSource[],
  params: { keyword: string; page?: number; pageSize?: number },
): Promise<AggregateSearchResult> {
  const enabled = sources.filter((s) => s.enabled);
  const settled = await Promise.allSettled(
    enabled.map(async (s) => {
      const res: ListPage<VodItem> = await adapterProxy.search(s, {
        keyword: params.keyword,
        page: params.page ?? 1,
        pageSize: params.pageSize,
      });
      return { source: s, res };
    }),
  );

  const list: (VodItem & { sourceName: string })[] = [];
  const errors: AggregateSearchResult['errors'] = [];

  for (const r of settled) {
    if (r.status === 'fulfilled') {
      const { source, res } = r.value;
      res.list.forEach((it) => list.push({ ...it, sourceName: source.name }));
    } else {
      const source = enabled[settled.indexOf(r)]!;
      errors.push({
        sourceId: source.id,
        sourceName: source.name,
        error: r.reason instanceof Error ? r.reason.message : String(r.reason),
      });
    }
  }

  return { list, errors };
}
```

- [ ] **Task 2.6: T1_JSON 单元测试（字段映射）**

`packages/core/src/adapter/t1-json.test.ts`:
```ts
import { describe, expect, it } from 'vitest';
import { T1JsonAdapter } from './t1-json';
import type { VideoSource } from '../types/source';

const source: VideoSource = {
  id: 'src-1',
  name: 'test',
  type: 't1_json',
  baseUrl: 'https://example.com/api.php/provide/vod',
  pageSize: 20,
  enabled: true,
  createdAt: 0,
  order: 0,
};

describe('T1JsonAdapter init', () => {
  it('去除 baseUrl 尾部斜杠', () => {
    const a = new T1JsonAdapter();
    a.init({ ...source, baseUrl: 'https://example.com/api.php/provide/vod/' });
    // 内部字段私有，通过反射检查
    expect((a as unknown as { baseUrl: string }).baseUrl).toBe('https://example.com/api.php/provide/vod');
  });
  it('pageSize 缺省 20', () => {
    const a = new T1JsonAdapter();
    a.init({ ...source, pageSize: undefined });
    expect((a as unknown as { defaultPageSize: number }).defaultPageSize).toBe(20);
  });
  it('pageSize 越界约束', () => {
    const a = new T1JsonAdapter();
    a.init({ ...source, pageSize: 200 });
    expect((a as unknown as { defaultPageSize: number }).defaultPageSize).toBe(100);
  });
});
```

Run: `cd /workspace/hplayer && pnpm test packages/core/src/adapter`
Expected: 3 个 T1JsonAdapter 测试通过。

- [ ] **Task 2.7: 验证 TypeScript**

Run: `cd /workspace/hplayer && pnpm type-check`
Expected: 通过。

- [ ] **Task 2.8: Commit**

```bash
cd /workspace/hplayer && git add -A
git commit -m "feat(P2): CMS adapter system (T1_JSON + T0_XML stub + aggregate search + factory)"
```

---

## 完成判定

- [x] 全部 8 个 task 完成（Task 2.1-2.8）
- [x] `pnpm test packages/core/src/adapter` 3 个测试通过
- [x] `pnpm type-check` 0 error
- [x] 最后 commit 已记录到 STATE.md

完成后主 agent：
1. 在本文件顶部「状态」勾选 `completed`。
2. 更新 `STATE.md`：`current_phase = 04`。
3. 在 STATE.md 的「并行 Agent 状态行」P3 段为 P3-A / P3-B / P3-C 各创建一行（status=pending）。
4. 派发 P3-A / P3-B / P3-C 三个 subagent。
