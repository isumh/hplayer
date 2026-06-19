import { Capacitor } from '@capacitor/core'
import { router } from '@hplayer/router'
import { createPinia } from 'pinia'
import { createApp } from 'vue'
import 'vant/lib/index.css'
// 桌面端 touch 事件适配：让 SwipeCell 等需要 touch 事件的组件在桌面浏览器中也能正常工作
// 必须在 vant css 之后、createApp 之前引入
import '@vant/touch-emulator'
import App from './App.vue'
import './styles/tailwind.css'
import './styles/vant-theme.css'

async function bootstrap() {
  // Android 原生平台：先初始化 SQLite 并迁移 V1 数据，再创建 Store
  if (Capacitor.isNativePlatform()) {
    const { initCapacitorStorage, capacitorStorageAdapter } = await import(
      '@hplayer/core/utils/storage-capacitor'
    )
    const { migrateV1ToV2 } = await import('@hplayer/core')
    const { switchStorage } = await import('@hplayer/core')

    await initCapacitorStorage()
    switchStorage(capacitorStorageAdapter)
    await migrateV1ToV2(capacitorStorageAdapter)
  }

  const app = createApp(App)
  const pinia = createPinia()
  app.use(pinia)
  app.use(router)
  app.mount('#app')
}

bootstrap().catch((err) => {
  console.error('[bootstrap] failed', err)
})
