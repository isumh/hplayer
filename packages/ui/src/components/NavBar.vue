<script setup lang="ts">
import { NavBar } from 'vant'
import { useRouter } from 'vue-router'

withDefaults(
  defineProps<{
    title?: string
    showBack?: boolean
    rightText?: string
    placeholder?: boolean
  }>(),
  {
    title: '',
    showBack: true,
    rightText: '',
    placeholder: false,
  },
)

const emit = defineEmits<{
  (e: 'click-left'): void
  (e: 'click-right'): void
}>()

const router = useRouter()
function back() {
  if (window.history.length > 1) router.back()
  else router.push('/home')
}
</script>

<template>
  <NavBar
    :title="title ?? ''"
    :left-arrow="showBack ?? true"
    :right-text="rightText ?? ''"
    :placeholder="placeholder ?? false"
    @click-left="back"
    @click-right="emit('click-right')"
    fixed
    safe-area-inset-top
  />
</template>
