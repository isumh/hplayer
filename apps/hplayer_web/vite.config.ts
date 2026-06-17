import { fileURLToPath, URL } from 'node:url';
import vue from '@vitejs/plugin-vue';
import { defineConfig } from 'vite';

export default defineConfig({
  plugins: [vue()],
  resolve: {
    alias: {
      '@hplayer/core': fileURLToPath(new URL('../../packages/core/src', import.meta.url)),
      '@hplayer/core/*': fileURLToPath(new URL('../../packages/core/src/*', import.meta.url)),
      '@hplayer/ui': fileURLToPath(new URL('../../packages/ui/src', import.meta.url)),
      '@hplayer/ui/*': fileURLToPath(new URL('../../packages/ui/src/*', import.meta.url)),
      '@hplayer/router': fileURLToPath(new URL('../../packages/router/src', import.meta.url)),
      '@hplayer/views': fileURLToPath(new URL('../../packages/views/src', import.meta.url)),
      '@hplayer/views/*': fileURLToPath(new URL('../../packages/views/src/*', import.meta.url)),
    },
  },
  server: {
    host: '0.0.0.0',
    port: 5173,
  },
});
