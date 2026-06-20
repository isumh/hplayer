<script setup lang="ts" generic="T">
import { onBeforeUnmount, onMounted, ref } from 'vue'

const props = defineProps<{
  items: T[]
  keyOf: (item: T) => string | number
  buffer?: number
}>()

const visibleSet = ref(new Set<string | number>())
const cellMap = ref(new Map<string | number, HTMLElement>())
let observer: IntersectionObserver | null = null

function isVisible(item: T): boolean {
  return visibleSet.value.has(props.keyOf(item))
}

function setCellRef(item: T, el: unknown) {
  const key = props.keyOf(item)
  const htmlEl = el as HTMLElement | null
  if (htmlEl) {
    cellMap.value.set(key, htmlEl)
    observer?.observe(htmlEl)
  } else {
    const existing = cellMap.value.get(key)
    if (existing) observer?.unobserve(existing)
    cellMap.value.delete(key)
  }
}

onMounted(() => {
  observer = new IntersectionObserver(
    (entries) => {
      const next = new Set(visibleSet.value)
      entries.forEach((entry) => {
        const key = (entry.target as HTMLElement).dataset.vkey
        if (!key) return
        if (entry.isIntersecting) next.add(key)
        else next.delete(key)
      })
      visibleSet.value = next
    },
    { rootMargin: `${props.buffer ?? 300}px` },
  )
  for (const el of cellMap.value.values()) {
    observer?.observe(el)
  }
})

onBeforeUnmount(() => {
  observer?.disconnect()
  observer = null
})
</script>

<template>
  <div class="virtual-grid">
    <div
      v-for="item in items"
      :key="keyOf(item)"
      :data-vkey="keyOf(item)"
      :ref="(el) => setCellRef(item, el)"
      class="virtual-grid__cell"
    >
      <slot :item="item" :visible="isVisible(item)" />
    </div>
  </div>
</template>

<style scoped>
.virtual-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  grid-auto-rows: 1fr;
  gap: 12px;
  padding: 12px;
}
@media (min-width: 768px) {
  .virtual-grid {
    grid-template-columns: repeat(5, 1fr);
  }
}
@media (min-width: 1024px) {
  .virtual-grid {
    grid-template-columns: repeat(6, 1fr);
    max-width: 1200px;
    margin: 0 auto;
  }
}
.virtual-grid__cell {
  min-height: 0;
  height: 100%;
}
</style>
