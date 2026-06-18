<script setup lang="ts">
import type { Category } from '@hplayer/core'
import { onBeforeUnmount, ref, watch } from 'vue'

// 父组件控制选中项（v-model:active-id）
const props = defineProps<{
  items: Category[]
  activeId?: string | number | null
}>()
const emit = defineEmits<{
  (e: 'update:activeId', id: string | number): void
  (e: 'select', cat: Category): void
}>()

const scrollRef = ref<HTMLElement | null>(null)

// 拖动状态：桌面端鼠标按下时记录起点；移动 > 5px 标记为 drag
// 不使用 setPointerCapture（会破坏后续 click 事件）
let activePointerId: number | null = null
let isDragging = false
let startX = 0
let startScroll = 0
const DRAG_THRESHOLD = 5

function onPointerDown(e: PointerEvent) {
  // 只接管鼠标；touch/pen 让浏览器原生处理（更顺滑）
  if (e.pointerType !== 'mouse') return
  const el = scrollRef.value
  if (!el) return
  activePointerId = e.pointerId
  isDragging = false
  startX = e.clientX
  startScroll = el.scrollLeft
  el.style.cursor = 'grabbing'
  el.style.userSelect = 'none'
}

function onPointerMove(e: PointerEvent) {
  if (activePointerId !== e.pointerId) return
  const el = scrollRef.value
  if (!el) return
  const dx = e.clientX - startX
  if (!isDragging && Math.abs(dx) > DRAG_THRESHOLD) {
    isDragging = true
  }
  if (isDragging) {
    el.scrollLeft = startScroll - dx
  }
}

function onPointerUp(e: PointerEvent) {
  if (activePointerId !== e.pointerId) return
  activePointerId = null
  const el = scrollRef.value
  if (el) {
    el.style.cursor = ''
    el.style.userSelect = ''
  }
  // isDragging 延迟一帧重置：让后续 click 处理器能检查到这个 flag
  setTimeout(() => {
    isDragging = false
  }, 0)
}

function onPointerCancel(e: PointerEvent) {
  onPointerUp(e)
}

function pick(c: Category) {
  // 如果是 drag，不触发 pick（避免拖动结束误触发）
  if (isDragging) return
  emit('update:activeId', c.id)
  emit('select', c)
}

// 默认选中第一个分类（如果父组件没传 activeId）
watch(
  () => props.items,
  (items) => {
    if (items.length && (props.activeId === null || props.activeId === undefined)) {
      const first = items[0]
      if (first) {
        emit('update:activeId', first.id)
        emit('select', first)
      }
    }
  },
  { immediate: true },
)

onBeforeUnmount(() => {
  activePointerId = null
  isDragging = false
})
</script>

<template>
  <div
    ref="scrollRef"
    class="cat-bar"
    @pointerdown="onPointerDown"
    @pointermove="onPointerMove"
    @pointerup="onPointerUp"
    @pointercancel="onPointerCancel"
  >
    <button
      v-for="c in items"
      :key="c.id"
      :class="['cat-item', { active: c.id === activeId }]"
      @click="pick(c)"
    >
      {{ c.name }}
    </button>
  </div>
</template>

<style scoped>
/* 横向滚动容器；移动端走原生 touch 滚动，桌面端由 pointer 拖动接管 */
.cat-bar {
  display: flex;
  gap: 6px;
  padding: 10px 16px;
  overflow-x: auto;
  overflow-y: hidden;
  white-space: nowrap;
  background: var(--van-background);
  border-bottom: 1px solid var(--van-border-color);
  cursor: grab;
  -webkit-overflow-scrolling: touch;
  touch-action: pan-x;
  scrollbar-width: none;
  -ms-overflow-style: none;
}
.cat-bar::-webkit-scrollbar { display: none; }

.cat-item {
  flex: 0 0 auto;
  margin: 0 6px;        /* 左右外边距（叠加 cat-bar gap 形成视觉间距） */
  padding: 6px 14px;
  border-radius: 16px;
  background: var(--van-background-2);
  color: var(--van-text-color);
  border: none;
  font-size: 13px;
  cursor: pointer;
  -webkit-user-select: none;
  user-select: none;
}
.cat-item.active { background: var(--van-primary-color); color: white; }
</style>
