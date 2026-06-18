import { fileURLToPath, URL } from 'node:url'
import vue from '@vitejs/plugin-vue'
import { defineConfig } from 'vitest/config'

export default defineConfig({
  plugins: [vue()],
  resolve: {
    alias: {
      '@hplayer/core': fileURLToPath(new URL('./packages/core/src', import.meta.url)),
      '@hplayer/core/*': fileURLToPath(new URL('./packages/core/src/*', import.meta.url)),
      '@hplayer/ui': fileURLToPath(new URL('./packages/ui/src', import.meta.url)),
      '@hplayer/ui/*': fileURLToPath(new URL('./packages/ui/src/*', import.meta.url)),
      '@hplayer/router': fileURLToPath(new URL('./packages/router/src', import.meta.url)),
      '@hplayer/views': fileURLToPath(new URL('./packages/views/src', import.meta.url)),
      '@hplayer/views/*': fileURLToPath(new URL('./packages/views/src/*', import.meta.url)),
    },
  },
  test: {
    environment: 'jsdom',
    globals: true,
    include: ['packages/**/*.{test,spec}.ts', 'apps/**/*.{test,spec}.ts'],
    coverage: {
      provider: 'v8',
      include: ['packages/core/src/**/*.{ts,vue}'],
      exclude: [
        'packages/core/src/**/*.{test,spec}.ts',
        'packages/core/src/types/**',
        'packages/core/src/index.ts',
        'packages/core/src/adapter/aggregate.ts',
        // 迁移工具（V2 阶段）
        'packages/core/src/utils/migrate.ts',
      ],
      reporter: ['text', 'json-summary'],
    },
  },
})
