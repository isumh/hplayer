<script setup lang="ts">
import type { Plugin } from '@capacitor/core'
import { Capacitor } from '@capacitor/core'
import { ScreenOrientation } from '@capacitor/screen-orientation'
import { KeepAwake } from '@capacitor-community/keep-awake'
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
const nativeHostRef = ref<HTMLDivElement | null>(null)
const error = ref<string | null>(null)
const playingTitle = ref('')

// Android 原生播放器 POC 状态
const isNative = ref(false)
const nativeStatus = ref('未启动')
const nativeError = ref<string | null>(null)
const lastProgress = ref(0)
const NATIVE_PLAYER_ID = 'native-player-host'
const isAndroidNative = Capacitor.isNativePlatform() && Capacitor.getPlatform() === 'android'
// @capgo/capacitor-video-player 类型定义未暴露 addListener/removeAllListeners，按 Capacitor Plugin 断言
const nativeVideoPlayer = VideoPlayer as unknown as Plugin & typeof VideoPlayer

// 原生播放器方向与画面比例状态
type Orientation = 'landscape' | 'portrait'
type ResizeMode = 'fit' | 'fill'
const orientation = ref<Orientation>('landscape')
const resizeMode = ref<ResizeMode>('fit')
const detectingOrientation = ref(false)

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

// 根据视频宽高判断方向（height > width 视为竖屏）
function resolveOrientation(width: number, height: number): Orientation {
  return height > width ? 'portrait' : 'landscape'
}

// 通过临时 <video> 预加载元数据获取视频实际宽高
function detectVideoOrientation(url: string): Promise<Orientation> {
  return new Promise((resolve) => {
    if (!url) {
      resolve('landscape')
      return
    }
    const video = document.createElement('video')
    video.preload = 'metadata'
    video.crossOrigin = 'anonymous'
    video.muted = true
    video.playsInline = true
    video.style.display = 'none'
    document.body.appendChild(video)

    const cleanup = () => {
      video.removeAttribute('src')
      video.load()
      video.remove()
    }

    const timer = setTimeout(() => {
      cleanup()
      resolve('landscape')
    }, 3000)

    video.addEventListener('loadedmetadata', () => {
      clearTimeout(timer)
      const o = resolveOrientation(video.videoWidth, video.videoHeight)
      cleanup()
      resolve(o)
    })
    video.addEventListener('error', () => {
      clearTimeout(timer)
      cleanup()
      resolve('landscape')
    })
    video.src = url
  })
}

// Android 原生播放器 POC
async function initNativePlayer(url: string, startAt?: number) {
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

  await cleanupNativePlayer()

  try {
    await nativeVideoPlayer.addListener('jeepCapVideoPlayerReady', () => {
      nativeStatus.value = '原生播放器已就绪'
    })
    await nativeVideoPlayer.addListener('jeepCapVideoPlayerPlay', () => {
      nativeStatus.value = '播放中'
    })
    await nativeVideoPlayer.addListener('jeepCapVideoPlayerPause', () => {
      nativeStatus.value = '已暂停'
    })
    await nativeVideoPlayer.addListener('jeepCapVideoPlayerEnded', () => {
      nativeStatus.value = '播放结束'
      void persistNativeProgress()
    })
    await nativeVideoPlayer.addListener('jeepCapVideoPlayerExit', async (evt: capExitListener) => {
      nativeStatus.value = `已退出（退出时间: ${evt.currentTime ?? 0} 秒）`
      lastProgress.value = evt.currentTime ?? 0
      await persistNativeProgress(evt.currentTime)
      isNative.value = false
      await restorePortraitAndGoBack()
    })
  } catch (e) {
    const msg = e instanceof Error ? e.message : '原生播放器事件监听失败'
    console.error('[initNativePlayer] addListener error:', e)
    nativeError.value = msg
    isNative.value = false
    return
  }

  const options: capVideoPlayerOptions = {
    mode: 'fullscreen',
    url,
    playerId: NATIVE_PLAYER_ID,
    displayMode: orientation.value,
    showControls: true,
    pipEnabled: false,
    bkmodeEnabled: false,
    exitOnEnd: true,
    chromecast: false,
  }

  try {
    const res = await nativeVideoPlayer.initPlayer(options)
    if (!res.result) {
      const msg = res.message ?? '原生播放器启动失败'
      error.value = msg
      nativeError.value = msg
      isNative.value = false
      return
    }
    if (typeof startAt === 'number' && startAt > 0) {
      void nativeVideoPlayer.setCurrentTime({ playerId: NATIVE_PLAYER_ID, seektime: startAt })
    }
  } catch (e) {
    const msg = e instanceof Error ? e.message : '原生播放器初始化异常'
    console.error('[initNativePlayer] initPlayer error:', e)
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

async function cleanupNativePlayer() {
  try {
    await nativeVideoPlayer.stopAllPlayers()
  } catch (e) {
    console.warn('[cleanupNativePlayer] stopAllPlayers error:', e)
  }
  try {
    await nativeVideoPlayer.removeAllListeners()
  } catch (e) {
    console.warn('[cleanupNativePlayer] removeAllListeners error:', e)
  }
}

async function lockOrientation(o: Orientation) {
  if (!Capacitor.isNativePlatform()) return
  try {
    await ScreenOrientation.lock({ orientation: o })
  } catch (e) {
    console.warn('[lockOrientation] failed:', e)
    await ScreenOrientation.unlock()
  }
}

async function unlockOrientation() {
  if (!Capacitor.isNativePlatform()) return
  await ScreenOrientation.unlock()
}

async function restorePortraitAndGoBack() {
  if (!Capacitor.isNativePlatform()) return
  try {
    await KeepAwake.allowSleep()
  } catch (e) {
    console.warn('[restorePortraitAndGoBack] allowSleep error:', e)
  }
  try {
    await ScreenOrientation.lock({ orientation: 'portrait' })
  } catch {
    await unlockOrientation()
  }
  if (window.history.length > 1) router.back()
  else router.replace('/home')
}

// 切换横竖屏：停止当前原生播放器，重新初始化
async function switchNativeOrientation(next: Orientation) {
  if (orientation.value === next) return
  orientation.value = next
  await lockOrientation(next)
  const cur = playerStore.current
  if (!cur?.episode) return
  // 保留当前进度，重新初始化播放器
  const startAt = lastProgress.value || cur.startAt
  await initNativePlayer(cur.episode.url, startAt)
}

// 切换画面比例。注意：@capgo 插件未暴露 resizeMode/aspectRatio API，
// 当前版本仅记录状态；实际缩放由 ExoPlayer 默认行为决定。
async function switchResizeMode(next: ResizeMode) {
  resizeMode.value = next
  console.warn(`[switchResizeMode] 已切换为 ${next}，但 @capgo 插件不支持原生画面比例控制`)
}

onMounted(async () => {
  const cur = playerStore.current
  const ep = cur?.episode
  if (!ep || !cur) {
    error.value = '无效播放会话'
    return
  }
  playingTitle.value = `${cur.vod.name} - ${ep.name}`
  // 播放时保持屏幕常亮
  if (Capacitor.isNativePlatform()) {
    try {
      await KeepAwake.keepAwake()
    } catch (e) {
      console.warn('[onMounted] keepAwake error:', e)
    }
  }

  if (isAndroidNative) {
    teardown()
    // 自动检测视频方向：竖屏短视频切换到 portrait，默认 landscape
    detectingOrientation.value = true
    try {
      orientation.value = await detectVideoOrientation(ep.url)
    } catch (e) {
      console.warn('[onMounted] detectVideoOrientation error:', e)
      orientation.value = 'landscape'
    } finally {
      detectingOrientation.value = false
    }
    await lockOrientation(orientation.value)
    await initNativePlayer(ep.url, cur.startAt)
  } else {
    buildPlayer(ep.url, cur.vod.name, cur.vod.pic)
  }
})

onBeforeUnmount(async () => {
  teardown()
  await cleanupNativePlayer()
  if (Capacitor.isNativePlatform()) {
    // 退出播放页时恢复系统默认息屏行为
    try {
      await KeepAwake.allowSleep()
    } catch (e) {
      console.warn('[onBeforeUnmount] allowSleep error:', e)
    }
    // 退出播放页时恢复竖屏
    try {
      await ScreenOrientation.lock({ orientation: 'portrait' })
    } catch (e) {
      console.warn('[onBeforeUnmount] restore portrait error:', e)
      await unlockOrientation()
    }
  }
})

watch(
  () => route.query.ep,
  (ep) => {
    const cur = playerStore.current
    if (!ep || !cur?.episode) return
    buildPlayer(cur.episode.url, cur.vod.name, cur.vod.pic)
  },
)

async function onBack() {
  persistProgress()
  if (isNative.value) {
    await restorePortraitAndGoBack()
    return
  }
  if (window.history.length > 1) router.back()
  else router.replace('/home')
}
</script>

<template>
  <div class="player-page" :class="{ 'player-page--native': isNative }">
    <!-- 原生播放器宿主 DOM，满足 playerId 必须对应真实 DOM 的要求 -->
    <div v-if="isAndroidNative" id="native-player-host" ref="nativeHostRef" class="native-host"></div>

    <NavBar v-if="!isAndroidNative" :title="playingTitle || '播放'" @click-left="onBack" />

    <!-- Android 原生环境：自动启动原生播放器，此处显示状态与手动控制 -->
    <div v-if="isAndroidNative" class="native-debug">
      <p class="native-tag">正在启动原生播放器</p>
      <p class="status">{{ nativeStatus }}</p>
      <p v-if="detectingOrientation" class="native-hint">正在检测视频方向...</p>
      <p v-if="nativeError" class="native-error">错误：{{ nativeError }}</p>
      <div class="native-controls">
        <button
          type="button"
          class="native-btn"
          @click="switchNativeOrientation(orientation === 'landscape' ? 'portrait' : 'landscape')"
        >
          {{ orientation === 'landscape' ? '切换竖屏' : '切换横屏' }}
        </button>
        <button
          type="button"
          class="native-btn"
          @click="switchResizeMode(resizeMode === 'fit' ? 'fill' : 'fit')"
        >
          比例：{{ resizeMode === 'fit' ? '适应' : '填充' }}
        </button>
      </div>
    </div>

    <div v-if="!isAndroidNative" class="art-wrap" ref="containerRef"></div>

    <!-- 错误展示 -->
    <div v-if="error" class="error">{{ error }}</div>

    <!-- 播放控制：倍速按钮条 -->
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
.art-wrap {
  width: 100%;
  aspect-ratio: 16 / 9;
  background: black;
}
.player-page--native {
  padding-top: 0;
  min-height: 100vh;
}
.native-host {
  position: absolute;
  width: 0;
  height: 0;
  overflow: hidden;
  visibility: hidden;
}
.native-debug {
  color: white;
  padding: 24px 16px;
  text-align: center;
  background: #111;
  min-height: 200px;
}
.native-debug .native-tag {
  color: var(--van-primary-color);
  font-weight: 600;
  margin-bottom: 12px;
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
.native-debug .native-hint {
  color: rgba(255, 255, 255, 0.6);
  font-size: 12px;
  margin-top: 8px;
}
.native-controls {
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  gap: 12px;
  margin-top: 16px;
}
.native-btn {
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
