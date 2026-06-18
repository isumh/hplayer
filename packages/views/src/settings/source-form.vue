<script setup lang="ts">
import { NavBar, SourceForm } from '@hplayer/ui'
import { computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'

const route = useRoute()
const router = useRouter()
const sourceId = computed<string | undefined>(
  () => (route.params.id as string | undefined) ?? undefined,
)

function onBack() {
  if (window.history.length > 1) router.back()
  else router.replace('/settings')
}
</script>

<template>
  <div class="source-form-page">
    <NavBar :title="sourceId ? '编辑视频源' : '新增视频源'" @click-left="onBack" />
    <div class="form-wrap">
      <SourceForm v-if="sourceId" :source-id="sourceId" />
      <SourceForm v-else />
    </div>
  </div>
</template>

<style scoped>
.source-form-page { padding-top: 46px; }
.form-wrap { padding: 12px 0; }
</style>
