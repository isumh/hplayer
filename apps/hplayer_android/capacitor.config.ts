import type { CapacitorConfig } from '@capacitor/cli'

const config: CapacitorConfig = {
  appId: 'com.hplayer.app',
  appName: 'hplayer',
  webDir: '../../apps/hplayer_web/dist',
  server: {
    androidScheme: 'https',
    // 允许 http 源请求，部分视频源接口仍为明文
    cleartext: true,
  },
  android: {
    // 适配 Android 14/15 edge-to-edge，避免 Vant 顶部组件被状态栏遮挡
    adjustMarginsForEdgeToEdge: true,
    // 全局窗口背景改为黑色，避免原生全屏播放器顶部状态栏区域露白
    backgroundColor: '#000000',
  },
  plugins: {
    CapacitorHttp: {
      enabled: true,
    },
    StatusBar: {
      backgroundColor: '#000000',
      style: 'DARK',
      overlaysWebView: false,
    },
    SplashScreen: {
      launchShowDuration: 2000,
      launchAutoHide: true,
      backgroundColor: '#3b82f6',
      androidSplashResourceName: 'splash',
      androidScaleType: 'CENTER_CROP',
    },
  },
}

export default config
