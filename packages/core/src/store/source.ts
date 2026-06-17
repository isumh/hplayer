import { defineStore } from 'pinia';
import { computed, ref } from 'vue';
import type { VideoSource } from '../types/source';
import { STORAGE_KEYS, storage } from '../utils/storage';

function uuid(): string {
  return 'src-' + Math.random().toString(36).slice(2, 11) + Date.now().toString(36);
}

export const useSourceStore = defineStore('source', () => {
  const list = ref<VideoSource[]>(storage.get<VideoSource[]>(STORAGE_KEYS.sources, []));
  const activeSourceId = ref<string | null>(
    storage.get<string | null>(STORAGE_KEYS.activeSourceId, null),
  );

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
