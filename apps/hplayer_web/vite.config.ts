import { fileURLToPath, URL } from 'node:url'
import vue from '@vitejs/plugin-vue'
import { HttpProxyAgent } from 'http-proxy-agent'
import { defineConfig } from 'vite'

// 沙箱环境通常通过 http_proxy 访问外部网络；本地开发可能无需代理
const devProxy = process.env.http_proxy || process.env.HTTP_PROXY
const proxyAgent = devProxy ? new HttpProxyAgent(devProxy) : undefined

export default defineConfig({
  plugins: [vue()],
  resolve: {
    alias: {
      '@hplayer/core': fileURLToPath(new URL('../../packages/core/src', import.meta.url)),
      '@hplayer/core/*': fileURLToPath(new URL('../../packages/core/src/*', import.meta.url)),
      '@hplayer/ui': fileURLToPath(new URL('../../packages/ui/src', import.meta.url)),
      '@hplayer/ui/*': fileURLToPath(new URL('../../packages/ui/src/*', import.meta.url)),
      '@hplayer/router': fileURLToPath(new URL('../../packages/router/src', import.meta.url)),
      '@hplayer/router/*': fileURLToPath(new URL('../../packages/router/src/*', import.meta.url)),
      '@hplayer/views': fileURLToPath(new URL('../../packages/views/src', import.meta.url)),
      '@hplayer/views/*': fileURLToPath(new URL('../../packages/views/src/*', import.meta.url)),
    },
  },
  server: {
    host: '0.0.0.0',
    port: 5173,
    proxy: {
      // 开发环境代理电影天堂 XML 源，绕过浏览器 CORS 限制
      '/api.php/provide/vod': {
        target: 'http://caiji.dyttzyapi.com',
        changeOrigin: true,
        // 沙箱等受限环境需要通过 http_proxy 访问外网，给 dev server 代理加一层出站 agent
        agent: proxyAgent,
      },
    },
  },
})
