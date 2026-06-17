<script setup lang="ts">
import { NavBar } from 'vant';
import { useRouter } from 'vue-router';

withDefaults(defineProps<{ title?: string; showBack?: boolean }>(), {
  title: '',
  showBack: true,
});

const router = useRouter();
function back() {
  if (window.history.length > 1) router.back();
  else router.push('/home');
}
</script>

<template>
  <NavBar :title="title ?? ''" :left-arrow="showBack ?? true" @click-left="back" fixed safe-area-inset-top />
</template>
