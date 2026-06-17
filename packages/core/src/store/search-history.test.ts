import { createPinia, setActivePinia } from 'pinia';
import { beforeEach, describe, expect, it } from 'vitest';
import { FIVE_DAYS_MS } from '../utils/time';
import { useSearchHistoryStore } from './search-history';

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
    localStorage.setItem(
      'hplayer:searchHistory',
      JSON.stringify([{ keyword: 'x', lastAccessTime: old }]),
    );
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
