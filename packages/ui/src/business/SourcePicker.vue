<script setup lang="ts">
import { useSourceStore } from '@hplayer/core'
import { Cell, CellGroup, Popup, Tag } from 'vant'
import { computed, ref } from 'vue'

const props = defineProps<{ categoryName?: string | undefined }>()
const store = useSourceStore()
const showPicker = ref(false)
const activeName = computed(() => store.activeSource?.name ?? '选择视频源')
// 显示规则：源名·分类名（分类为空时只显示源名）
const displayText = computed(() => {
  const c = props.categoryName?.trim()
  return c ? `${activeName.value}·${c}` : activeName.value
})
const sources = computed(() =>
  store.list.filter((s) => s.enabled).sort((a, b) => a.order - b.order),
)

function pick(id: string) {
  store.setActive(id)
  showPicker.value = false
}
</script>

<template>
  <div class="source-picker" @click="showPicker = true">
    <span class="name">{{ displayText }}</span>
    <span class="arrow">▾</span>
  </div>
  <Popup v-model:show="showPicker" position="top" round :style="{ background: 'var(--van-background)' }">
    <CellGroup>
      <Cell
        v-for="s in sources"
        :key="s.id"
        :title="s.name"
        clickable
        @click="pick(s.id)"
      >
        <template #value>
          <Tag v-if="s.id === store.activeSourceId" type="primary">当前</Tag>
        </template>
      </Cell>
    </CellGroup>
  </Popup>
</template>

<style scoped>
.source-picker {
  display: inline-flex; align-items: center; gap: 4px;
  padding: 6px 10px; border-radius: 16px;
  background: var(--van-background-2);
  max-width: 60vw; cursor: pointer;
}
.name { font-size: 14px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.arrow { font-size: 12px; color: var(--van-text-color-2); }
</style>
