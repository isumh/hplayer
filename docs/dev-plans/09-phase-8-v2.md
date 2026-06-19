# Phase 8: V2.0 Capacitor Android

> 对应设计文档：[docs/design/HPlayer-v2.md](../design/HPlayer-v2.md)
>
> **目标**：将 V1.1 Web Mobile 应用通过 Capacitor 打包为 Android APK，补齐原生能力。

## 状态

- [x] pending
- [x] in_progress
- [ ] completed

## 依赖

- V1.1 增强全部完成（P7）。
- 设计文档 [HPlayer-v2.md](../design/HPlayer-v2.md) 已确认。
- 环境方案已确认：**A（沙箱初始化 + 本地 Android Studio 打包）**。

## 阶段目标

1. **Agent P8-1**：环境准备、Capacitor 工程初始化、`pnpm cap sync android` 成功。
2. **Agent P8-2**：路由 hash → history 迁移、Vite 构建适配、WebView 可加载首页。
3. **Agent P8-3**：抽象 storage 接口、SQLite 实现、V1 → V2 迁移。
4. **Agent P8-4**：状态栏、启动屏、返回键、横屏（V2.0 不实现锁屏/通知栏媒体控制）。
5. **Agent P8-5**：Capacitor HTTP plugin 评估与集成，处理 WebView CORS。
6. **Agent P8-6**：release 签名配置模板（本地执行）、应用内更新检测。
7. **Agent P8-7**：回归测试、文档更新、STATE.md 归档。

## 范围确认

**包含**：Capacitor Android 壳、history 路由、SQLite 持久化、storage 抽象、状态栏/启动屏/返回键、横屏、CORS 处理、release 签名配置模板（本地执行）、应用内更新。

**不包含**：iOS、TV、直播、云同步、登录、原生 ExoPlayer（可选后续增强）。

## 中断恢复说明

- 本阶段按 Agent 顺序执行：P8-1 → P8-2 → P8-3 → P8-4 → P8-5 → P8-6 → P8-7。
- **恢复点**：`STATE.md` 中 `last_completed_task` 字段（格式 `P8-<n>:Task X.Y`）。
- P8-1 必须完全成功后再进入 P8-2；P8-3 持久化迁移完成后再进入 P8-4。

---

## 前置说明

> 当前沙箱环境：`Node v24.15.0`、`pnpm 9.0.0`、`OpenJDK 25.0.2`、`ANDROID_HOME` 未设置、磁盘剩余约 5G。
>
> `cap sync` 可能触发 Gradle sync，OpenJDK 25 有失败风险；届时沙箱可降级到 JDK 21，或将 Gradle sync 步骤也放到本地执行。
>
> **已确认采用方案 A：沙箱初始化 + 本地 Android Studio 打包。**
>
> - 沙箱完成 Capacitor 工程初始化、`cap add android`、`pnpm cap sync android`、Web 代码迁移验证。
> - 最终 APK 签名、真机调试、release 出包在本地 Android Studio 完成。
> - 沙箱不安装完整 Android SDK，不处理 Gradle/APK 构建。

---

## Agent P8-1: 环境准备与 Capacitor 初始化

**Own Files:**
- Create: `apps/hplayer_android/package.json`
- Create: `apps/hplayer_android/capacitor.config.ts`
- Create: `apps/hplayer_android/.gitignore`
- Modify: `package.json`（新增 android 脚本）
- Modify: `pnpm-workspace.yaml`（新增 `apps/hplayer_android`）
- Modify: `apps/hplayer_web/vite.config.ts`（如需调整 base/build 输出）
- Generated: `apps/hplayer_android/android/`（由 `cap add android` 生成，需纳入版本控制）

---

- [x] **Task 1.1: 安装 Capacitor CLI 与核心依赖**

在仓库根目录执行：

```bash
pnpm add -D -w @capacitor/cli@^7.0.0
pnpm add -w @capacitor/core@^7.0.0
```

验证：

```bash
pnpm exec cap --version
# 期望输出 7.x.x
```

---

- [x] **Task 1.2: 创建 hplayer_android package**

创建 `apps/hplayer_android/package.json`：

```json
{
  "name": "hplayer_android",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "scripts": {
    "sync": "cap sync android",
    "open": "cap open android",
    "run": "cap run android"
  },
  "dependencies": {
    "@capacitor/android": "^7.0.0",
    "@capacitor/core": "^7.0.0",
    "@capacitor/status-bar": "^7.0.0",
    "@capacitor/splash-screen": "^7.0.0",
    "@capacitor/preferences": "^7.0.0",
    "@capacitor/filesystem": "^7.0.0",
    "@capacitor/screen-orientation": "^7.0.0",
    "@capacitor/share": "^7.0.0",
    "@capacitor/haptics": "^7.0.0",
    "@capacitor-community/sqlite": "^7.0.0",
    "@capawesome/capacitor-background-task": "^7.0.0",
    "@capawesome/capacitor-app-update": "^7.0.0"
  }
}
```

> 说明：具体版本以 Capacitor 7.x 最新补丁为准；若 Capacitor 8 已发布且兼容，可在 Task 1.1 中评估升级。

---

- [x] **Task 1.3: 创建 capacitor.config.ts**

创建 `apps/hplayer_android/capacitor.config.ts`：

```ts
import type { CapacitorConfig } from '@capacitor/cli'

const config: CapacitorConfig = {
  appId: 'com.hplayer.app',
  appName: 'hplayer',
  webDir: '../../apps/hplayer_web/dist',
  server: {
    androidScheme: 'https',
  },
  plugins: {
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
```

---

- [x] **Task 1.4: 更新 workspace 与根脚本**

修改 `pnpm-workspace.yaml`，确保包含：

```yaml
packages:
  - 'apps/*'
  - 'packages/*'
```

修改根 `package.json`，新增脚本：

```json
{
  "scripts": {
    "build:android": "pnpm build && pnpm --filter hplayer_android sync",
    "sync:android": "pnpm --filter hplayer_android sync",
    "open:android": "pnpm --filter hplayer_android open",
    "run:android": "pnpm build && pnpm --filter hplayer_android run"
  }
}
```

执行 `pnpm install` 安装新依赖。

---

- [x] **Task 1.5: 生成 Android 工程**

在 `apps/hplayer_android` 下执行：

```bash
pnpm exec cap add android
```

成功后会生成 `apps/hplayer_android/android/` 目录。

验证目录结构：

```text
apps/hplayer_android/android/
├── app/
│   ├── src/main/
│   │   ├── AndroidManifest.xml
│   │   ├── java/...
│   │   └── res/...
│   └── build.gradle
├── build.gradle
├── settings.gradle
└── gradlew
```

---

- [x] **Task 1.6: 首次 sync 验证**

执行：

```bash
pnpm build
pnpm sync:android
```

验证：

- `apps/hplayer_android/android/app/src/main/assets/public/` 下出现 Web 构建产物。
- 无 Gradle 同步错误。

> 沙箱未安装 Android SDK。`cap sync` 只要能将 Web 产物复制到 `android/app/src/main/assets/public/` 并完成配置同步即可视为成功；APK 构建与真机调试在本地 Android Studio 完成。

---

- [x] **Task 1.7: commit P8-1**

```bash
git add .
git commit -m "feat(P8-1): initialize Capacitor Android project and workspace scripts"
```

---

## Agent P8-2: 路由与构建适配

**Own Files:**
- Modify: `packages/router/src/index.ts`
- Modify: `apps/hplayer_web/vite.config.ts`
- Modify: `apps/hplayer_web/src/main.ts`（Capacitor 初始化）
- Modify: `apps/hplayer_android/capacitor.config.ts`（如需）
- Modify: `packages/views/src/home/index.vue`（返回键提示，可选）

---

- [x] **Task 2.1: 路由切换为 history 模式**

修改 `packages/router/src/index.ts`：

```ts
import { createRouter, createWebHistory } from 'vue-router'

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes,
})
```

验证 `pnpm type-check` 通过。

---

- [x] **Task 2.2: Vite 配置适配 Capacitor**

确认 `apps/hplayer_web/vite.config.ts`：

- `base` 保持默认 `/`。
- 生产构建输出到 `dist/`。
- 不启用 `historyApiFallback`（Capacitor WebView 已处理）。

如需按环境切换路由模式，可通过环境变量：

```ts
const historyMode = import.meta.env.VITE_ROUTER_HISTORY === 'hash'
  ? createWebHashHistory
  : createWebHistory
```

但 V2 目标为 history 模式，优先保持简单。

---

- [x] **Task 2.3: 初始化 Capacitor 与插件**

修改 `apps/hplayer_web/src/main.ts`：

```ts
import { Capacitor } from '@capacitor/core'
import { StatusBar, Style } from '@capacitor/status-bar'
import { SplashScreen } from '@capacitor/splash-screen'

async function initNative() {
  if (!Capacitor.isNativePlatform()) return
  await StatusBar.setStyle({ style: Style.Dark })
  await SplashScreen.hide()
}

initNative()
```

> 注意：主题色应根据 `useSettingsStore().settings.theme` 动态设置，可在 App.vue 中通过 watch 实现，避免 main.ts 引入 store 循环依赖。

---

- [x] **Task 2.4: 构建产物 sync 后验证**

执行：

```bash
pnpm build
pnpm sync:android
```

检查：

- `apps/hplayer_android/android/app/src/main/assets/public/index.html` 存在。
- 若沙箱有 Android SDK，可尝试 `pnpm run:android` 在连接设备/模拟器上运行。

---

- [x] **Task 2.5: commit P8-2**

```bash
git add .
git commit -m "feat(P8-2): switch router to history mode and wire Capacitor native plugins"
```

---

## Agent P8-3: 持久化迁移

**Own Files:**
- Modify: `packages/core/src/utils/storage.ts`
- Create: `packages/core/src/utils/storage-local.ts`
- Create: `packages/core/src/utils/storage-capacitor.ts`
- Modify: `packages/core/src/utils/migrate.ts`
- Create: `packages/core/src/utils/migrate.test.ts`
- Create: `packages/core/src/utils/storage-capacitor.test.ts`
- Modify: `apps/hplayer_web/src/App.vue`（迁移入口）
- Modify: `packages/core/src/index.ts`（导出迁移函数）

---

- [x] **Task 3.1: 抽象 storage 接口**

重构 `packages/core/src/utils/storage.ts`：

```ts
export interface StorageAdapter {
  get<T>(key: string, fallback?: T): T | undefined
  set<T>(key: string, value: T): void
  remove(key: string): void
  clear(): void
}

let adapter: StorageAdapter = createLocalStorageAdapter()

export function switchStorage(newAdapter: StorageAdapter): void {
  adapter = newAdapter
}

export const storage = { ... }

// 默认导出 localStorage 实现，保持 Web 兼容
export function createLocalStorageAdapter(): StorageAdapter { ... }
```

验证 `pnpm type-check` 与现有测试通过。

---

- [x] **Task 3.2: 实现 storage-local.ts**

将现有 localStorage 实现提取到 `packages/core/src/utils/storage-local.ts`，`storage.ts` 仅保留接口与默认引用。

---

- [x] **Task 3.3: 实现 storage-capacitor.ts**

创建 `packages/core/src/utils/storage-capacitor.ts`：

```ts
import { CapacitorSQLite, SQLiteConnection } from '@capacitor-community/sqlite'
import type { StorageAdapter } from './storage'

export async function createCapacitorSqliteAdapter(): Promise<StorageAdapter> {
  const sqlite = new SQLiteConnection(CapacitorSQLite)
  const db = await sqlite.createConnection(
    'hplayer_db',
    false,
    'no-encryption',
    1,
    false,
  )
  await db.open()
  // 创建表 sources/settings/favorites/history/search_history
  // 提供 get/set/remove/clear 映射
  return { get, set, remove, clear }
}
```

表结构参考 [HPlayer-v2.md §7.2](../design/HPlayer-v2.md#72-sqlite-表设计)。

---

- [x] **Task 3.4: 实现 V1 → V2 迁移逻辑**

修改 `packages/core/src/utils/migrate.ts`：

```ts
import { Preferences } from '@capacitor/preferences'
import { createLocalStorageAdapter } from './storage-local'
import type { StorageAdapter } from './storage'

const MIGRATION_KEY = 'hplayer:migrationVersion'

export async function migrateV1ToV2(adapter: StorageAdapter): Promise<void> {
  const { value } = await Preferences.get({ key: MIGRATION_KEY })
  if (value === '2') return

  const local = createLocalStorageAdapter()
  const sources = local.get('hplayer:sources')
  const settings = local.get('hplayer:settings')
  const activeSourceId = local.get('hplayer:activeSourceId')
  const favorites = local.get('hplayer:favorites')
  const history = local.get('hplayer:history')
  const searchHistory = local.get('hplayer:searchHistory')

  if (sources) adapter.set('sources', sources)
  if (settings) adapter.set('settings', { ...settings, activeSourceId })
  if (favorites) adapter.set('favorites', favorites)
  if (history) adapter.set('history', history)
  if (searchHistory) adapter.set('search_history', searchHistory)

  await Preferences.set({ key: MIGRATION_KEY, value: '2' })
}
```

---

- [x] **Task 3.5: 在 App 启动时选择 storage 并迁移**

修改 `apps/hplayer_web/src/App.vue`：

```ts
import { Capacitor } from '@capacitor/core'
import { switchStorage, storage } from '@hplayer/core'
import { createCapacitorSqliteAdapter } from '@hplayer/core/utils/storage-capacitor'
import { migrateV1ToV2 } from '@hplayer/core'

onMounted(async () => {
  if (Capacitor.isNativePlatform()) {
    const adapter = await createCapacitorSqliteAdapter()
    switchStorage(adapter)
    await migrateV1ToV2(adapter)
  }
  // 原有初始化逻辑...
})
```

> 注意：需避免 `@hplayer/core` 在 Web 构建时无条件引用 Capacitor 包导致打包体积增加。`storage-capacitor.ts` 应使用动态 import 或在 `apps/hplayer_web/src/main.ts` 中按条件加载。

---

- [x] **Task 3.6: 新增测试**

- `storage-capacitor.test.ts`：mock `@capacitor-community/sqlite`。
- `migrate.test.ts`：mock `storage-local` 与 `Preferences`，验证迁移字段映射。

执行 `pnpm test` 通过。

---

- [x] **Task 3.7: commit P8-3**

```bash
git add .
git commit -m "feat(P8-3): abstract storage layer and migrate V1 localStorage to Capacitor SQLite"
```

---

## Agent P8-4: 原生体验

**Own Files:**
- Modify: `apps/hplayer_web/src/App.vue`
- Modify: `packages/views/src/player/index.vue`
- Modify: `packages/views/src/home/index.vue`
- Modify: `apps/hplayer_android/capacitor.config.ts`
- Add Android resources: `apps/hplayer_android/android/app/src/main/res/drawable/splash.png` 等

---

- [x] **Task 4.1: 状态栏主题同步**

在 `App.vue` 中监听 settings theme：

```ts
import { StatusBar, Style } from '@capacitor/status-bar'

watch(() => settingsStore.settings.theme, async (theme) => {
  if (!Capacitor.isNativePlatform()) return
  const isDark = theme === 'dark' || (theme === 'auto' && prefersDark.value)
  await StatusBar.setStyle({ style: isDark ? Style.Dark : Style.Light })
  await StatusBar.setBackgroundColor({ color: isDark ? '#0a0a0a' : '#ffffff' })
}, { immediate: true })
```

---

- [x] **Task 4.2: 启动屏资源**

准备 `splash.png`（推荐 2732×2732），放入：

```text
apps/hplayer_android/android/app/src/main/res/drawable-xxxhdpi/splash.png
```

或按 Capacitor 7 推荐方式使用 `android/app/src/main/res/drawable/splash.png` + `launch_splash.xml`。

验证 `pnpm sync:android` 不报错。

---

- [x] **Task 4.3: 播放页横屏**

修改 `packages/views/src/player/index.vue`：

```ts
import { ScreenOrientation } from '@capacitor/screen-orientation'

onMounted(async () => {
  if (Capacitor.isNativePlatform()) {
    await ScreenOrientation.lock({ orientation: 'landscape' })
  }
})

onBeforeUnmount(async () => {
  if (Capacitor.isNativePlatform()) {
    await ScreenOrientation.lock({ orientation: 'portrait' })
  }
})
```

---

- [x] **Task 4.4: 返回键适配**

修改 `apps/hplayer_web/src/main.ts` 或 `App.vue`：

```ts
import { App as CapApp } from '@capacitor/app'

if (Capacitor.isNativePlatform()) {
  CapApp.addListener('backButton', ({ canGoBack }) => {
    if (!canGoBack) {
      CapApp.exitApp()
      return
    }
    // 播放页全屏时先退出全屏，否则 router.back()
  })
}
```

---

- [x] **Task 4.5: 后台播放（V2.0 不实现系统控制）**

- V2.0 不集成 MediaSession / 锁屏通知控制。
- 后台音频行为由 WebView `<video>` / `<audio>` 元素决定。
- 如需完整后台播放 + 锁屏控制，作为 V2.x 增强项通过自定义 Capacitor Plugin 实现。

---

- [x] **Task 4.6: commit P8-4**

```bash
git add .
git commit -m "feat(P8-4): native shell experience - status bar, splash, orientation, back button"
```

---

## Agent P8-5: 网络与 CORS

**Own Files:**
- Modify: `packages/core/src/api/client.ts`
- Modify: `packages/core/src/api/ua-pool.ts`（按平台调整 UA）
- Modify: `packages/ui/src/business/SourceForm.vue`（源站 CORS 提示）
- Create/Modify: 测试文件

---

- [ ] **Task 5.1: 评估 Capacitor HTTP plugin**

检查 `@capacitor-community/http` 或 Capacitor 官方 HTTP 插件在 7.x 下的可用性。

若可用：

```bash
pnpm --filter hplayer_android add @capacitor-community/http
```

---

- [ ] **Task 5.2: 原生请求适配层**

在 `packages/core/src/api/client.ts` 中：

```ts
import { Capacitor } from '@capacitor/core'

const isNative = Capacitor.isNativePlatform()

export async function nativeGet<T>(url: string, params?: Record<string, unknown>): Promise<T> {
  // 使用 Capacitor HTTP plugin
}
```

保持 `http` Axios 实例在 Web 与开发环境不变；Native 环境下 adapter 层改用原生请求。

---

- [ ] **Task 5.3: adapter 层透明切换**

修改 `packages/core/src/adapter/index.ts` 或 `client.ts`，让 `getAdapter(source).getList/search/getDetail/getCategories` 在 Native 下自动走原生请求。

> 目标：adapter 代码不变，仅底层请求实现切换。

---

- [ ] **Task 5.4: 源站 CORS 检测提示**

在 `SourceForm.vue` 保存源时，可选发送一个探测请求：

- 若 Web 环境下请求失败且响应为 CORS 错误，提示「该源站可能未开启跨域，Android 端可能无法使用」。
- Native 环境下直接使用原生请求，通常不存在 CORS 问题。

---

- [ ] **Task 5.5: commit P8-5**

```bash
git add .
git commit -m "feat(P8-5): Capacitor native HTTP bridge to bypass WebView CORS"
```

---

## Agent P8-6: 打包签名配置（本地执行）与更新检测

> 本 Agent 的 APK 构建与签名任务在**本地 Android Studio** 执行；沙箱侧仅提供 Gradle 配置模板与 `.gitignore` 规则，不生成 release APK。

**Own Files:**
- Modify: `apps/hplayer_android/android/app/build.gradle`
- Modify: `apps/hplayer_android/android/gradle.properties`
- Create: `.gitignore` 规则（不提交 keystore / `local.properties`）
- Modify: `packages/views/src/settings/index.vue`（检查更新按钮）

---

- [ ] **Task 6.1: 配置 release 签名模板**

在 `apps/hplayer_android/android/app/build.gradle` 中配置 signingConfigs：

```gradle
android {
    signingConfigs {
        release {
            storeFile file(RELEASE_STORE_FILE)
            storePassword RELEASE_STORE_PASSWORD
            keyAlias RELEASE_KEY_ALIAS
            keyPassword RELEASE_KEY_PASSWORD
        }
    }
    buildTypes {
        release {
            signingConfig signingConfigs.release
            minifyEnabled false
        }
    }
}
```

在 `local.properties`（不提交）或本地环境变量中提供 keystore 路径与密码。

> 沙箱侧不执行 Gradle 构建，仅确保配置文件语法正确；`./gradlew assembleDebug / assembleRelease` 在本地 Android Studio 完成。

---

- [ ] **Task 6.2: 应用内更新检测**

集成 `@capawesome/capacitor-app-update`：

```ts
import { AppUpdate } from '@capawesome/capacitor-app-update'

async function checkUpdate() {
  const result = await AppUpdate.getAppUpdateInfo()
  if (result.updateAvailability === AppUpdateAvailability.UPDATE_AVAILABLE) {
    // 提示用户
  }
}
```

> 在 `settings/index.vue`「关于」区域新增「检查更新」按钮。

---

- [ ] **Task 6.3: commit P8-6**

```bash
git add .
git commit -m "feat(P8-6): release signing config template and in-app update"
```

---

## Agent P8-7: 回归与文档

**Own Files:**
- Modify: `docs/dev-plans/STATE.md`
- Modify: `docs/dev-plans/09-phase-8-v2.md`（更新勾选状态）
- Modify: `docs/design/HPlayer-v2.md`（如有调整）
- Modify: `.trae/rules/project_rules.md`（补充 Android 检查命令）

---

- [ ] **Task 7.1: 全量质量门禁**

执行：

```bash
pnpm type-check
pnpm lint
pnpm test
pnpm build
pnpm sync:android
```

全部通过。

---

- [ ] **Task 7.2: 本地真机/模拟器回归（本地 Android Studio 环境）**

沙箱侧完成代码与配置后，在本地 Android Studio 连接真机或模拟器验证：

- 首次启动：Splash → 迁移 → 首页
- 添加源 → 分类/列表加载
- 详情 → 播放 → 横屏 → 后台音频（无锁屏控制）
- 收藏/历史 → 杀进程 → 重启 → 数据保留
- 主题切换 → 状态栏同步

沙箱侧若无法连接真机，此 task 记录为「本地待验证」，不影响阶段提交。

---

- [ ] **Task 7.3: 更新 STATE.md**

将 `current_phase` 更新为 `P8 completed`，`last_completed_task` 更新为 `P8-7:Task 7.3`，记录最终 commit hash。

---

- [ ] **Task 7.4: commit P8-7**

```bash
git add .
git commit -m "docs(P8-7): finalize V2.0 Capacitor Android docs and state"
```

---

## 阶段完成判定

| 检查项 | 标准 |
| --- | --- |
| `pnpm type-check` | 5/5 packages 通过 |
| `pnpm lint` | 0 errors |
| `pnpm test` | 135+ 测试通过 |
| `pnpm build` | Web 产物构建成功 |
| `pnpm sync:android` | Capacitor sync 成功 |
| release 签名配置 | `build.gradle` signingConfigs 模板正确，不提交 keystore |
| 本地 debug APK | 可选：在本地 Android Studio 执行 `./gradlew assembleDebug` |
| 本地 release APK | 可选：在本地 Android Studio 执行 `./gradlew assembleRelease` 并签名 |

---

## 风险与对冲

| 风险 | 对冲 |
| --- | --- |
| 沙箱无 Android SDK，无法直接出 APK | 方案 A：沙箱完成工程初始化与 `cap sync`，APK 构建/签名/真机调试在本地 Android Studio 完成 |
| 本地 Java 25 与 AGP 不兼容 | 本地安装 JDK 21；沙箱侧不处理 APK 构建 |
| WebView HLS 播放异常 | 先验证，再引入 ExoPlayer 原生桥接 |
| CORS 在 WebView 仍失败 | 使用 Capacitor HTTP plugin |
| SQLite 迁移数据丢失 | 迁移前备份、幂等、失败保留原数据 |
| 后台播放被杀 | V2.0 不保证；作为 V2.x 增强项实现 |

---

## 变更记录

| 版本 | 日期 | 变更 |
| --- | --- | --- |
| v1.0 | 2026-06-19 | 初始 V2.0 Capacitor Android 开发计划 |
