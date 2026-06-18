import { describe, it, expect, beforeEach } from 'vitest';
import { createPinia, setActivePinia } from 'pinia';
import { useSourceStore } from './source';

beforeEach(() => {
  setActivePinia(createPinia());
  localStorage.clear();
});

const makeInput = (name: string, enabled = true) => ({
  name,
  type: 't1_json' as const,
  baseUrl: 'https://x.com',
  enabled,
  pageSize: 20,
});

/**
 * SourceForm 删除流程的边界测试
 * 覆盖回退策略、disabled 源、非法 id 等场景
 */
describe('sourceStore 删除流程', () => {
  it('删除非 active 源不影响 activeSourceId', () => {
    const store = useSourceStore();
    const a = store.add(makeInput('a'));
    const b = store.add(makeInput('b'));
    store.remove(a.id);
    expect(store.activeSourceId).toBe(b.id);
    expect(store.list).toHaveLength(1);
  });

  it('删除 active 源回退到 order 最小且 enabled 的源', () => {
    const store = useSourceStore();
    const a = store.add(makeInput('a')); // order=0, active
    const b = store.add(makeInput('b')); // order=1
    expect(store.activeSourceId).toBe(a.id);
    store.remove(a.id);
    expect(store.activeSourceId).toBe(b.id);
  });

  it('active 源删除后，禁用的源被跳过', () => {
    const store = useSourceStore();
    const a = store.add(makeInput('a'));
    const b = store.add(makeInput('b', false)); // disabled
    const c = store.add(makeInput('c'));
    store.remove(a.id);
    // b 被禁用，应跳过回到 c
    expect(b.enabled).toBe(false);
    expect(store.activeSourceId).toBe(c.id);
  });

  it('删除仅剩一个且禁用的源后 activeSource 回退到 null', () => {
    const store = useSourceStore();
    const a = store.add(makeInput('a'));
    store.update(a.id, { enabled: false });
    store.remove(a.id);
    expect(store.list).toHaveLength(0);
    expect(store.activeSourceId).toBeNull();
    expect(store.activeSource).toBeNull();
  });

  it('删除不存在的 id 不抛错', () => {
    const store = useSourceStore();
    expect(() => store.remove('non-exist')).not.toThrow();
    expect(store.list).toHaveLength(0);
  });

  it('连续删除后 list 与 localStorage 一致', () => {
    const store = useSourceStore();
    const a = store.add(makeInput('a'));
    const b = store.add(makeInput('b'));
    const c = store.add(makeInput('c'));
    store.remove(b.id);
    store.remove(c.id);
    expect(store.list.map((s) => s.id)).toEqual([a.id]);
    const stored = JSON.parse(localStorage.getItem('hplayer:sources') ?? '[]') as Array<{ id: string }>;
    expect(stored.map((s) => s.id)).toEqual([a.id]);
  });

  it('删除持久化的 activeSourceId 缺失对应源时回退到 enabled 列表', () => {
    const store = useSourceStore();
    const a = store.add(makeInput('a')); // order=0, active
    store.add(makeInput('b')); // order=1
    // 直接改写 localStorage 模拟外部状态不一致
    localStorage.setItem('hplayer:activeSourceId', JSON.stringify('phantom'));
    const fresh = useSourceStore();
    expect(fresh.activeSourceId).toBe(a.id);
  });
});
