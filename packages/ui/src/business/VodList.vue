<script setup lang="ts">
import type { VodItem } from '@hplayer/core'
import { List, PullRefresh } from 'vant'
import { ref, watch } from 'vue'
import VirtualGrid from './VirtualGrid.vue'
import VodCard from './VodCard.vue'

const props = defineProps<{
  items: VodItem[]
  sourceName?: string
  loading: boolean
  finished: boolean
}>()

defineEmits<{
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
</script>

<template>
  <PullRefresh v-model="refreshing" @refresh="$emit('refresh')">
    <List :loading="loading" :finished="finished" finished-text="没有更多了" @load="$emit('load')">
      <VirtualGrid :items="items" :keyOf="(item: VodItem) => `${item.sourceId}-${item.id}`">
        <template #default="{ item, visible }">
          <VodCard
            v-if="visible"
            :item="item"
            :source-name="sourceName ?? ''"
            @select="(it: VodItem) => $emit('select', it)"
            @play="(it: VodItem) => $emit('play', it)"
          />
          <div v-else class="vod-card-placeholder" />
        </template>
      </VirtualGrid>
    </List>
  </PullRefresh>
</template>

<style scoped>
.vod-card-placeholder {
  height: 100%;
  min-height: 220px;
  background: var(--van-background-2);
  border-radius: 6px;
}
</style>
