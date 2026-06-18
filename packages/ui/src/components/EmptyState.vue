<script setup lang="ts">
import { Empty } from 'vant'

withDefaults(
  defineProps<{
    text?: string
    icon?: string
  }>(),
  {
    text: '暂无数据',
    icon: 'inbox-o',
  },
)
</script>

<template>
  <div class="empty-state">
    <Empty :description="text ?? ''" />
    <!-- 调用方可通过 #default 插槽放入操作按钮（如"重试" / "去添加"） -->
    <slot />
  </div>
</template>

<style scoped>
.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 40px 20px;
  gap: 16px;
}
</style>
