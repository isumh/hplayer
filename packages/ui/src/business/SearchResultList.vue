<script setup lang="ts">
import type { VodItem } from '@hplayer/core'
import { DynamicScroller, DynamicScrollerItem } from 'vue-virtual-scroller'
import 'vue-virtual-scroller/dist/vue-virtual-scroller.css'
import VodCard from './VodCard.vue'
import VodList from './VodList.vue'

const props = defineProps<{
  items: VodItem[]
  sourceName?: string
  loading: boolean
  finished: boolean
  enableVirtual: boolean
}>()

const emit = defineEmits<{
  (e: 'load'): void
  (e: 'refresh'): void
  (e: 'select', item: VodItem): void
  (e: 'play', item: VodItem): void
}>()

function onLoad() {
  if (props.loading || props.finished) return
  emit('load')
}
</script>

<template>
  <div class="search-result-list">
    <VodList
      v-if="!enableVirtual"
      :items="items"
      :source-name="sourceName ?? ''"
      :loading="loading"
      :finished="finished"
      @load="onLoad"
      @refresh="$emit('refresh')"
      @select="(it: VodItem) => $emit('select', it)"
      @play="(it: VodItem) => $emit('play', it)"
    />
    <template v-else>
      <DynamicScroller
        class="virtual-scroller"
        :items="items"
        :min-item-size="220"
        key-field="id"
        page-mode
        @scroll-end="onLoad"
      >
        <template #default="{ item, index, active }">
          <DynamicScrollerItem :item="item" :active="active" :data-index="index">
            <div class="virtual-item">
              <VodCard
                :item="item"
                :source-name="sourceName ?? ''"
                @select="(it: VodItem) => $emit('select', it)"
                @play="(it: VodItem) => $emit('play', it)"
              />
            </div>
          </DynamicScrollerItem>
        </template>
      </DynamicScroller>
      <div v-if="loading" class="loading-tip">加载中...</div>
      <div v-else-if="finished" class="finished-tip">没有更多了</div>
    </template>
  </div>
</template>

<style scoped>
.search-result-list { min-height: 100%; }
.virtual-scroller :deep(.vue-recycle-scroller__item-view) {
  padding: 6px 12px;
}
.virtual-item :deep(.vod-card) {
  max-width: 100%;
}
.loading-tip,
.finished-tip {
  text-align: center;
  padding: 16px;
  color: var(--van-text-color-2);
  font-size: 13px;
}
</style>
