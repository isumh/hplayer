<script setup lang="ts">
import { App } from '@capacitor/app'
import { Capacitor } from '@capacitor/core'
import { SplashScreen } from '@capacitor/splash-screen'
import { StatusBar, Style } from '@capacitor/status-bar'
import {
  useHistoryStore,
  usePreviewStore,
  useSearchHistoryStore,
  useSettingsStore,
} from '@hplayer/core'
import { ImagePreview } from 'vant'
import { onBeforeUnmount, onMounted, watch } from 'vue'
import { useRouter } from 'vue-router'

const historyStore = useHistoryStore()
const router = useRouter()
const searchHistoryStore = useSearchHistoryStore()
const previewStore = usePreviewStore()
const settingsStore = useSettingsStore()
const prefersDark = window.matchMedia('(prefers-color-scheme: dark)')

// 滚轮缩放：Vant 4 ImagePreview 默认不支持 mouse wheel zoom，
// 这里全局监听 wheel 事件 + 修改图片 transform 的 scale 部分（保留 translate 避免破坏双击/双指缩放的状态）
function onWheel(e: WheelEvent) {
  if (!previewStore.show) return
  // 仅当 mouse 在图片预览内时才响应
  const target = e.target as HTMLElement | null
  if (!target) return
  if (!target.closest('.van-image-preview')) return
  e.preventDefault()
  const delta = e.deltaY > 0 ? -0.1 : 0.1
  const img =
    (target.closest('.van-image-preview__image') as HTMLElement | null) ??
    (document.querySelector('.van-image-preview__image') as HTMLElement | null)
  if (!img) return
  const t = img.style.transform || ''
  // 提取 translate3d 中的 x/y 与 scale(x) 部分
  const txMatch = t.match(/translate3d\(\s*([-\d.]+)px\s*,\s*([-\d.]+)px/)
  const tx = txMatch?.[1] ?? '0'
  const ty = txMatch?.[2] ?? '0'
  const scMatch = t.match(/scale\(\s*([\d.]+)\s*\)/)
  const cur = scMatch ? parseFloat(scMatch[1] ?? '1') : 1
  const next = Math.max(1, Math.min(3, Number.isFinite(cur) ? cur + delta : 1 + delta))
  // 重组 transform：保留平移 + 更新 scale
  img.style.transform = `translate3d(${tx}px, ${ty}px, 0) scale(${next})`
}

function resetWheelScale() {
  const img = document.querySelector('.van-image-preview__image') as HTMLElement | null
  if (img) img.style.transform = ''
}

async function syncStatusBar() {
  if (!Capacitor.isNativePlatform()) return
  const isDark =
    settingsStore.settings.theme === 'dark' ||
    (settingsStore.settings.theme === 'auto' && prefersDark.matches)
  // Android WebView 对 env(safe-area-inset-top) 支持不稳定，
  // 关闭状态栏覆盖 WebView，使内容从状态栏下方开始渲染，避免顶部按钮被遮挡。
  await StatusBar.setOverlaysWebView({ overlay: false })
  await StatusBar.setStyle({ style: isDark ? Style.Dark : Style.Light })
  await StatusBar.setBackgroundColor({ color: isDark ? '#0a0a0a' : '#ffffff' })
}

let backButtonListener: { remove: () => Promise<void> } | null = null

async function setupBackButton() {
  if (!Capacitor.isNativePlatform()) return
  backButtonListener = await App.addListener('backButton', ({ canGoBack }) => {
    const currentPath = router.currentRoute.value.path
    // 播放页优先触发路由返回（页面 unmount 时会清理原生播放器）
    if (currentPath.startsWith('/player')) {
      router.back()
      return
    }
    // 首页按返回键退出应用
    if (currentPath === '/home' || currentPath === '/') {
      void App.exitApp()
      return
    }
    // 其他页面：能后退则返回上一页，不能后退则回首页兜底，避免误退出应用
    if (canGoBack) {
      router.back()
    } else {
      router.replace('/home')
    }
  })
}

onMounted(() => {
  historyStore.cleanup()
  searchHistoryStore.cleanup()
  window.addEventListener('wheel', onWheel, { passive: false })
  prefersDark.addEventListener('change', syncStatusBar)

  if (Capacitor.isNativePlatform()) {
    SplashScreen.hide()
    void syncStatusBar()
    void setupBackButton()
  }
})

watch(() => settingsStore.settings.theme, syncStatusBar)

onBeforeUnmount(() => {
  window.removeEventListener('wheel', onWheel)
  prefersDark.removeEventListener('change', syncStatusBar)
  void backButtonListener?.remove()
})
</script>

<template>
  <router-view />
  <!-- 全局单例图片预览：closeOnClickImage/closeOnClickOverlay 控制点击关闭；doubleScale 启用双击/双指缩放 -->
  <ImagePreview
    v-model:show="previewStore.show"
    :images="previewStore.images"
    :start-position="previewStore.startIndex"
    closeable
    close-on-click-image
    close-on-click-overlay
    double-scale
    :max-zoom="3"
    @closed="resetWheelScale"
  />
</template>

<style>
/* 确保原生与 Web 端路由页面都能基于视口高度使用 flex 布局 */
html,
body,
#app {
  height: 100%;
  margin: 0;
  padding: 0;
}
</style>
