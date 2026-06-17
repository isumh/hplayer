import { createPinia, setActivePinia } from 'pinia';
import { beforeEach, describe, expect, it } from 'vitest';
import { FIVE_DAYS_MS } from '../utils/time';
import { useHistoryStore } from './history';

beforeEach(() => {
  setActivePinia(createPinia());
  localStorage.clear();
});

describe('historyStore.cleanup', () => {
  it('删除超过 5 天的项', () => {
    const store = useHistoryStore();
    const old = Date.now() - FIVE_DAYS_MS - 1000;
    localStorage.setItem(
      'hplayer:history',
      JSON.stringify([
        { id: 'a', lastWatchTime: old, vod: { id: '1' }, sourceId: 's', progress: 0 },
      ]),
    );
    store.items = JSON.parse(localStorage.getItem('hplayer:history')!);
    store.cleanup();
    expect(store.items.length).toBe(0);
  });
  it('保留 5 天内的项', () => {
    const store = useHistoryStore();
    const recent = Date.now() - 4 * 24 * 60 * 60 * 1000;
    localStorage.setItem(
      'hplayer:history',
      JSON.stringify([
        { id: 'a', lastWatchTime: recent, vod: { id: '1' }, sourceId: 's', progress: 0 },
      ]),
    );
    store.items = JSON.parse(localStorage.getItem('hplayer:history')!);
    store.cleanup();
    expect(store.items.length).toBe(1);
  });
});
