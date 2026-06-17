<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { NavBar, EpisodeList, LoadingState, EmptyState } from '@hplayer/ui';
import { Cell, CellGroup } from 'vant';
import {
  useSourceStore,
  useFavoriteStore,
  useHistoryStore,
  usePlayerStore,
  adapterProxy,
  type VodDetail,
  type Episode,
} from '@hplayer/core';

const route = useRoute();
const router = useRouter();
const sourceStore = useSourceStore();
const favoriteStore = useFavoriteStore();
const historyStore = useHistoryStore();
const playerStore = usePlayerStore();

const detail = ref<VodDetail | null>(null);
const loading = ref(true);
const error = ref<string | null>(null);

const id = route.params.id as string;
const sourceId = (route.query.sourceId as string) || sourceStore.activeSourceId || '';

async function load() {
  const source = sourceStore.list.find((s) => s.id === sourceId);
  if (!source) {
    error.value = '视频源不存在';
    loading.value = false;
    return;
  }
  try {
    detail.value = await adapterProxy.getDetail(source, id);
  } catch (e) {
    error.value = e instanceof Error ? e.message : '加载失败';
  } finally {
    loading.value = false;
  }
}

function play(ep: Episode) {
  if (!detail.value) return;
  const v = detail.value;
  playerStore.setCurrent({ vod: v, sourceId, episode: ep });
  historyStore.touch({ vod: v, sourceId, episode: ep, progress: 0 });
  router.push({ path: `/player/${id}`, query: { sourceId, ep: ep.url } });
}

function toggleFav() {
  if (!detail.value) return;
  const v = detail.value;
  favoriteStore.toggle({ vod: v, sourceId });
}

const isFav = computed(() =>
  detail.value ? favoriteStore.isFavorited(detail.value.id, sourceId) : false,
);

function onBack() {
  if (window.history.length > 1) router.back();
  else router.replace('/home');
}

onMounted(load);
</script>

<template>
  <div class="detail">
    <NavBar :title="detail?.name || '详情'" @click-left="onBack" />
    <LoadingState v-if="loading" />
    <EmptyState v-else-if="error" :text="error" />
    <template v-else-if="detail">
      <div class="header">
        <img class="poster" :src="detail.pic" :alt="detail.name" />
        <div class="meta">
          <h1 class="title">{{ detail.name }}</h1>
          <div class="row" v-if="detail.year">
            {{ detail.year }}<span v-if="detail.area"> · {{ detail.area }}</span>
          </div>
          <div class="row" v-if="detail.actor">主演: {{ detail.actor }}</div>
          <div class="row" v-if="detail.director">导演: {{ detail.director }}</div>
          <button class="fav-btn" :class="{ active: isFav }" @click="toggleFav">
            {{ isFav ? '已收藏' : '收藏' }}
          </button>
        </div>
      </div>
      <CellGroup inset v-if="detail.desc">
        <Cell title="剧情" :label="detail.desc" />
      </CellGroup>
      <EpisodeList v-if="detail.playFrom.length" :detail="detail" @select="play" />
    </template>
  </div>
</template>

<style scoped>
.detail { padding-top: 46px; }
.header { display: flex; gap: 12px; padding: 12px; }
.poster { width: 120px; border-radius: 6px; }
.meta { flex: 1; display: flex; flex-direction: column; gap: 4px; }
.title { margin: 0 0 8px; font-size: 18px; }
.row { font-size: 13px; color: var(--van-text-color-2); }
.fav-btn {
  margin-top: 8px; padding: 6px 12px; border: 1px solid var(--van-primary-color);
  background: transparent; color: var(--van-primary-color); border-radius: 4px;
  cursor: pointer; align-self: flex-start;
}
.fav-btn.active { background: var(--van-primary-color); color: white; }
</style>
