# HPlayer v2.0 — Capacitor Android 设计文档

> 文档版本：v2.0-design
> 编写日期：2026-06-19
> 更新日期：2026-06-20
> 前置参考：[HPlayer-v1.1.md](./HPlayer-v1.1.md)、[HPlayer-v1.md](./HPlayer-v1.md)
> 状态：completed

---

## 0. 文档定位

本文件是 HPlayer **v2.0 Android 版**的设计定稿。V2.0 在 V1.1 Web Mobile 基础上，通过 **Capacitor** 将现有 Vue 3 + Vite 产物打包为 Android APK，并补齐原生能力（持久化、状态栏/启动屏、返回键/横屏、应用内更新等）。

本文档明确：

- V2.0 目标与范围
- 开发环境要求与当前沙箱环境评估
- 技术选型与插件清单
- 工程结构变化
- 路由、持久化、网络、播放等关键迁移方案
- 构建、签名、测试与风险对冲

---

## 1. 目标

1. **原生 Android 形态**：将现有 Web 应用封装为 Android APK，保持现有页面结构、交互流程、数据模型不变。
2. **本地持久化升级**：将 `localStorage` 迁移到 Capacitor SQLite，解决容量限制与数据可靠性问题。
3. **原生播放体验**：Android 端使用 `@capgo/capacitor-video-player` 全屏横屏播放，退出后恢复竖屏（V2.0 不实现锁屏/通知栏媒体控制）。
4. **原生壳体验**：沉浸式状态栏、启动屏、返回键/手势适配、版本更新检测。
5. **保持可维护**：Web 代码继续作为单一来源，Android 工程只作为「壳」存在，业务逻辑尽量留在 Web 层。

---

## 2. 范围

### 2.1 包含

| # | 功能 | 落点 |
| --- | --- | --- |
| 1 | Capacitor Android 工程初始化 | `apps/hplayer_android/` |
| 2 | Web 构建产物接入 Capacitor | `apps/hplayer_web/` → `apps/hplayer_android/android/app/src/main/assets/public` |
| 3 | 路由 hash → history 迁移 | `packages/router/src/index.ts` |
| 4 | localStorage → SQLite 迁移 | `packages/core/src/utils/migrate.ts` + `@capacitor-community/sqlite` |
| 5 | 持久化层抽象（Storage 接口） | `packages/core/src/utils/storage.ts` 替换为 Capacitor 实现 |
| 6 | 状态栏/启动屏/导航栏 | `@capacitor/status-bar`、`@capacitor/splash-screen` |
| 7 | 屏幕方向控制 | `@capacitor/screen-orientation` |
| 8 | 文件系统缓存 | `@capacitor/filesystem` |
| 9 | 应用内更新检测 | `@capawesome/capacitor-app-update` |
| 10 | release 签名配置模板（本地执行） | `apps/hplayer_android/android/` Gradle 工程 |
| 11 | V2 构建脚本 | 根 `package.json`：`build:android`、`sync:android`、`open:android` |

### 2.2 不包含（V2.0 不做）

- **iOS 版本**：仅 Android。
- **TV / 桌面端**：保持 Android Mobile 优先。
- **直播 / IPTV / EPG**：延续 V1 范围。
- **用户登录 / 云端同步**：延续 V1「纯本地」策略。
- **自定义视频源解析服务器**：不引入后端。
- **多套皮肤 / 插件系统**：保持极简。
- **Chromecast / DLNA / AirPlay**：超出当前范围。

---

## 3. 开发环境要求与当前评估

### 3.1 必需环境

| 组件 | 推荐版本 | 用途 |
| --- | --- | --- |
| Node.js | 20 LTS 或 22 LTS | Capacitor CLI / Gradle 前置 |
| pnpm | 9.x | 包管理 |
| Java JDK | 17 或 21 | Android Gradle Plugin 要求 |
| Android SDK | API 34+（Android 14+） | 编译与运行 |
| Android SDK Build-Tools | 34.0.0+ | 构建 APK |
| Gradle | 由 AGP 自动拉取 | 构建 Android 工程 |
| Capacitor CLI | 7.x / 8.x | 初始化与同步 |

### 3.2 当前沙箱环境评估（2026-06-20）

| 检查项 | 当前状态 | 结论 |
| --- | --- | --- |
| Node.js | v24.15.0 | ✅ 可用 |
| pnpm | 9.0.0 | ✅ 可用 |
| Java | OpenJDK 25.0.2 | ✅ CI 已使用，兼容 Gradle 8.14.3 |
| Android SDK | 未安装（`ANDROID_HOME` 为空） | ⚠️ 沙箱不打包 APK，CI 已配置 SDK 36 |
| `adb` / `sdkmanager` | 不存在 | ⚠️ 本地真机调试需自备 |
| Capacitor CLI | ^8.0.0 | ✅ 已安装 |
| 磁盘空间 | `/workspace` 剩余约 5G | ⚠️ 按方案 A，沙箱不安装完整 Android SDK |
| 网络代理 | `http_proxy=http://127.0.0.1:18080` | ✅ 可访问 npm；Gradle/Maven 需同样走代理 |
| 操作系统 | Ubuntu 24.04 x86_64 | ✅ 支持 Android SDK linux64 |

### 3.3 环境准备方案

**采用方案 A：本地 Android Studio 开发 + 沙箱只出包**

- 沙箱完成 Capacitor 工程初始化、Web 构建、代码迁移、`pnpm cap sync android` 验证。
- APK 最终签名与真机调试在本地 Android Studio（Windows/macOS/Linux）完成。
- 沙箱不安装完整 Android SDK，节省磁盘；本地环境负责 JDK 21 + Android SDK + 模拟器/真机。

> 本设计文档及配套开发计划均基于方案 A 编写。

---

## 4. 技术选型

### 4.1 Capacitor 版本

- **Capacitor CLI**：`^8.0.0`
- **@capacitor/android**：`^8.0.0`
- **@capacitor/core**：`^8.0.0`

> 实际实施中从 Capacitor 7 升级到 8，以兼容最新 Android SDK 36 与 Gradle 8.14。迁移改动主要为 `variables.gradle` 与 `build.gradle` 版本号升级。

### 4.2 插件清单

| 能力 | 包名 | 版本 | 说明 |
| --- | --- | --- | --- |
| 状态栏 | `@capacitor/status-bar` | ^8.0.0 | 沉浸式、深色/浅色图标 |
| 启动屏 | `@capacitor/splash-screen` | ^8.0.0 | 启动图 + 淡出 |
| KV 存储 | `@capacitor/preferences` | ^8.0.0 | 主题、版本号等轻量配置 |
| SQLite | `@capacitor-community/sqlite` | ^8.0.0 | 业务数据迁移后主存储 |
| 文件系统 | `@capacitor/filesystem` | ^8.0.0 | 缓存、导出备份 |
| 屏幕方向 | `@capacitor/screen-orientation` | ^8.0.0 | 播放页强制横屏 |
| 应用更新 | `@capawesome/capacitor-app-update` | ^8.0.0 | 检测 APK 更新 |
| 后台任务 | `@capawesome/capacitor-background-task` | ^8.0.0 | 切后台保活播放（辅助，V2.0 不保证效果） |
| 震动 | `@capacitor/haptics` | ^8.0.0 | 关键操作反馈 |
| 分享 | `@capacitor/share` | ^8.0.0 | 分享应用/备份文件 |
| 原生视频播放 | `@capgo/capacitor-video-player` | ^8.0.0 | Android 端实际使用的全屏原生播放器 |

### 4.3 播放方案

V2.0 实际落地方案：

| 端 | 方案 | 说明 |
| --- | --- | --- |
| Web / 桌面浏览器 | WebView 内 Artplayer + hls.js | 复用 V1.1 全部播放代码 |
| Android | `@capgo/capacitor-video-player` 原生播放器 | 进入播放页强制横屏全屏，退出恢复竖屏；Capacitor 7 → 8 升级后真机播放稳定 |

> 注：早期 POC 中 `@capgo/capacitor-video-player` 在 Capacitor 7 下曾闪退，升级到 Capacitor 8 + Android SDK 36 后问题消失，V2.0 最终采用该原生方案。

---

## 5. 工程结构变化

```text
hplayer/
├── apps/
│   ├── hplayer_web/                # Web SPA（不变）
│   └── hplayer_android/            # 新增：Capacitor Android 壳
│       ├── android/                # Gradle 工程（由 cap add android 生成）
│       ├── capacitor.config.ts     # Capacitor 配置
│       ├── package.json            # 依赖 @capacitor/android 等
│       └── src/                    # 如需原生桥接插件，源码放此处
├── packages/
│   ├── core/
│   │   └── src/
│   │       ├── utils/
│   │       │   ├── storage.ts      # 抽象存储接口，V2 换 Capacitor 实现
│   │       │   ├── storage-capacitor.ts   # 新增
│   │       │   └── migrate.ts      # V1 → V2 迁移逻辑启用
│   │       └── index.ts            # 导出 Capacitor 初始化相关
│   ├── router/
│   │   └── src/index.ts            # hash → history 模式
│   ├── ui/
│   └── views/
├── package.json                    # 新增 android 脚本
└── docs/dev-plans/09-phase-8-v2.md # V2 开发计划
```

---

## 6. 路由模式：hash 模式

V2.0 最初计划采用 **history 模式**，但在真机测试中发现：Capacitor Android WebView 的 `canGoBack()` 依赖实际 URL 变化，而 `file://` 协议下 `history.pushState` 不会改变地址栏 URL，导致物理返回键/手势直接退出应用。因此最终回退到 **hash 模式**。

### 6.1 变更点

- `packages/router/src/index.ts`：
  ```ts
  const router = createRouter({
    history: createWebHashHistory(import.meta.env.BASE_URL),
    routes,
  })
  ```
- Vite 配置：`base: './'`，确保 Capacitor `file://android_asset/` 协议下资源路径正确。

### 6.2 兼容性

- 所有页面路径不变：`/home`、`/search`、`/settings`、`/detail/:id`、`/player/:id`、`/favorite`、`/history`。
- 路由守卫逻辑不变，仅路由模式切换为 hash，以适配 Android 返回栈。

---

## 7. 持久化迁移：localStorage → SQLite

### 7.1 抽象存储接口

将 `packages/core/src/utils/storage.ts` 从 `localStorage` 硬编码改为接口 + 两套实现：

```ts
// storage.ts
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

export const storage = {
  get: <T>(key: string, fallback?: T) => adapter.get<T>(key, fallback),
  set: <T>(key: string, value: T) => adapter.set<T>(key, value),
  remove: (key: string) => adapter.remove(key),
  clear: () => adapter.clear(),
}
```

- Web 端：`createLocalStorageAdapter()` 继续用 `localStorage`。
- Android 端：`createCapacitorSqliteAdapter()` 用 `@capacitor-community/sqlite`。

### 7.2 SQLite 表设计

与 V1 `localStorage` key 一一对应：

| 表名 | 对应 V1 key | 说明 |
| --- | --- | --- |
| `sources` | `hplayer:sources` | 视频源列表 |
| `settings` | `hplayer:settings` + `hplayer:activeSourceId` | 设置与当前源 |
| `favorites` | `hplayer:favorites` | 收藏 |
| `history` | `hplayer:history` | 历史 |
| `search_history` | `hplayer:searchHistory` | 搜索历史 |

### 7.3 V1 → V2 迁移

`packages/core/src/utils/migrate.ts` 启用：

```ts
export async function migrateV1ToV2(): Promise<void> {
  // 1. 读取 localStorage（Capacitor WebView 仍可用，但数据会迁移后清空）
  // 2. 解析各 key
  // 3. 写入 SQLite
  // 4. 标记 migrationVersion = 2
  // 5. 可选：清空 localStorage 避免双写
}
```

- 迁移时机：App 首次启动（`App.vue` `onMounted`）。
- 幂等：通过 `preferences` 记录 `migrationVersion`，已迁移则跳过。
- 失败处理：Toast 提示，保留 localStorage 不动，下次启动重试。

---

## 8. 网络与 CORS

### 8.1 问题

Android WebView 同样受 CORS 限制，且无法像浏览器扩展那样绕过。第三方 CMS 若未配置 CORS，请求会失败。

### 8.2 方案

| 方案 | 实现 | 优先级 |
| --- | --- | --- |
| A. Capacitor HTTP Plugin | 用 `@capacitor-community/http`（如可用）替换 Axios 底层为原生请求，绕过 WebView CORS | 优先尝试 |
| B. 用户源站校验 | 在添加源时检测 CORS，提示用户 | 辅助 |
| C. 服务端中转 | 不引入 | 不做 |

### 8.3 实现

- 在 `packages/core/src/api/client.ts` 中检测 Capacitor 环境：
  ```ts
  import { Capacitor } from '@capacitor/core'
  const isNative = Capacitor.isNativePlatform()
  ```
- 若 `isNative === true` 且 Capacitor HTTP plugin 可用，优先使用原生请求；否则回退 Axios。
- 保留 V1 的 UAPool 与代理逻辑仅用于 Web 开发环境。

---

## 9. 原生能力集成

### 9.1 状态栏与导航栏

- 启动时根据当前主题设置状态栏颜色。
- 播放页全屏时隐藏状态栏/导航栏，退出后恢复。

### 9.2 启动屏

- 使用 `@capacitor/splash-screen`，配置 Android `splash.png`。
- 启动图淡出 300ms，主 Web 内容加载完成后自动隐藏。

### 9.3 返回键与手势

- Android 物理返回键默认触发 WebView history back。
- 在播放页全屏时，先退出全屏；在首页按返回键时提示「再按一次退出应用」。

### 9.4 屏幕方向

- 普通页面：跟随系统（竖屏）。
- 播放页：进入时锁定横屏并启动 `@capgo/capacitor-video-player` 全屏播放，退出时恢复竖屏。

### 9.5 后台播放（V2.0 不实现系统控制）

- V2.0 不集成 MediaSession / 锁屏通知控制。
- 后台音频行为由 WebView `<video>` / `<audio>` 元素决定，通常切后台后数分钟内可能被系统暂停。
- 如需完整的后台播放 + 锁屏控制，作为 V2.x 增强项通过自定义 Capacitor Plugin 实现。

---

## 10. 构建与打包

### 10.1 沙箱侧构建流程

```bash
# 1. 构建 Web 产物
pnpm build

# 2. 同步到 Capacitor Android 工程
pnpm cap sync android
```

> 按方案 A，沙箱侧只负责产出可同步的 Capacitor Android 工程；APK 构建与签名在本地 Android Studio 完成。

### 10.2 本地侧构建与签名

本地 Android Studio 环境：

```bash
cd apps/hplayer_android/android

# debug APK
./gradlew assembleDebug

# release APK
./gradlew assembleRelease
```

- release APK 必须使用 keystore 签名。
- keystore 与 `local.properties` 不提交到仓库，通过本地环境变量或 `local.properties` 指定路径/密码。

### 10.3 根 package.json 脚本

```json
{
  "scripts": {
    "build:android": "pnpm build && pnpm cap sync android",
    "sync:android": "pnpm cap sync android",
    "open:android": "pnpm cap open android",
    "run:android": "pnpm build && pnpm cap run android"
  }
}
```

> `open:android` 与 `run:android` 依赖本地 Android Studio / 连接设备，沙箱侧不使用。

---

## 11. 测试策略

### 11.1 单元测试

- V1.1 的 135 个测试继续通过。
- 新增 `storage-capacitor.test.ts`：mock `@capacitor-community/sqlite`。
- 新增 `migrate.test.ts`：验证 V1 localStorage → SQLite 字段映射。

### 11.2 真机 / 模拟器测试

| 场景 | 验证点 |
| --- | --- |
| 首次启动 | Splash 显示 → 迁移 → 首页 |
| 视频源添加 | 表单提交 → 持久化到 SQLite → 重启后仍在 |
| 首页浏览 | 分类加载、列表分页、下拉刷新 |
| 播放 | HLS/MP4 原生播放器播放、横屏、退出恢复竖屏 |
| 历史/收藏 | 添加、删除、重启后保留 |
| 主题切换 | 状态栏图标颜色同步 |
| 返回键 | 播放页先退出全屏，首页提示退出 |

### 11.3 CI/CD

- 沙箱 CI：仅验证 `pnpm build` + `pnpm cap sync android` 成功，不生成签名 APK。
- 本地/Release CI：使用 GitHub Actions / 本地脚本签名出包。

---

## 12. 项目结构变化

```text
hplayer/
├── apps/
│   ├── hplayer_web/
│   └── hplayer_android/              # 新增
│       ├── android/                  # Gradle 工程
│       ├── capacitor.config.ts
│       └── package.json
├── packages/
│   ├── core/src/
│   │   └── utils/
│   │       ├── storage.ts            # 抽象接口
│   │       ├── storage-local.ts      # Web 实现（新增/重命名）
│   │       ├── storage-capacitor.ts  # 新增
│   │       └── migrate.ts            # 启用迁移逻辑
│   └── router/src/index.ts           # history 模式
├── package.json                      # android 脚本
└── docs/
    ├── design/HPlayer-v2.md          # 本文档
    └── dev-plans/09-phase-8-v2.md    # V2 开发计划
```

---

## 13. 里程碑

### Phase 8.1：Capacitor 工程初始化（沙箱侧）

- [x] 安装 Capacitor CLI 与 `@capacitor/android`
- [x] 创建 `apps/hplayer_android`
- [x] 配置 `capacitor.config.ts`（appId、appName、webDir）
- [x] `pnpm cap add android` 成功
- [x] `pnpm build && pnpm cap sync android` 成功
- [x] CI 配置 Android SDK 36 自动打包

### Phase 8.2：路由与构建适配

- [x] 路由切换为 hash 模式（history 模式真机返回键异常后回退）
- [x] Vite 配置 `base: './'` 适配 Capacitor 生产构建
- [x] Android WebView 可正常加载首页
- [x] 返回键行为符合预期

### Phase 8.3：持久化迁移

- [x] 抽象 storage 接口
- [x] 实现 `storage-capacitor.ts`
- [x] 启用 `migrateV1ToV2()`
- [x] 测试：添加源 → 杀掉 App → 重启 → 源仍在

### Phase 8.4：原生体验

- [x] 状态栏/启动屏/导航栏
- [x] 播放页横屏
- [x] 返回键适配
- [x] 文件系统缓存（可选）

### Phase 8.5：网络与 CORS

- [x] 评估 Capacitor HTTP plugin
- [x] 真机测试 XML/JSON 源请求
- [x] 配置 `cleartext` 与 `usesCleartextTraffic` 兼容 http 源

### Phase 8.6：打包与签名

- [x] debug/release APK 构建（CI 自动完成）
- [x] release APK 签名（CI 通过 Secrets 注入 keystore）
- [x] 应用内更新检测

### Phase 8.7：回归与文档

- [x] 141 个单元测试全部通过
- [x] 真机核心链路回归（用户验证通过）
- [x] 更新 STATE.md、README.md 与开发计划状态

---

## 14. 风险与对冲

| 风险 | 对冲 |
| --- | --- |
| 沙箱无 Android SDK，无法直接出 APK | 采用方案 A：沙箱完成工程初始化与 `cap sync`，APK 构建/签名/真机调试在本地 Android Studio 完成 |
| 本地 Java 25 与 Android Gradle Plugin 不兼容 | 本地安装 JDK 21；沙箱侧不处理 APK 构建 |
| 原生播放器兼容性 | 已采用 `@capgo/capacitor-video-player`，V2.1 继续评估横竖屏、比例、后台播放等增强 |
| 第三方源 CORS 在 WebView 仍失败 | 集成 Capacitor HTTP plugin 或提示用户源站不支持 |
| SQLite 迁移失败导致数据丢失 | 迁移前备份 localStorage；幂等设计；失败保留原数据 |
| 后台播放被系统杀 | V2.0 不保证；作为 V2.x 增强项实现 |
| APK 签名配置泄露 | keystore 不提交仓库，通过本地环境变量或 `local.properties` 注入 |

---

## 15. V2.0 完成总结

V2.0 已全部完成并通过真机验证：

- Capacitor 8 + Android SDK 36 工程可正常构建 release APK（GitHub Actions 自动签名）。
- Android 端采用 `@capgo/capacitor-video-player` 原生播放器，进入播放页强制横屏全屏，退出恢复竖屏，HLS/MP4 播放稳定。
- Web / 桌面浏览器端继续沿用 Artplayer + hls.js Web 播放器。
- 返回键/手势、状态栏、启动屏、横屏、SQLite 持久化、应用内更新等能力均已实现。

## 16. 下一步

1. V2.0 已通过用户验收，进入 V2.1 优化阶段。
2. V2.1 重点方向：原生播放器横竖屏自动切换、画面比例控制、后台播放、锁屏与防息屏、图片加载与性能优化、数据导出导入可用性提升。
