import { router } from '@hplayer/router'
import { createPinia } from 'pinia'
import piniaPluginPersistedstate from 'pinia-plugin-persistedstate'
import { createApp } from 'vue'
import 'vant/lib/index.css'
// 桌面端 touch 事件适配：让 SwipeCell 等需要 touch 事件的组件在桌面浏览器中也能正常工作
// 必须在 vant css 之后、createApp 之前引入
import '@vant/touch-emulator'
import App from './App.vue'
import './styles/tailwind.css'
import './styles/vant-theme.css'

const app = createApp(App)
const pinia = createPinia()
pinia.use(piniaPluginPersistedstate)
app.use(pinia)
app.use(router)
app.mount('#app')
