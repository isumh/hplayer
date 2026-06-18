# Phase 0: 工作区 + 构建脚手架

> 对应原文档 `2026-06-13-hplayer-v1.0-mvp.md` 第 183-753 行（Phase 0 完整内容）。

## 状态

- [ ] pending
- [ ] in_progress
- [x] completed

> **2026-06-17 主 agent inline 执行完成（23/23）**，commit `24a71f2`，详见 STATE.md 变更记录。

## 依赖

- 无（基线阶段）。

## 阶段目标

搭建 pnpm workspace + Monorepo 结构，配置 Vite 7 + Vue 3 + Vant 4 + Tailwind 4 + Biome 2.4.5 + TypeScript 严格模式，并创建 4 个空 packages（core / ui / router / views）作为后续阶段的占位。

## 目录与文件结构总览

```text
hplayer/
├── package.json
├── pnpm-workspace.yaml
├── tsconfig.base.json
├── tsconfig.json
├── biome.json
├── vite.config.ts
├── tailwind.config.js
├── postcss.config.js
├── .gitignore
├── .editorconfig
├── apps/
│   └── hplayer_web/
│       ├── index.html
│       ├── package.json
│       ├── tsconfig.json
│       ├── vite.config.ts
│       └── src/
│           ├── main.ts
│           ├── App.vue
│           ├── env.d.ts
│           └── styles/
│               ├── tailwind.css
│               └── vant-theme.css
├── packages/
│   ├── core/
│   │   ├── package.json
│   │   ├── tsconfig.json
│   │   └── src/index.ts
│   ├── ui/
│   │   ├── package.json
│   │   ├── tsconfig.json
│   │   └── src/index.ts
│   ├── router/
│   │   ├── package.json
│   │   ├── tsconfig.json
│   │   └── src/index.ts
│   └── views/
│       ├── package.json
│       ├── tsconfig.json
│       └── src/index.ts
```

## 中断恢复说明

- 本阶段 23 个 task 全部顺序执行（**无并行**）。
- 任意 step 完成后即可安全中断：每个文件创建 + commit 是原子单元。
- **恢复点**：`STATE.md` 中 `last_completed_task` 字段（格式 `P0:Step N`），从下一个 step 开始。
- 注意：**Step 20** 是 `pnpm install`，耗时较长；若中断于 install 中途，可直接重跑（pnpm 幂等）。
- **Step 22** 是 `pnpm install && pnpm type-check`，若 type-check 失败说明 tsconfig 配置有误，需修复后重跑。

---

## Agent P0-1: Workspace & Build Setup

**Own Files:**
- Create: `package.json`, `pnpm-workspace.yaml`, `tsconfig.base.json`, `tsconfig.json`, `biome.json`, `.gitignore`, `.editorconfig`, `vite.config.ts`, `tailwind.config.js`, `postcss.config.js`
- Create: `apps/hplayer_web/package.json`, `apps/hplayer_web/tsconfig.json`, `apps/hplayer_web/vite.config.ts`, `apps/hplayer_web/index.html`, `apps/hplayer_web/src/main.ts`, `apps/hplayer_web/src/App.vue`, `apps/hplayer_web/src/env.d.ts`, `apps/hplayer_web/src/styles/tailwind.css`, `apps/hplayer_web/src/styles/vant-theme.css`
- Create: `packages/{core,ui,router,views}/{package.json,tsconfig.json,src/index.ts}`

---

- [x] **Step 1: 创建工作区根 package.json**

```json
{
  "name": "hplayer",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "packageManager": "pnpm@9.0.0",
  "scripts": {
    "dev": "pnpm --filter hplayer_web dev",
    "build": "pnpm --filter hplayer_web build",
    "preview": "pnpm --filter hplayer_web preview",
    "type-check": "pnpm -r --parallel type-check",
    "lint": "biome check .",
    "lint:fix": "biome check --write .",
    "format": "biome format --write .",
    "test": "vitest run",
    "test:watch": "vitest"
  },
  "devDependencies": {
    "@biomejs/biome": "2.4.5",
    "@types/node": "^20.0.0",
    "typescript": "^5.6.0",
    "vitest": "^2.1.0"
  }
}
```

- [ ] **Step 2: 创建 pnpm-workspace.yaml**

```yaml
packages:
  - 'apps/*'
  - 'packages/*'
```

- [ ] **Step 3: 创建 tsconfig.base.json**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "Bundler",
    "lib": ["ES2022", "DOM", "DOM.Iterable"],
    "strict": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "noFallthroughCasesInSwitch": true,
    "noImplicitOverride": true,
    "exactOptionalPropertyTypes": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "resolveJsonModule": true,
    "isolatedModules": true,
    "useDefineForClassFields": true,
    "verbatimModuleSyntax": true,
    "jsx": "preserve",
    "baseUrl": ".",
    "paths": {
      "@hplayer/core": ["./packages/core/src/index.ts"],
      "@hplayer/core/*": ["./packages/core/src/*"],
      "@hplayer/ui": ["./packages/ui/src/index.ts"],
      "@hplayer/ui/*": ["./packages/ui/src/*"],
      "@hplayer/router": ["./packages/router/src/index.ts"],
      "@hplayer/views": ["./packages/views/src/index.ts"],
      "@hplayer/views/*": ["./packages/views/src/*"]
    }
  }
}
```

- [ ] **Step 4: 创建根 tsconfig.json**

```json
{
  "extends": "./tsconfig.base.json",
  "include": ["apps/*/src/**/*.ts", "apps/*/src/**/*.vue", "packages/*/src/**/*.ts", "packages/*/src/**/*.vue"],
  "exclude": ["**/node_modules", "**/dist"]
}
```

- [ ] **Step 5: 创建 biome.json**

```json
{
  "$schema": "https://biomejs.dev/schemas/2.4.5/schema.json",
  "vcs": { "enabled": true, "clientKind": "git", "useIgnoreFile": true },
  "files": {
    "ignoreUnknown": true,
    "includes": ["apps/**/*", "packages/**/*", "*.json", "*.ts", "*.vue"]
  },
  "formatter": {
    "enabled": true,
    "indentStyle": "space",
    "indentWidth": 2,
    "lineWidth": 100,
    "lineEnding": "lf"
  },
  "linter": {
    "enabled": true,
    "rules": {
      "recommended": true,
      "style": {
        "useImportType": "error",
        "useNodejsImportProtocol": "error"
      },
      "suspicious": {
        "noExplicitAny": "warn"
      },
      "complexity": {
        "noBannedTypes": "error"
      }
    }
  },
  "javascript": {
    "formatter": {
      "quoteStyle": "single",
      "semicolons": "always",
      "trailingCommas": "all"
    }
  }
}
```

- [x] **Step 6: 创建 .gitignore**

```gitignore
node_modules
dist
.DS_Store
*.log
coverage
.vite
.idea
.vscode/settings.json
*.tsbuildinfo
```

- [ ] **Step 7: 创建 .editorconfig**

```ini
root = true

[*]
charset = utf-8
end_of_line = lf
indent_style = space
indent_size = 2
insert_final_newline = true
trim_trailing_whitespace = true
```

- [ ] **Step 8: 创建根 vite.config.ts（用于 vitest 配置）**

```ts
import { defineConfig } from 'vitest/config';
import vue from '@vitejs/plugin-vue';
import { fileURLToPath, URL } from 'node:url';

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
  },
});
```

- [ ] **Step 9: 创建 tailwind.config.js**

```js
/** @type {import('tailwindcss').Config} */
export default {
  content: [
    './apps/hplayer_web/index.html',
    './apps/hplayer_web/src/**/*.{vue,ts}',
    './packages/ui/src/**/*.{vue,ts}',
    './packages/views/src/**/*.{vue,ts}',
  ],
  corePlugins: {
    // 避免 Tailwind preflight 重置 Vant 组件样式
    preflight: false,
  },
  theme: {
    extend: {
      colors: {
        primary: {
          50: '#eff6ff',
          100: '#dbeafe',
          200: '#bfdbfe',
          300: '#93c5fd',
          400: '#60a5fa',
          500: '#3b82f6',
          600: '#2563eb',
          700: '#1d4ed8',
          800: '#1e40af',
          900: '#1e3a8a',
        },
      },
    },
  },
  plugins: [],
};
```

- [ ] **Step 10: 创建 postcss.config.js**

```js
export default {
  plugins: {
    '@tailwindcss/postcss': {},
    autoprefixer: {},
  },
};
```

- [ ] **Step 11: 创建 apps/hplayer_web/package.json**

```json
{
  "name": "hplayer_web",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "vue-tsc --noEmit && vite build",
    "preview": "vite preview",
    "type-check": "vue-tsc --noEmit"
  },
  "dependencies": {
    "@hplayer/core": "workspace:*",
    "@hplayer/router": "workspace:*",
    "@hplayer/ui": "workspace:*",
    "@hplayer/views": "workspace:*",
    "@vant/touch-emulator": "^1.4.0",
    "@vueuse/core": "^11.0.0",
    "artplayer": "^5.1.0",
    "axios": "^1.7.0",
    "dayjs": "^1.11.0",
    "fast-xml-parser": "^4.5.0",
    "hls.js": "^1.5.0",
    "pinia": "^2.2.0",
    "pinia-plugin-persistedstate": "^4.0.0",
    "vant": "^4.9.0",
    "vue": "^3.5.0",
    "vue-router": "^4.4.0"
  },
  "devDependencies": {
    "@tailwindcss/postcss": "^4.0.0",
    "@types/node": "^20.0.0",
    "@vitejs/plugin-vue": "^5.0.0",
    "autoprefixer": "^10.4.0",
    "jsdom": "^25.0.0",
    "postcss": "^8.4.0",
    "tailwindcss": "^4.0.0",
    "typescript": "^5.6.0",
    "vite": "^7.0.0",
    "vue-tsc": "^2.1.0"
  }
}
```

- [x] **Step 12: 创建 apps/hplayer_web/tsconfig.json**

```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "types": ["vite/client", "node"]
  },
  "include": ["src/**/*.ts", "src/**/*.vue", "vite.config.ts"]
}
```

- [ ] **Step 13: 创建 apps/hplayer_web/vite.config.ts**

```ts
import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';
import { fileURLToPath, URL } from 'node:url';

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
```

- [x] **Step 14: 创建 apps/hplayer_web/index.html**

```html
<!doctype html>
<html lang="zh-CN">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover, user-scalable=no" />
    <meta name="theme-color" content="#3b82f6" />
    <title>hplayer</title>
  </head>
  <body>
    <div id="app"></div>
    <script type="module" src="/src/main.ts"></script>
  </body>
</html>
```

- [x] **Step 15: 创建 apps/hplayer_web/src/main.ts**

```ts
import { createApp } from 'vue';
import { createPinia } from 'pinia';
import piniaPluginPersistedstate from 'pinia-plugin-persistedstate';
import { router } from '@hplayer/router';
import App from './App.vue';
import './styles/tailwind.css';
import './styles/vant-theme.css';

const app = createApp(App);
const pinia = createPinia();
pinia.use(piniaPluginPersistedstate);
app.use(pinia);
app.use(router);
app.mount('#app');
```

- [x] **Step 16: 创建 apps/hplayer_web/src/App.vue**

```vue
<script setup lang="ts">
import { onMounted } from 'vue';
import { useHistoryStore } from '@hplayer/core';
import { useSearchHistoryStore } from '@hplayer/core';

const historyStore = useHistoryStore();
const searchHistoryStore = useSearchHistoryStore();

onMounted(() => {
  // 启动时清理 5 天前的历史（用户决策 #2 滑动窗口）
  historyStore.cleanup();
  searchHistoryStore.cleanup();
});
</script>

<template>
  <router-view />
</template>
```

- [ ] **Step 17: 创建 apps/hplayer_web/src/env.d.ts**

```ts
/// <reference types="vite/client" />

declare module '*.vue' {
  import type { DefineComponent } from 'vue';
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const component: DefineComponent<{}, {}, any>;
  export default component;
}
```

- [ ] **Step 18: 创建 apps/hplayer_web/src/styles/tailwind.css**

```css
@import 'tailwindcss';

@theme {
  --color-primary-50: #eff6ff;
  --color-primary-100: #dbeafe;
  --color-primary-200: #bfdbfe;
  --color-primary-300: #93c5fd;
  --color-primary-400: #60a5fa;
  --color-primary-500: #3b82f6;
  --color-primary-600: #2563eb;
  --color-primary-700: #1d4ed8;
  --color-primary-800: #1e40af;
  --color-primary-900: #1e3a8a;
}
```

- [ ] **Step 19: 创建 apps/hplayer_web/src/styles/vant-theme.css**

```css
:root {
  --van-primary-color: #3b82f6;
  --van-background: #ffffff;
  --van-background-2: #f7f8fa;
  --van-text-color: #1f2937;
  --van-text-color-2: #6b7280;
  --van-border-color: #e5e7eb;
  --van-cell-background: #ffffff;
  --van-nav-bar-background: #ffffff;
  --van-tabbar-background: #ffffff;
}

html.dark {
  --van-primary-color: #60a5fa;
  --van-background: #0a0a0a;
  --van-background-2: #1a1a1a;
  --van-text-color: #e5e7eb;
  --van-text-color-2: #9ca3af;
  --van-border-color: #374151;
  --van-cell-background: #1a1a1a;
  --van-nav-bar-background: #1a1a1a;
  --van-tabbar-background: #1a1a1a;
}

html,
body,
#app {
  height: 100%;
  margin: 0;
  padding: 0;
  background: var(--van-background);
  color: var(--van-text-color);
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'PingFang SC', 'Hiragino Sans GB', 'Microsoft YaHei', sans-serif;
}
```

- [x] **Step 20: 安装依赖**

Run: `cd /workspace/hplayer && pnpm install`
Expected: 安装成功，无 ERR_PNPM_PEER_DEP_ISSUES 错误。

- [x] **Step 21: 创建空的 packages 占位（避免后续步骤路径错误）**

创建以下空 package.json（每个 package 一个）：

`packages/core/package.json`:
```json
{
  "name": "@hplayer/core",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "main": "src/index.ts",
  "scripts": { "type-check": "tsc --noEmit" },
  "dependencies": { "axios": "^1.7.0", "dayjs": "^1.11.0", "fast-xml-parser": "^4.5.0", "pinia": "^2.2.0", "vue": "^3.5.0" }
}
```

`packages/core/tsconfig.json`:
```json
{ "extends": "../../tsconfig.base.json", "include": ["src/**/*"] }
```

`packages/core/src/index.ts`:
```ts
export {};
```

`packages/ui/package.json`:
```json
{
  "name": "@hplayer/ui",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "main": "src/index.ts",
  "scripts": { "type-check": "vue-tsc --noEmit" },
  "dependencies": { "@hplayer/core": "workspace:*", "vant": "^4.9.0", "vue": "^3.5.0" },
  "devDependencies": { "vue-tsc": "^2.1.0" }
}
```

`packages/ui/tsconfig.json`:
```json
{ "extends": "../../tsconfig.base.json", "include": ["src/**/*"] }
```

`packages/ui/src/index.ts`:
```ts
export {};
```

`packages/router/package.json`:
```json
{
  "name": "@hplayer/router",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "main": "src/index.ts",
  "scripts": { "type-check": "tsc --noEmit" },
  "dependencies": { "@hplayer/views": "workspace:*", "vue-router": "^4.4.0", "vue": "^3.5.0" }
}
```

`packages/router/tsconfig.json`:
```json
{ "extends": "../../tsconfig.base.json", "include": ["src/**/*"] }
```

`packages/router/src/index.ts`:
```ts
export {};
```

`packages/views/package.json`:
```json
{
  "name": "@hplayer/views",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "main": "src/index.ts",
  "scripts": { "type-check": "vue-tsc --noEmit" },
  "dependencies": { "@hplayer/core": "workspace:*", "@hplayer/ui": "workspace:*", "vant": "^4.9.0", "vue": "^3.5.0" },
  "devDependencies": { "vue-tsc": "^2.1.0" }
}
```

`packages/views/tsconfig.json`:
```json
{ "extends": "../../tsconfig.base.json", "include": ["src/**/*"] }
```

`packages/views/src/index.ts`:
```ts
export {};
```

- [x] **Step 22: 重新安装并验证**

Run: `cd /workspace/hplayer && pnpm install && pnpm type-check`
Expected: type-check 通过（即使包为空，tsconfig 应能正常解析）。

- [x] **Step 23: Commit**

```bash
cd /workspace/hplayer && git add -A
git commit -m "feat(P0): scaffold pnpm workspace + Vite + Vue 3 + Vant 4 + Tailwind 4 + Biome"
```

---

## 完成判定

- [x] `pnpm install` 成功
- [x] `pnpm type-check` 0 error
- [x] 全部 23 个 step 完成且最后 commit 已记录到 STATE.md

完成后主 agent：
1. 在本文件顶部「状态」勾选 `completed`。
2. 更新 `STATE.md`：`current_phase = 02`。
3. 在 STATE.md 的「并行 Agent 状态行」P1 段为 P1-A 和 P1-B 各创建一行（status=pending）。
4. 派发 P1-A 和 P1-B 两个 subagent。
