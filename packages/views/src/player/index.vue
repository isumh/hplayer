<script setup lang="ts">
import type { Plugin } from '@capacitor/core'
import { Capacitor } from '@capacitor/core'
import { ScreenOrientation } from '@capacitor/screen-orientation'
import type { capExitListener, capVideoPlayerOptions } from '@capgo/capacitor-video-player'
import { VideoPlayer } from '@capgo/capacitor-video-player'
import {
  detectProtocol,
  isValidVideoUrl,
  STORAGE_KEYS,
  storage,
  useHistoryStore,
  usePlayerStore,
} from '@hplayer/core'
import { NavBar } from '@hplayer/ui'
import Artplayer from 'artplayer'
import Hls from 'hls.js'
import { onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'

const route = useRoute()
const router = useRouter()
const playerStore = usePlayerStore()
const historyStore = useHistoryStore()

const containerRef = ref<HTMLDivElement | null>(null)
const error = ref<string | null>(null)
const playingTitle = ref('')

// POC: Android 原生播放器调试状态
const isNative = ref(false)
const nativeStatus = ref('未启动')
const lastProgress = ref(0)
const nativeError = ref<string | null>(null)
const NATIVE_PLAYER_ID = 'hplayerPocNative'
const isAndroidNative = Capacitor.isNativePlatform() && Capacitor.getPlatform() === 'android'
// 插件类型定义未暴露监听器方法，通过 Capacitor Plugin 类型断言
const nativeVideoPlayer = VideoPlayer as unknown as Plugin & typeof VideoPlayer

// 播放器可用倍速档位（与 ArtPlayer settings 菜单同步）
const RATES = [0.5, 0.75, 1, 1.25, 1.5, 2, 3] as const
type Rate = (typeof RATES)[number]

function isRate(value: number): value is Rate {
  return (RATES as readonly number[]).includes(value)
}

// 默认 1x；从 localStorage 读取上次选择，没有则回退 1
const savedRate = storage.get<number>(STORAGE_KEYS.playbackRate, 1)
const currentRate = ref<Rate>(isRate(savedRate) ? savedRate : 1)

let art: Artplayer | null = null
let hls: Hls | null = null
let lastProgressSave = 0

function teardown() {
  if (hls) {
    hls.destroy()
    hls = null
  }
  if (art) {
    try {
      art.destroy()
    } catch {
      // ignore
    }
    art = null
  }
}

function persistProgress() {
  if (!art || !playerStore.current) return
  const cur = playerStore.current
  if (!cur.episode) return
  historyStore.touch({
    vod: cur.vod,
    sourceId: cur.sourceId,
    episode: cur.episode,
    progress: art.currentTime,
  })
}

function buildPlayer(url: string, title: string, poster: string) {
  if (!containerRef.value) return
  if (!isValidVideoUrl(url)) {
    error.value = '不安全的播放地址'
    return
  }
  teardown()
  const protocol = detectProtocol(url)
  const useHls = protocol === 'hls' && Hls.isSupported()

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
  }
  if (useHls) options.type = 'm3u8'

  try {
    art = new Artplayer(options as unknown as ConstructorParameters<typeof Artplayer>[0])
  } catch (e) {
    error.value = e instanceof Error ? e.message : '播放器初始化失败'
    return
  }

  // 同步 ArtPlayer 倍速变化（settings 菜单切换 / 切集重建都会触发）
  art.on('video:ratechange', () => {
    if (!art) return
    const r = art.playbackRate
    if (isRate(r)) {
      currentRate.value = r
      storage.set(STORAGE_KEYS.playbackRate, r)
    }
  })

  // 续播：loadedmetadata 后跳到 startAt（来自历史页续播场景）
  const startAt = playerStore.current?.startAt
  if (typeof startAt === 'number' && startAt > 0) {
    const seek = () => {
      if (art) art.currentTime = startAt
    }
    // 视频元数据已就绪则直接 seek；否则挂一次性监听器
    const v = art.video
    if (v && v.readyState >= 1) seek()
    else art.once('video:loadedmetadata', seek)
  }

  art.on('video:timeupdate', () => {
    if (!art) return
    const now = Date.now()
    if (now - lastProgressSave > 5000) {
      lastProgressSave = now
      persistProgress()
    }
  })

  art.on('destroy', () => {
    persistProgress()
  })
}

// 玩家下方按钮条：直接切倍速
function setRate(r: Rate) {
  currentRate.value = r
  storage.set(STORAGE_KEYS.playbackRate, r)
  if (art) {
    art.playbackRate = r
    art.play() // 某些浏览器切倍速会暂停
  }
  if (isNative.value) {
    void nativeVideoPlayer.setRate({ playerId: NATIVE_PLAYER_ID, rate: r })
  }
}

// POC: Android 原生播放器入口
async function initNativePlayer(url: string, title: string, poster: string, startAt?: number) {
  if (!Capacitor.isNativePlatform() || Capacitor.getPlatform() !== 'android') {
    nativeError.value = `非 Android 原生环境：isNative=${Capacitor.isNativePlatform()} platform=${Capacitor.getPlatform()}`
    return
  }
  if (!isValidVideoUrl(url)) {
    error.value = '不安全的播放地址'
    return
  }
  isNative.value = true
  nativeStatus.value = '正在启动原生播放器...'
  nativeError.value = null
  lastProgress.value = 0

  // 清理旧监听，避免重复
  cleanupNativePlayer()

  nativeVideoPlayer.addListener('jeepCapVideoPlayerReady', () => {
    nativeStatus.value = '原生播放器已就绪'
  })
  nativeVideoPlayer.addListener('jeepCapVideoPlayerPlay', () => {
    nativeStatus.value = '播放中'
  })
  nativeVideoPlayer.addListener('jeepCapVideoPlayerPause', () => {
    nativeStatus.value = '已暂停'
  })
  nativeVideoPlayer.addListener('jeepCapVideoPlayerEnded', () => {
    nativeStatus.value = '播放结束'
    persistNativeProgress()
  })
  nativeVideoPlayer.addListener('jeepCapVideoPlayerExit', (evt: capExitListener) => {
    nativeStatus.value = `已退出（退出时间: ${evt.currentTime ?? 0} 秒）`
    lastProgress.value = evt.currentTime ?? 0
    persistNativeProgress(evt.currentTime)
  })

  const options: capVideoPlayerOptions = {
    mode: 'fullscreen',
    url,
    playerId: NATIVE_PLAYER_ID,
    title,
    artwork: poster,
    rate: currentRate.value,
    displayMode: 'landscape',
    showControls: true,
    pipEnabled: false,
    bkmodeEnabled: false,
    exitOnEnd: true,
  }

  try {
    const res = await nativeVideoPlayer.initPlayer(options)
    if (!res.result) {
      error.value = res.message ?? '原生播放器启动失败'
      isNative.value = false
      return
    }
    // 若需要续播，等待就绪后 seek
    if (typeof startAt === 'number' && startAt > 0) {
      const unready = await nativeVideoPlayer.addListener('jeepCapVideoPlayerReady', () => {
        void nativeVideoPlayer.setCurrentTime({ playerId: NATIVE_PLAYER_ID, seektime: startAt })
        unready.remove()
      })
    }
  } catch (e) {
    const msg = e instanceof Error ? e.message : '原生播放器初始化异常'
    error.value = msg
    nativeError.value = msg
    isNative.value = false
  }
}

async function persistNativeProgress(progress?: number) {
  const cur = playerStore.current
  if (!cur?.episode) return
  let p = progress
  if (typeof p !== 'number') {
    try {
      const res = await nativeVideoPlayer.getCurrentTime({ playerId: NATIVE_PLAYER_ID })
      p = typeof res.value === 'number' ? res.value : 0
    } catch {
      p = 0
    }
  }
  historyStore.touch({
    vod: cur.vod,
    sourceId: cur.sourceId,
    episode: cur.episode,
    progress: p ?? 0,
  })
}

function cleanupNativePlayer() {
  void nativeVideoPlayer.stopAllPlayers()
  nativeVideoPlayer.removeAllListeners()
}

function reopenNative() {
  const cur = playerStore.current
  if (!cur?.episode) {
    error.value = '无效播放会话'
    return
  }
  void initNativePlayer(cur.episode.url, cur.vod.name, cur.vod.pic, cur.startAt)
}

onMounted(async () => {
  const cur = playerStore.current
  const ep = cur?.episode
  if (!ep || !cur) {
    error.value = '无效播放会话'
    return
  }
  playingTitle.value = `${cur.vod.name} - ${ep.name}`
  await lockLandscape()
  if (isAndroidNative) {
    await initNativePlayer(ep.url, cur.vod.name, cur.vod.pic, cur.startAt)
  } else {
    buildPlayer(ep.url, cur.vod.name, cur.vod.pic)
  }
})

onBeforeUnmount(() => {
  teardown()
  cleanupNativePlayer()
  void unlockOrientation()
})

watch(
  () => route.query.ep,
  (ep) => {
    const cur = playerStore.current
    if (!ep || !cur?.episode) return
    if (isAndroidNative) {
      void initNativePlayer(cur.episode.url, cur.vod.name, cur.vod.pic, cur.startAt)
    } else {
      buildPlayer(cur.episode.url, cur.vod.name, cur.vod.pic)
    }
  },
)

async function lockLandscape() {
  if (!Capacitor.isNativePlatform()) return
  await ScreenOrientation.lock({ orientation: 'landscape' })
}

async function unlockOrientation() {
  if (!Capacitor.isNativePlatform()) return
  await ScreenOrientation.unlock()
}

function onBack() {
  persistProgress()
  if (window.history.length > 1) router.back()
  else router.replace('/home')
}
</script>

<template>
  <div class="player-page" :class="{ 'player-page--native': isAndroidNative }">
    <NavBar v-if="!isAndroidNative" :title="playingTitle || '播放'" @click-left="onBack" />
    <!-- Android POC：原生播放器已接管，WebView 中只显示调试信息 -->
    <div v-if="isAndroidNative" class="native-debug">
      <p class="native-tag">Android 原生播放器（POC）</p>
      <p>平台：isNative={{ Capacitor.isNativePlatform() }} | platform={{ Capacitor.getPlatform() }}</p>
      <p class="status">状态：{{ nativeStatus }}</p>
      <p v-if="lastProgress > 0">已保存进度：{{ lastProgress.toFixed(1) }} 秒</p>
      <p v-if="nativeError" class="native-error">错误：{{ nativeError }}</p>
      <button class="native-btn" @click="reopenNative">重新打开原生播放器</button>
    </div>
    <div v-else class="art-wrap" ref="containerRef"></div>

    <!-- 错误展示 -->
    <div v-if="error" class="error">{{ error }}</div>

    <!-- 播放控制：倍速按钮条（Web 端保留，Android 原生播放器使用自带倍速菜单） -->
    <div v-if="!isAndroidNative" class="rate-bar" role="group" aria-label="倍速">
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
  padding-top: calc(46px + constant(safe-area-inset-top));
  padding-top: calc(46px + env(safe-area-inset-top));
  min-height: 100vh;
  background: black;
}
.player-page--native {
  padding-top: 0;
  min-height: 100vh;
}
.art-wrap {
  width: 100%;
  aspect-ratio: 16 / 9;
  background: black;
}
.native-debug {
  color: white;
  padding: 24px 16px;
  text-align: center;
  background: #111;
  min-height: 200px;
}
.native-debug .status {
  color: var(--van-primary-color);
  font-weight: 600;
  margin: 12px 0;
}
.native-debug .native-error {
  color: #ff4d4f;
  margin-top: 12px;
}
.native-btn {
  margin-top: 16px;
  padding: 10px 20px;
  background: var(--van-primary-color);
  color: #fff;
  border: none;
  border-radius: 8px;
  font-size: 14px;
  cursor: pointer;
}
.native-btn:active { opacity: 0.8; }
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
