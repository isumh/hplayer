<script setup lang="ts">
import { ref, onMounted, onBeforeUnmount, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { NavBar } from '@hplayer/ui';
import { usePlayerStore, useHistoryStore, detectProtocol, type VodDetail, type Episode } from '@hplayer/core';
import Hls from 'hls.js';
import Artplayer from 'artplayer';

const route = useRoute();
const router = useRouter();
const playerStore = usePlayerStore();
const historyStore = useHistoryStore();

const containerRef = ref<HTMLDivElement | null>(null);
const error = ref<string | null>(null);
const playingTitle = ref('');

let art: Artplayer | null = null;
let hls: Hls | null = null;
let lastProgressSave = 0;

function teardown() {
  if (hls) {
    hls.destroy();
    hls = null;
  }
  if (art) {
    try {
      art.destroy();
    } catch {
      // ignore
    }
    art = null;
  }
}

function persistProgress() {
  if (!art || !playerStore.current) return;
  const cur = playerStore.current;
  if (!cur.episode) return;
  historyStore.touch({
    vod: cur.vod,
    sourceId: cur.sourceId,
    episode: cur.episode,
    progress: art.currentTime,
  });
}

function getEp(): Episode | null {
  const cur = playerStore.current;
  if (!cur || !cur.episode) return null;
  return cur.episode;
}

function buildPlayer(url: string, title: string, poster: string) {
  if (!containerRef.value) return;
  teardown();
  const protocol = detectProtocol(url);
  const useHls = protocol === 'hls' && Hls.isSupported();

  const options: Record<string, unknown> = {
    container: containerRef.value,
    url,
    autoplay: true,
    muted: false,
    playsInline: true,
    title,
    poster,
  };
  if (useHls) options.type = 'm3u8';

  try {
    art = new Artplayer(options as unknown as ConstructorParameters<typeof Artplayer>[0]);
  } catch (e) {
    error.value = e instanceof Error ? e.message : '播放器初始化失败';
    return;
  }

  art.on('video:timeupdate', () => {
    if (!art) return;
    const now = Date.now();
    if (now - lastProgressSave > 5000) {
      lastProgressSave = now;
      persistProgress();
    }
  });

  art.on('destroy', () => {
    persistProgress();
  });
}

onMounted(() => {
  const ep = getEp();
  if (!ep || !playerStore.current) {
    error.value = '无效播放会话';
    return;
  }
  const cur = playerStore.current;
  const vod = cur.vod as VodDetail;
  playingTitle.value = `${vod.name} - ${ep.name}`;
  buildPlayer(ep.url, vod.name, vod.pic);
});

onBeforeUnmount(() => {
  teardown();
});

watch(
  () => route.query.ep,
  (ep) => {
    const cur = playerStore.current;
    if (ep && cur?.episode) {
      const vod = cur.vod as VodDetail;
      buildPlayer(cur.episode.url, vod.name, vod.pic);
    }
  },
);

function onBack() {
  persistProgress();
  if (window.history.length > 1) router.back();
  else router.replace('/home');
}
</script>

<template>
  <div class="player-page">
    <NavBar :title="playingTitle || '播放'" @click-left="onBack" />
    <div class="art-wrap" ref="containerRef"></div>
    <div v-if="error" class="error">{{ error }}</div>
    <div v-else class="info">
      <p class="hint">长按视频可调出倍速与进度</p>
    </div>
  </div>
</template>

<style scoped>
.player-page { padding-top: 46px; min-height: 100vh; background: black; }
.art-wrap { width: 100%; aspect-ratio: 16 / 9; background: black; }
.error { color: white; padding: 16px; text-align: center; }
.info { padding: 16px; color: rgba(255, 255, 255, 0.7); }
.hint { font-size: 12px; text-align: center; }
</style>
