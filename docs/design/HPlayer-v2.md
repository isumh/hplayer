# HPlayer v2.0 — Capacitor Android 设计文档

> 文档版本：v2.0-design
> 编写日期：2026-06-19
> 前置参考：[HPlayer-v1.1.md](./HPlayer-v1.1.md)、[HPlayer-v1.md](./HPlayer-v1.md)
> 状态：design_ready

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
3. **原生播放体验**：全屏横屏切换；后台音频播放保持与浏览器一致（V2.0 不实现锁屏/通知栏媒体控制）。
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

### 3.2 当前沙箱环境评估（2026-06-19）

| 检查项 | 当前状态 | 结论 |
| --- | --- | --- |
| Node.js | v24.15.0 | ✅ 可用（偏新，但 Capacitor 8 已支持 Node 20+） |
| pnpm | 9.0.0 | ✅ 可用 |
| Java | OpenJDK 25.0.2 | ⚠️ **过新**，Android Gradle Plugin 8.x 官方最高支持 Java 21；沙箱执行 `cap sync` 时可能需降级到 JDK 21，或本地执行 Gradle sync |
| Android SDK | 未安装（`ANDROID_HOME` 为空） | ❌ **缺失**，无法编译/打包 APK |
| `adb` / `sdkmanager` | 不存在 | ❌ **缺失** |
| Capacitor CLI | 未安装 | ❌ 需安装 |
| 磁盘空间 | `/workspace` 剩余约 5G | ⚠️ **紧张**，按方案 A 沙箱不安装完整 Android SDK，只存放 Capacitor 工程与 Web 产物；本地环境负责 SDK 与模拟器 |
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

- **Capacitor CLI**：`^7.0.0`（当前稳定版，支持 Node 20+、Android SDK 34+）
- **@capacitor/android**：`^7.0.0`
- **@capacitor/core**：`^7.0.0`

> 若 Capacitor 8 已正式发布且兼容 Node 24 / AGP 8.x，可在 P8 环境准备阶段评估升级；设计以 7.x 为基线，迁移到 8.x 通常为 minor 调整。

### 4.2 插件清单

| 能力 | 包名 | 版本 | 说明 |
| --- | --- | --- | --- |
| 状态栏 | `@capacitor/status-bar` | ^7.0.0 | 沉浸式、深色/浅色图标 |
| 启动屏 | `@capacitor/splash-screen` | ^7.0.0 | 启动图 + 淡出 |
| KV 存储 | `@capacitor/preferences` | ^7.0.0 | 主题、版本号等轻量配置 |
| SQLite | `@capacitor-community/sqlite` | ^7.0.0 | 业务数据迁移后主存储 |
| 文件系统 | `@capacitor/filesystem` | ^7.0.0 | 缓存、导出备份 |
| 屏幕方向 | `@capacitor/screen-orientation` | ^7.0.0 | 播放页强制横屏 |
| 应用更新 | `@capawesome/capacitor-app-update` | ^7.0.0 | 检测 APK 更新 |
| 后台任务 | `@capawesome/capacitor-background-task` | ^7.0.0 | 切后台保活播放（辅助，V2.0 不保证效果） |
| 震动 | `@capacitor/haptics` | ^7.0.0 | 关键操作反馈 |
| 分享 | `@capacitor/share` | ^7.0.0 | 分享应用/备份文件 |

### 4.3 播放方案

V2.0 分两个阶段：

| 阶段 | 方案 | 说明 |
| --- | --- | --- |
| Phase 8.1 | WebView 内 artplayer + hls.js | 复用 V1.1 全部播放代码，先验证 Android WebView 播放能力 |
| Phase 8.3+（可选） | 原生 ExoPlayer Bridge | 若 WebView HLS 兼容性不足，再引入原生播放器；设计预留接口 |

> V2.0 核心目标是把 Web 应用「装进 Android」，不强制要求第一阶段就替换播放器。原生播放器作为后续增强。

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

## 6. 路由迁移：hash → history

Capacitor 官方推荐在 WebView 内使用 **history 模式**，由 Android `assetlinks`/ WebView 自动 fallback 到 `index.html`。

### 6.1 变更点

- `packages/router/src/index.ts`：
  ```ts
  const router = createRouter({
    history: createWebHistory(import.meta.env.BASE_URL),
    routes,
  })
  ```
- Vite 配置：生产构建无需额外 `historyApiFallback`（Capacitor WebView 已处理）。
- 开发环境：保留 hash 模式可选，避免 `file://` 协议下 history 模式异常；通过 `import.meta.env.VITE_CAPACITOR` 区分。

### 6.2 兼容性

- 所有页面路径不变：`/home`、`/search`、`/settings`、`/detail/:id`、`/player/:id`、`/favorite`、`/history`。
- 路由守卫逻辑不变，仅路由模式切换。

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
- 播放页：进入时强制横屏，退出时恢复竖屏。

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
| 播放 | HLS/MP4 播放、横屏、后台音频（无锁屏控制） |
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

- [ ] 安装 Capacitor CLI 与 `@capacitor/android`
- [ ] 创建 `apps/hplayer_android`
- [ ] 配置 `capacitor.config.ts`（appId、appName、webDir）
- [ ] `pnpm cap add android` 成功
- [ ] `pnpm build && pnpm cap sync android` 成功
- [ ] 本地 Android Studio 环境准备说明：需 JDK 21 + Android SDK + 模拟器或真机

### Phase 8.2：路由与构建适配

- [ ] 路由切换为 history 模式
- [ ] Vite 配置适配 Capacitor 生产构建
- [ ] Android WebView 可正常加载首页
- [ ] 返回键行为符合预期

### Phase 8.3：持久化迁移

- [ ] 抽象 storage 接口
- [ ] 实现 `storage-capacitor.ts`
- [ ] 启用 `migrateV1ToV2()`
- [ ] 测试：添加源 → 杀掉 App → 重启 → 源仍在

### Phase 8.4：原生体验

- [ ] 状态栏/启动屏/导航栏
- [ ] 播放页横屏
- [ ] 返回键适配
- [ ] 文件系统缓存（可选）

### Phase 8.5：网络与 CORS

- [ ] 评估/集成 Capacitor HTTP plugin
- [ ] 真机测试 XML/JSON 源请求

### Phase 8.6：打包与签名

- [ ] debug APK 构建
- [ ] release APK 签名
- [ ] 应用内更新检测

### Phase 8.7：回归与文档

- [ ] 135 个单元测试全部通过
- [ ] 真机核心链路回归
- [ ] 更新 STATE.md 与开发计划状态

---

## 14. 风险与对冲

| 风险 | 对冲 |
| --- | --- |
| 沙箱无 Android SDK，无法直接出 APK | 采用方案 A：沙箱完成工程初始化与 `cap sync`，APK 构建/签名/真机调试在本地 Android Studio 完成 |
| 本地 Java 25 与 Android Gradle Plugin 不兼容 | 本地安装 JDK 21；沙箱侧不处理 APK 构建 |
| WebView HLS 播放失败 | 先验证 WebView 能力，再决定是否引入 ExoPlayer 原生桥接 |
| 第三方源 CORS 在 WebView 仍失败 | 集成 Capacitor HTTP plugin 或提示用户源站不支持 |
| SQLite 迁移失败导致数据丢失 | 迁移前备份 localStorage；幂等设计；失败保留原数据 |
| 后台播放被系统杀 | V2.0 不保证；作为 V2.x 增强项实现 |
| APK 签名配置泄露 | keystore 不提交仓库，通过本地环境变量或 `local.properties` 注入 |

---

## 15. 下一步

1. 用户确认 V2 设计方向与范围（已确认采用方案 A）。
2. 在沙箱执行 Phase 8.1 Task 1–6：Capacitor CLI 安装、`apps/hplayer_android` 创建、`cap add android`、`pnpm build && pnpm cap sync android` 验证。
3. 沙箱验证 `cap sync` 成功后，将工程代码 push 到仓库，用户在本地 Android Studio 完成 JDK 21 + Android SDK 环境配置、真机调试与 release 签名出包。
