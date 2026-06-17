<script setup lang="ts">
import { computed } from 'vue';
import { useRouter } from 'vue-router';
import { NavBar, EmptyState } from '@hplayer/ui';
import { Button, Dialog } from 'vant';
import { useFavoriteStore } from '@hplayer/core';

const router = useRouter();
const store = useFavoriteStore();
const list = computed(() => store.items.slice().sort((a, b) => b.createdAt - a.createdAt));

function open(item: { vod: { id: string }; sourceId: string }) {
  router.push({ path: `/detail/${item.vod.id}`, query: { sourceId: item.sourceId } });
}

async function clearAll() {
  const ok = await Dialog.confirm({ title: '清空收藏', message: '确认清空所有收藏？' })
    .then(() => true)
    .catch(() => false);
  if (ok) {
    list.value.forEach((i) => store.remove(i.vod.id, i.sourceId));
  }
}

function onBack() {
  if (window.history.length > 1) router.back();
  else router.replace('/home');
}
</script>

<template>
  <div class="fav-page">
    <NavBar title="收藏" @click-left="onBack" />
    <EmptyState v-if="!list.length" text="暂无收藏" />
    <ul v-else class="list">
      <li v-for="i in list" :key="i.id" class="row" @click="open(i)">
        <img class="cover" :src="i.vod.pic" :alt="i.vod.name" />
        <div class="meta">
          <div class="name">{{ i.vod.name }}</div>
          <div class="sub" v-if="i.vod.remarks">{{ i.vod.remarks }}</div>
        </div>
        <Button
          size="mini"
          plain
          type="danger"
          @click.stop="store.remove(i.vod.id, i.sourceId)"
        >
          删除
        </Button>
      </li>
    </ul>
    <div v-if="list.length" class="footer">
      <Button type="danger" block @click="clearAll">清空收藏</Button>
    </div>
  </div>
</template>

<style scoped>
.fav-page { padding-top: 46px; }
.list { list-style: none; padding: 0; margin: 0; }
.row {
  display: flex; gap: 12px; align-items: center;
  padding: 10px 12px; border-bottom: 1px solid var(--van-border-color);
  cursor: pointer;
}
.cover { width: 60px; height: 80px; object-fit: cover; border-radius: 4px; }
.meta { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 4px; }
.name { font-size: 14px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.sub { font-size: 12px; color: var(--van-text-color-2); }
.footer { padding: 16px; }
</style>
