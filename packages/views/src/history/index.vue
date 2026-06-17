<script setup lang="ts">
import { computed } from 'vue';
import { useRouter } from 'vue-router';
import { NavBar, EmptyState } from '@hplayer/ui';
import { Button, Dialog } from 'vant';
import { useHistoryStore } from '@hplayer/core';

const router = useRouter();
const store = useHistoryStore();
const list = computed(() =>
  store.items.slice().sort((a, b) => b.lastWatchTime - a.lastWatchTime),
);

function fmtTime(ts: number) {
  const d = new Date(ts);
  const now = new Date();
  const diffDay = Math.floor((now.getTime() - d.getTime()) / 86_400_000);
  if (diffDay === 0) return `今天 ${d.getHours()}:${String(d.getMinutes()).padStart(2, '0')}`;
  if (diffDay === 1) return '昨天';
  if (diffDay < 7) return `${diffDay} 天前`;
  return d.toLocaleDateString();
}

function open(item: { vod: { id: string }; sourceId: string; episode?: { url: string } }) {
  router.push({
    path: `/detail/${item.vod.id}`,
    query: { sourceId: item.sourceId },
  });
}

function playAgain(item: { vod: { id: string }; sourceId: string; episode?: { url: string } }) {
  router.push({
    path: `/player/${item.vod.id}`,
    query: { sourceId: item.sourceId, ep: item.episode?.url ?? '' },
  });
}

async function clearAll() {
  const ok = await Dialog.confirm({ title: '清空历史', message: '确认清空所有观看历史？' })
    .then(() => true)
    .catch(() => false);
  if (ok) store.clear();
}

function onBack() {
  if (window.history.length > 1) router.back();
  else router.replace('/home');
}
</script>

<template>
  <div class="hist-page">
    <NavBar title="历史" @click-left="onBack" />
    <EmptyState v-if="!list.length" text="暂无历史" />
    <ul v-else class="list">
      <li v-for="i in list" :key="i.id" class="row" @click="open(i)">
        <img class="cover" :src="i.vod.pic" :alt="i.vod.name" />
        <div class="meta">
          <div class="name">{{ i.vod.name }}</div>
          <div class="sub">{{ i.episode?.name || '未选集' }} · {{ fmtTime(i.lastWatchTime) }}</div>
        </div>
        <Button size="mini" type="primary" plain @click.stop="playAgain(i)">续播</Button>
      </li>
    </ul>
    <div v-if="list.length" class="footer">
      <Button type="danger" block @click="clearAll">清空历史</Button>
    </div>
  </div>
</template>

<style scoped>
.hist-page { padding-top: 46px; }
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
