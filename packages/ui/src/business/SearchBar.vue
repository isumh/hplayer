<script setup lang="ts">
import { Radio, RadioGroup, Search } from 'vant'
import { computed, onBeforeUnmount, ref, watch } from 'vue'

const props = withDefaults(
  defineProps<{ modelValue: string; mode: 'single' | 'aggregate'; sourceName?: string }>(),
  {
    modelValue: '',
    mode: 'single',
  },
)
const emit = defineEmits<{
  (e: 'update:modelValue', v: string): void
  (e: 'update:mode', v: 'single' | 'aggregate'): void
  (e: 'search', keyword: string): void
}>()

const local = ref(props.modelValue)
const localMode = ref(props.mode)

const singleLabel = computed(() => {
  const name = props.sourceName?.trim()
  return name ? `当前源（${name}）` : '当前源'
})

watch(
  () => props.modelValue,
  (v) => {
    local.value = v
  },
)
watch(local, (v) => emit('update:modelValue', v))
watch(localMode, (v) => emit('update:mode', v))

let timer: ReturnType<typeof setTimeout> | null = null
function onInput(v: string) {
  local.value = v
  if (timer) clearTimeout(timer)
  timer = setTimeout(() => emit('search', v.trim()), 500)
}
function onSubmit() {
  if (timer) clearTimeout(timer)
  emit('search', local.value.trim())
}

onBeforeUnmount(() => {
  if (timer) clearTimeout(timer)
})
</script>

<template>
  <div class="search-bar">
    <Search v-model="local" placeholder="搜索影视名称" @update:model-value="onInput" @search="onSubmit" />
    <RadioGroup v-model="localMode" direction="horizontal" class="mode-group">
      <Radio name="single">{{ singleLabel }}</Radio>
      <Radio name="aggregate">聚合</Radio>
    </RadioGroup>
  </div>
</template>

<style scoped>
.search-bar { padding: 8px 12px; display: flex; flex-direction: column; gap: 8px; background: var(--van-background); }
.mode-group { justify-content: center; }
</style>
