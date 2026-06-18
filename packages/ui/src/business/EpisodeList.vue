<script setup lang="ts">
import type { Episode, VodDetail } from '@hplayer/core';
import { Tab, Tabs } from 'vant';
import { computed, ref } from 'vue';

const props = defineProps<{ detail: VodDetail }>();
const emit = defineEmits<(e: 'select', ep: Episode) => void>();

// 全部线路名（mtm3u8 / mtyun 等）
const lines = computed(() => props.detail.playFrom.map((p) => p.name));
const activeLine = ref<string>(lines.value[0] ?? '');
// 当前线路下的选集列表
const episodes = computed<Episode[]>(() => props.detail.playList[activeLine.value] ?? []);
// 记录当前选中集（用于按钮高亮）
const selectedUrl = ref<string>('');

function select(ep: Episode) {
  selectedUrl.value = ep.url;
  emit('select', ep);
}
</script>

<template>
  <div class="episode-list">
    <Tabs v-model:active="activeLine" sticky>
      <Tab v-for="line in lines" :key="line" :title="line" :name="line">
        <!-- 4 列网格 + 实心主色按钮 -->
        <div class="ep-grid">
          <button
            v-for="(ep, i) in episodes"
            :key="ep.url"
            type="button"
            class="ep-btn"
            :class="{ 'ep-btn--active': selectedUrl === ep.url }"
            @click="select(ep)"
          >
            <span class="ep-btn__text">{{ ep.name || `第${i + 1}集` }}</span>
          </button>
        </div>
      </Tab>
    </Tabs>
  </div>
</template>

<style scoped>
.episode-list { padding: 8px 12px; }

/* 4 列网格（响应式：屏宽时仍保持 4 列） */
.ep-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 8px;
  padding: 8px 0;
}

/* 实心主色按钮：背景主色 + 白色文字 + 居中显示 */
.ep-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 40px;
  padding: 6px 8px;
  background: var(--van-primary-color);
  color: #fff;
  border: 1px solid var(--van-primary-color);
  border-radius: 8px;
  font-size: 13px;
  font-weight: 500;
  line-height: 1.2;
  cursor: pointer;
  transition: opacity 0.15s ease, transform 0.1s ease;
  -webkit-tap-highlight-color: transparent;
}

.ep-btn:active { transform: scale(0.97); opacity: 0.85; }

/* 当前选中集：白底 + 主色文字 + 主色边框（反色提示） */
.ep-btn--active {
  background: #fff;
  color: var(--van-primary-color);
  border-color: var(--van-primary-color);
}

.ep-btn__text {
  text-align: center;
  word-break: break-all;
}
</style>
