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

  function setCurrent(payload: {
    vod: VodItem;
    sourceId: string;
    episode?: Episode;
    startAt?: number;
  }): void {
    current.value = payload;
  }

  function clear(): void {
    current.value = null;
  }

  return { current, setCurrent, clear };
});
