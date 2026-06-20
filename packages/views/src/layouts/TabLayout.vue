<script setup lang="ts">
import { TabBar } from '@hplayer/ui'
</script>

<template>
  <div class="tab-layout">
    <div class="content">
      <router-view />
    </div>
    <TabBar />
  </div>
</template>

<style scoped>
.tab-layout { display: flex; flex-direction: column; height: 100%; height: 100dvh; }
.content { flex: 1; overflow: hidden; position: relative; }
</style>
