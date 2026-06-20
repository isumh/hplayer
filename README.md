# hplayer

移动端优先的极简影视资源浏览器，支持 Web Mobile 与 Capacitor Android 双端。

> 本项目为个人学习/工具项目，所有数据本地存储，不上传云端。

---

## 功能特性

- **多源聚合**：支持 Apple CMS **T0_XML** 与 **T1_JSON** 协议源，首页分类浏览、搜索、详情、播放一站式体验。
- **本地收藏与历史**：收藏影片、播放历史自动记录，历史条目支持续播（回退 10 秒）。
- **数据管理**：设置页支持数据导出/导入 JSON，便于备份与迁移。
- **V2.0 Android 原生能力**：
  - Capacitor 8 封装为 Android APK，targetSdk/compileSdk 36；
  - localStorage 迁移至 Capacitor SQLite，解决容量与可靠性问题；
  - 沉浸式状态栏、启动屏、返回键/手势适配；
  - Android 端使用 `@capgo/capacitor-video-player` 原生播放器，进入播放页自动横屏全屏，退出后恢复竖屏；
  - 原生 HTTP 请求绕过 WebView CORS 限制；
  - 应用内版本更新检测；
  - GitHub Actions 自动构建并签名 release APK。

### V2.0 真机测试修复要点

- **路由**：最终采用 `createWebHashHistory()`，解决 Android 物理返回键/手势直接退出应用的问题。
- **构建**：Vite `base: './'`，避免 Capacitor `file://` 协议下静态资源 404。
- **网络**：`capacitor.config.ts` 与 `AndroidManifest.xml` 开启 cleartext，兼容 http 视频源。
- **播放器**：Android 端使用 `@capgo/capacitor-video-player` 原生全屏播放器；Capacitor 7 升级至 8 后播放稳定，HLS/MP4 真机验证通过。
- **UI**：设置页可滚动、搜索页播放按钮响应、详情页海报预览、Popup 锁定滚动、viewport 禁用缩放。
- **隐私优先**：无登录、无统计、无追踪，所有配置与数据保存在本地。

---

## 技术栈

| 类别 | 选型 | 版本 |
| --- | --- | --- |
| 框架 | Vue 3（`<script setup>`） | ^3.5 |
| 构建 | Vite | ^7.0 |
| 类型 | TypeScript（`exactOptionalPropertyTypes` 严格模式） | ^5.6 |
| 状态 | Pinia | ^2.2 |
| 路由 | vue-router（hash 模式，适配 Capacitor） | ^4.4 |
| UI 组件 | Vant | ^4.9 |
| 样式 | Tailwind CSS | ^4.0 |
| 视频 | Artplayer + hls.js | ^5.1 / ^1.5 |
| HTTP | Axios / CapacitorHttp | ^1.7 |
| 代码质量 | Biome | 2.4.5 |
| 测试 | Vitest | ^2.1 |
| 包管理 | pnpm workspace | 9.0.0 |
| 移动端壳 | Capacitor | ^8.0 |

---

## 项目结构

```text
hplayer/
├── apps/
│   ├── hplayer_web/          # Web Mobile 入口（Vite + Vue）
│   └── hplayer_android/      # Capacitor Android 工程
├── packages/
│   ├── core/                 # 业务核心：CMS 适配器、API 客户端、Store、工具函数
│   ├── router/               # 路由定义
│   ├── ui/                   # 可复用 UI 组件
│   └── views/                # 页面级 Vue 组件
├── docs/
│   ├── design/               # 设计文档
│   ├── dev-plans/            # 开发计划与 STATE 跟踪
│   └── CodeWiki.md           # 代码知识库
├── e2e/                      # E2E 辅助脚本
├── package.json
├── pnpm-workspace.yaml
└── vitest.config.ts
```

---

## 快速开始

### 环境要求

- Node.js 20 LTS 或更高
- pnpm 9.x
- （可选，Android 打包）JDK 17/21 + Android SDK + Android Studio

### 安装依赖

```bash
pnpm install
```

### 启动开发服务器

```bash
pnpm dev
```

浏览器访问 [http://localhost:5173/](http://localhost:5173/)。

### 构建 Web

```bash
pnpm build
```

产物输出到 `apps/hplayer_web/dist/`。

### 同步到 Android

```bash
pnpm sync:android
```

该命令会先确保 `apps/hplayer_web/dist/` 已构建，并将产物复制到 `apps/hplayer_android/android/app/src/main/assets/public/`。

### Android 构建关键配置

V2.0 在 `apps/hplayer_android/` 下已预置以下适配，通常无需手动修改：

| 配置项 | 文件 | 说明 |
| --- | --- | --- |
| Vite 相对路径 | `apps/hplayer_web/vite.config.ts` | `base: './'`，避免 `file://` 资源 404 |
| Hash 路由 | `packages/router/src/index.ts` | `createWebHashHistory()`，适配 Android 返回栈 |
| Cleartext | `capacitor.config.ts` + `AndroidManifest.xml` | 允许 http 源请求 |
| Edge-to-edge | `capacitor.config.ts` | `adjustMarginsForEdgeToEdge: true` |
| Release 混淆 | `android/app/build.gradle` + `proguard-rules.pro` | R8 开启，已补充 OkHttp `-dontwarn` 规则 |

> 本地打包前请确保 JDK 17/21 与 Android SDK（API 36）已正确配置。

### 本地 Android Studio 打包

```bash
# 打开 Android 工程
pnpm open:android
```

然后在 Android Studio 中：

1. 配置 `apps/hplayer_android/android/local.properties`（签名信息不提交到版本控制）。
2. 连接真机或启动模拟器。
3. 执行 `Build → Generate Signed App Bundle / APK` 或 `./gradlew assembleRelease`.

### GitHub Actions 自动打包

项目已配置 CI 工作流 [`.github/workflows/build-apk.yml`](.github/workflows/build-apk.yml)，无需本地 Android 环境即可自动构建 release APK。

完整操作指南（Token 生成、权限配置、本地签名、Secrets 配置）见 [`docs/github-actions-apk-guide.md`](docs/github-actions-apk-guide.md)。

#### 1. 生成本地 release 签名文件

```bash
cd apps/hplayer_android/android/app
keytool -genkey -v \
  -keystore release.keystore \
  -alias hplayer \
  -keyalg RSA \
  -keysize 2048 \
  -validity 10000
```

请妥善保管 `release.keystore` 文件，**不要提交到 Git**。

#### 2. 将 keystore 转为 base64

```bash
# macOS / Linux
base64 -i release.keystore -o release.keystore.b64

# 或输出到终端（复制全部内容）
base64 release.keystore | tr -d '\n'
```

#### 3. 配置 GitHub Secrets

在仓库页面进入 **Settings → Secrets and variables → Actions → New repository secret**，添加以下 4 个 Secret：

| Secret | 说明 |
| --- | --- |
| `RELEASE_KEYSTORE` | `release.keystore` 文件经 base64 编码后的完整字符串 |
| `RELEASE_STORE_PASSWORD` | 密钥库密码 |
| `RELEASE_KEY_ALIAS` | 别名，例如 `hplayer` |
| `RELEASE_KEY_PASSWORD` | 别名密码 |

> 注意：工作流中的 `RELEASE_STORE_FILE` 已固定为 `release.keystore`， keystore 解码后会直接放在 `apps/hplayer_android/android/app/release.keystore`，与 `build.gradle` 中的相对路径一致。

#### 4. 触发构建

- 推送代码到 `main` / `master` / `feat/**` 分支会自动触发构建。
- 也可以在 **Actions → Build Android APK → Run workflow** 手动触发。

#### 5. 下载 APK

构建完成后，在 Actions 运行详情页底部的 **Artifacts** 中下载 `hplayer-release-apk`，解压后即可得到 `app-release.apk`。

---

## 测试与代码质量

```bash
# 类型检查
pnpm type-check

# 格式化
pnpm format

# Lint
pnpm lint

# 单元测试
pnpm test

# Web 构建
pnpm build

# Android 同步
pnpm sync:android
```

完整回归流水线：

```bash
pnpm type-check && pnpm lint && pnpm test && pnpm build && pnpm sync:android
```

---

## 支持的视频源格式

hplayer 当前支持以下 Apple CMS 接口协议：

- **T0_XML**：XML 格式源（如 `http://example.com/api.php/provide/vod/xml`）。
- **T1_JSON**：JSON 格式源（如 `http://example.com/api.php/provide/vod`）。

添加源时，在设置页填写接口地址、名称、类型与分页大小即可。

---

## 隐私说明

- 所有视频源配置、收藏、历史、设置均保存在本地浏览器存储或 Capacitor SQLite 中。
- 不收集用户身份、设备信息、使用数据。
- 应用直连用户自行添加的第三方视频源，本服务端不介入任何内容分发。

---

## 开源协议

MIT
