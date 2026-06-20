<script setup lang="ts">
import type { VodItem } from '@hplayer/core'
import { normalizeImageUrl, usePreviewStore, useSourceStore } from '@hplayer/core'
import { computed } from 'vue'

const props = defineProps<{ item: VodItem }>()
const sourceStore = useSourceStore()
// ⓘ 图标 → 跳详情页；▶ 按钮 → 直接播放；cover 区域 → 弹图片预览
const emit = defineEmits<{
  (e: 'select', it: VodItem): void
  (e: 'play', it: VodItem): void
}>()

// 全局预览 store（App.vue 渲染唯一 ImagePreview 实例）
const previewStore = usePreviewStore()

// 完整名称（用于原生 title tooltip）
const fullName = computed(() => props.item.name)

// 根据视频源配置决定是否强制将图片 http 替换为 https
const source = computed(() => sourceStore.list.find((s) => s.id === props.item.sourceId))
const coverUrl = computed(() =>
  normalizeImageUrl(props.item.pic, source.value?.forceHttpsImage ?? false),
)

function stop(e: MouseEvent) {
  // 防止 ⓘ/▶ 按钮的 click 冒泡触发 cover 的图片预览
  e.stopPropagation()
}
function onDetail(e: MouseEvent) {
  stop(e)
  emit('select', props.item)
}
function onPlay(e: MouseEvent) {
  stop(e)
  emit('play', props.item)
}
function onPreview() {
  if (!coverUrl.value) return
  // 触发全局单例 ImagePreview
  previewStore.open([coverUrl.value], 0)
}

function onImageError(e: Event) {
  const img = e.target as HTMLImageElement
  console.warn('[VodCard] 图片加载失败:', props.item.pic)
  img.style.opacity = '0'
}
</script>

<template>
  <div class="vod-card">
    <div class="cover-wrap" @click="onPreview">
      <img
        class="cover"
        :src="coverUrl"
        :alt="item.name"
        loading="lazy"
        referrerpolicy="no-referrer"
        @error="onImageError"
      />
      <!-- 左上：详情链接图标 -->
      <button
        class="corner-btn detail-btn"
        type="button"
        :aria-label="`查看 ${item.name} 详情`"
        :title="`查看详情：${item.name}`"
        @click="onDetail"
      >ⓘ</button>
      <!-- 右上：直接播放 -->
      <button
        class="corner-btn play-btn"
        type="button"
        :aria-label="`直接播放 ${item.name}`"
        :title="`直接播放：${item.name}`"
        @click="onPlay"
      >▶</button>
      <span v-if="item.remarks" class="remark">{{ item.remarks }}</span>
    </div>
    <!-- 加粗 + 居中 + title 原生 tip + 2 行截断 -->
    <div class="name" :title="fullName">{{ item.name }}</div>
    <div v-if="item.year || item.area" class="source">
      {{ [item.year, item.area].filter(Boolean).join(' · ') }}
    </div>
  </div>
</template>

<style scoped>
.vod-card { display: flex; flex-direction: column; gap: 4px; cursor: pointer; height: 100%; }
.cover-wrap {
  position: relative;
  aspect-ratio: 2/3;
  overflow: hidden;
  border-radius: 6px;
  background: var(--van-background-2);
}
.cover { width: 100%; height: 100%; object-fit: cover; display: block; }

/* 左上 ⓘ / 右上 ▶：半透明圆形按钮 */
.corner-btn {
  position: absolute;
  top: 6px;
  width: 26px;
  height: 26px;
  border-radius: 50%;
  border: none;
  background: rgba(0, 0, 0, 0.55);
  color: white;
  font-size: 13px;
  line-height: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  -webkit-tap-highlight-color: transparent;
  transition: background 0.15s ease, transform 0.1s ease;
}
.corner-btn:active { transform: scale(0.92); background: rgba(0, 0, 0, 0.75); }
.detail-btn { left: 6px; }
.play-btn { right: 6px; padding-left: 2px; }

.remark {
  position: absolute;
  bottom: 4px;
  right: 4px;
  background: rgba(0, 0, 0, 0.6);
  color: white;
  font-size: 10px;
  padding: 1px 4px;
  border-radius: 3px;
}

/* 名称：加粗 + 居中 + 2 行截断 */
.name {
  font-size: 13px;
  font-weight: 600;       /* 加粗 */
  line-height: 1.3;
  text-align: center;     /* 居中 */
  color: var(--van-text-color);
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
  word-break: break-all;
}
.source {
  font-size: 11px;
  color: var(--van-text-color-2);
  text-align: center;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
</style>
