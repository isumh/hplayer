<script setup lang="ts">
import { computed } from 'vue';
import { Tabbar, TabbarItem } from 'vant';
import { useRoute, useRouter } from 'vue-router';

defineOptions({ name: 'HPlayerTabBar' });

const route = useRoute();
const router = useRouter();

const active = computed(() => route.path);

function go(path: string) {
  router.push(path);
}
</script>

<template>
  <Tabbar :model-value="active" safe-area-inset-bottom fixed>
    <TabbarItem name="/home" icon="home-o" @click="go('/home')">首页</TabbarItem>
    <TabbarItem name="/search" icon="search" @click="go('/search')">搜索</TabbarItem>
    <TabbarItem name="/settings" icon="setting-o" @click="go('/settings')">设置</TabbarItem>
  </Tabbar>
</template>
