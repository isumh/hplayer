<template>
  <div class="loading">
    <Skeleton :row="3" :row-width="['60%', '100%', '80%']" avatar />
  </div>
</template>

<script setup lang="ts">
import { Skeleton } from 'vant';
defineOptions({ name: 'HPlayerLoadingState' });
</script>

<style scoped>
.loading { padding: 12px; }
</style>
