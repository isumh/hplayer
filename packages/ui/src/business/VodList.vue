<script setup lang="ts">
import type { VodItem } from '@hplayer/core'
import { List, PullRefresh } from 'vant'
import { ref, watch } from 'vue'
import VodCard from './VodCard.vue'

const props = defineProps<{
  items: VodItem[]
  sourceName?: string
  loading: boolean
  finished: boolean
}>()

const emit = defineEmits<{
  (e: 'load'): void
  (e: 'refresh'): void
  (e: 'select', item: VodItem): void
  (e: 'play', item: VodItem): void
}>()

const refreshing = ref(false)

// 关键修复：下拉刷新时父组件 emit('refresh') 后，PullRefresh 不会自动收起 loading
// 监听外部 loading 由 true → false（覆盖分页和重置两种场景），自动收 refreshing
watch(
  () => props.loading,
  (cur, prev) => {
    if (prev && !cur) refreshing.value = false
  },
)

function onLoad() {
  emit('load')
}
function onRefresh() {
  emit('refresh')
}
function onSelect(it: VodItem) {
  emit('select', it)
}
function onPlay(it: VodItem) {
  emit('play', it)
}
</script>

<template>
  <PullRefresh v-model="refreshing" @refresh="onRefresh">
    <List :loading="loading" :finished="finished" finished-text="没有更多了" @load="onLoad">
      <div class="grid">
        <VodCard
          v-for="item in items"
          :key="`${item.sourceId}-${item.id}`"
          :item="item"
          :source-name="sourceName ?? ''"
          @select="onSelect"
          @play="onPlay"
        />
      </div>
    </List>
  </PullRefresh>
</template>

<style scoped>
/* grid-auto-rows: 1fr：同列所有卡片同高 → 不会因标题/图片差异导致高度不齐 */
.grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  grid-auto-rows: 1fr;
  gap: 12px;
  padding: 12px;
}
@media (min-width: 768px) {
  .grid { grid-template-columns: repeat(5, 1fr); }
}
@media (min-width: 1024px) {
  .grid { grid-template-columns: repeat(6, 1fr); max-width: 1200px; margin: 0 auto; }
}
</style>
