import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    environment: 'jsdom',
    // 真实网络源测试受外部服务影响，默认不纳入 CI/覆盖率，可手动运行
    exclude: ['**/node_modules/**', '**/dist/**', '**/*.real.test.ts'],
    coverage: {
      include: ['packages/core/src/**/*.ts'],
      exclude: [
        'packages/core/src/index.ts',
        'packages/core/src/types/**',
        'packages/core/src/utils/migrate.ts',
        'packages/core/src/adapter/types.ts',
        'packages/core/src/**/*.test.ts',
        'packages/core/src/**/*.real.test.ts',
      ],
    },
  },
})
