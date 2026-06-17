<script setup lang="ts">
import { showImagePreview } from 'vant';

const props = withDefaults(defineProps<{ src: string }>(), {});
defineExpose({ open });

function open() {
  showImagePreview({ images: [props.src], closeable: true });
}
</script>

<template>
  <span class="hidden"></span>
</template>

<style scoped>
.hidden { display: none; }
</style>
