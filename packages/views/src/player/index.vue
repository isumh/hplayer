<script setup lang="ts">
import {
  detectProtocol,
  type Episode,
  STORAGE_KEYS,
  storage,
  useHistoryStore,
  usePlayerStore,
  type VodDetail,
} from '@hplayer/core';
import { NavBar } from '@hplayer/ui';
import Artplayer from 'artplayer';
import Hls from 'hls.js';
import { onBeforeUnmount, onMounted, ref, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';

const route = useRoute();
const router = useRouter();
const playerStore = usePlayerStore();
const historyStore = useHistoryStore();

const containerRef = ref<HTMLDivElement | null>(null);
const error = ref<string | null>(null);
const playingTitle = ref('');

// 播放器可用倍速档位（与 ArtPlayer settings 菜单同步）
const RATES = [0.5, 0.75, 1, 1.25, 1.5, 2, 3] as const;
type Rate = (typeof RATES)[number];
// 默认 1x；从 localStorage 读取上次选择，没有则回退 1
const savedRate = storage.get<number>(STORAGE_KEYS.playbackRate, 1);
const currentRate = ref<Rate>(
  (RATES as readonly number[]).includes(savedRate) ? (savedRate as Rate) : 1,
);

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
    // 显式启用控制栏的设置菜单
    setting: true,
    // 显式启用倍速选项 + 档位（settings 菜单里可切）
    playbackRate: true,
    playbackRateList: [...RATES],
    // 初始化时使用记忆倍速
    currentRate: currentRate.value,
  };
  if (useHls) options.type = 'm3u8';

  try {
    art = new Artplayer(options as unknown as ConstructorParameters<typeof Artplayer>[0]);
  } catch (e) {
    error.value = e instanceof Error ? e.message : '播放器初始化失败';
    return;
  }

  // 同步 ArtPlayer 倍速变化（settings 菜单切换 / 切集重建都会触发）
  art.on('video:ratechange', () => {
    if (!art) return;
    const r = art.playbackRate;
    if (RATES.includes(r as Rate)) {
      currentRate.value = r as Rate;
      storage.set(STORAGE_KEYS.playbackRate, r);
    }
  });

  // 续播：loadedmetadata 后跳到 startAt（来自历史页续播场景）
  const startAt = playerStore.current?.startAt;
  if (typeof startAt === 'number' && startAt > 0) {
    const seek = () => {
      if (art) art.currentTime = startAt;
    };
    // 视频元数据已就绪则直接 seek；否则挂一次性监听器
    const v = art.video;
    if (v && v.readyState >= 1) seek();
    else art.once('video:loadedmetadata', seek);
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

// 玩家下方按钮条：直接切倍速
function setRate(r: Rate) {
  currentRate.value = r;
  storage.set(STORAGE_KEYS.playbackRate, r);
  if (art) {
    art.playbackRate = r;
    art.play(); // 某些浏览器切倍速会暂停
  }
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

    <!-- 错误展示 -->
    <div v-if="error" class="error">{{ error }}</div>

    <!-- 播放控制：倍速按钮条（位于播放器下方，黑色背景） -->
    <div v-else class="rate-bar" role="group" aria-label="倍速">
      <button
        v-for="r in RATES"
        :key="r"
        type="button"
        class="rate-btn"
        :class="{ 'rate-btn--active': currentRate === r }"
        @click="setRate(r)"
      >
        {{ r }}x
      </button>
    </div>
  </div>
</template>

<style scoped>
.player-page {
  padding-top: 46px;
  min-height: 100vh;
  background: black;
}
.art-wrap {
  width: 100%;
  aspect-ratio: 16 / 9;
  background: black;
}
.error {
  color: white;
  padding: 16px;
  text-align: center;
}

/* 倍速按钮条：水平居中排列，间隔均匀 */
.rate-bar {
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  align-items: center;
  gap: 8px;
  padding: 16px 12px;
  background: #000;
}
.rate-btn {
  min-width: 52px;
  height: 36px;
  padding: 0 12px;
  background: transparent;
  color: rgba(255, 255, 255, 0.7);
  border: 1px solid rgba(255, 255, 255, 0.3);
  border-radius: 18px;
  font-size: 13px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.15s ease;
  -webkit-tap-highlight-color: transparent;
}
.rate-btn:active { transform: scale(0.96); }
.rate-btn--active {
  background: var(--van-primary-color);
  color: #fff;
  border-color: var(--van-primary-color);
}
</style>
