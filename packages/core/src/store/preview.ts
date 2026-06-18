import { defineStore } from 'pinia';
import { ref } from 'vue';

/**
 * 全局图片预览 store：单一 van-image-preview 实例位于 App 根，
 * 任意组件调 usePreviewStore().open([...]) 即可触发预览。
 */
export const usePreviewStore = defineStore('preview', () => {
  const show = ref(false);
  const images = ref<string[]>([]);
  const startIndex = ref(0);

  function open(urls: string[], index = 0): void {
    images.value = urls;
    startIndex.value = index;
    show.value = true;
  }
  function close(): void {
    show.value = false;
  }

  return { show, images, startIndex, open, close };
});
