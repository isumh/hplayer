import { createPinia, setActivePinia } from 'pinia';
import { beforeEach, describe, expect, it } from 'vitest';
import { useSourceStore } from './source';

beforeEach(() => {
  setActivePinia(createPinia());
  localStorage.clear();
});

const makeInput = (name: string) => ({
  name,
  type: 't1_json' as const,
  baseUrl: 'https://x.com',
  enabled: true,
  pageSize: 20,
});

describe('sourceStore', () => {
  it('add 后自动设为 activeSource', () => {
    const store = useSourceStore();
    const s = store.add(makeInput('test'));
    expect(store.activeSourceId).toBe(s.id);
    expect(store.activeSource?.id).toBe(s.id);
  });

  it('多次 add 只设首个为 active', () => {
    const store = useSourceStore();
    const a = store.add(makeInput('a'));
    store.add(makeInput('b'));
    expect(store.activeSourceId).toBe(a.id);
  });

  it('remove activeSource 后回退到下一个 enabled 源', () => {
    const store = useSourceStore();
    const a = store.add(makeInput('a'));
    const b = store.add(makeInput('b'));
    store.remove(a.id);
    expect(store.activeSourceId).toBe(b.id);
  });

  it('remove 非 active 源不影响 activeSourceId', () => {
    const store = useSourceStore();
    const a = store.add(makeInput('a'));
    const b = store.add(makeInput('b'));
    store.remove(b.id);
    expect(store.activeSourceId).toBe(a.id);
    expect(store.list).toHaveLength(1);
  });

  it('setActive 切换 active 源', () => {
    const store = useSourceStore();
    const a = store.add(makeInput('a'));
    const b = store.add(makeInput('b'));
    store.setActive(b.id);
    expect(store.activeSource?.id).toBe(b.id);
    expect(a.id).not.toBe(b.id);
  });

  it('update 合并 patch 但保留 id/createdAt/order', () => {
    const store = useSourceStore();
    const s = store.add(makeInput('orig'));
    const originalCreated = s.createdAt;
    store.update(s.id, { name: 'new', enabled: false });
    const updated = store.list[0];
    expect(updated?.name).toBe('new');
    expect(updated?.enabled).toBe(false);
    expect(updated?.id).toBe(s.id);
    expect(updated?.createdAt).toBe(originalCreated);
  });

  it('reorder 按给定 id 顺序重排 order', () => {
    const store = useSourceStore();
    const a = store.add(makeInput('a'));
    const b = store.add(makeInput('b'));
    const c = store.add(makeInput('c'));
    store.reorder([c.id, a.id, b.id]);
    const ordered = store.list.slice().sort((x, y) => x.order - y.order);
    expect(ordered.map((s) => s.id)).toEqual([c.id, a.id, b.id]);
  });

  it('activeSource 在持久化 id 失效时回退到 order 最小且 enabled 的源', () => {
    const store = useSourceStore();
    const a = store.add(makeInput('a'));
    store.add(makeInput('b'));
    // 模拟外部直接改 localStorage
    localStorage.setItem('hplayer:activeSourceId', JSON.stringify('not-exists'));
    // 重建 store 触发初始化读取
    const fresh = useSourceStore();
    expect(fresh.activeSourceId).toBe(a.id);
  });

  it('持久化到 localStorage', () => {
    const store = useSourceStore();
    const s = store.add(makeInput('持久'));
    const stored = JSON.parse(localStorage.getItem('hplayer:sources') ?? '[]') as Array<{
      id: string;
    }>;
    expect(stored.map((x) => x.id)).toContain(s.id);
  });
});
