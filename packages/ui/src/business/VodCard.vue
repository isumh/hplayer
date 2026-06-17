<script setup lang="ts">
import { showImagePreview } from 'vant';
import type { VodItem } from '@hplayer/core';

const props = defineProps<{ item: VodItem; sourceName?: string }>();
const emit = defineEmits<{ (e: 'click', item: VodItem): void }>();

function previewImage(e: Event) {
  e.stopPropagation();
  showImagePreview({ images: [props.item.pic], closeable: true });
}

function goPlay(e: Event) {
  e.stopPropagation();
  emit('click', props.item);
}
</script>

<template>
  <div class="vod-card" @click="emit('click', item)">
    <div class="cover-wrap" @click="previewImage">
      <img class="cover" :src="item.pic" :alt="item.name" loading="lazy" />
      <button class="play-btn" @click="goPlay" aria-label="播放">▶</button>
      <span v-if="item.remarks" class="remark">{{ item.remarks }}</span>
    </div>
    <div class="name">{{ item.name }}</div>
    <div v-if="sourceName" class="source">{{ sourceName }}</div>
  </div>
</template>

<style scoped>
.vod-card { display: flex; flex-direction: column; gap: 4px; cursor: pointer; }
.cover-wrap { position: relative; aspect-ratio: 2/3; overflow: hidden; border-radius: 6px; background: var(--van-background-2); }
.cover { width: 100%; height: 100%; object-fit: cover; }
.play-btn {
  position: absolute; top: 6px; right: 6px;
  width: 28px; height: 28px; border-radius: 50%;
  background: rgba(0, 0, 0, 0.6); color: white;
  border: none; font-size: 12px; cursor: pointer;
}
.remark {
  position: absolute; bottom: 4px; right: 4px;
  background: rgba(0, 0, 0, 0.6); color: white;
  font-size: 10px; padding: 1px 4px; border-radius: 3px;
}
.name { font-size: 13px; line-height: 1.3; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; color: var(--van-text-color); }
.source { font-size: 11px; color: var(--van-text-color-2); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
</style>
