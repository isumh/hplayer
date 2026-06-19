# hplayer

移动端优先的极简影视资源浏览器，支持 Web Mobile 与 Capacitor Android 双端。

> 本项目为个人学习/工具项目，所有数据本地存储，不上传云端。

---

## 功能特性

- **多源聚合**：支持 Apple CMS **T0_XML** 与 **T1_JSON** 协议源，首页分类浏览、搜索、详情、播放一站式体验。
- **本地收藏与历史**：收藏影片、播放历史自动记录，历史条目支持续播（回退 10 秒）。
- **数据管理**：设置页支持数据导出/导入 JSON，便于备份与迁移。
- **V2.0 Android 原生能力**：
  - Capacitor 封装为 Android APK；
  - localStorage 迁移至 Capacitor SQLite，解决容量与可靠性问题；
  - 沉浸式状态栏、启动屏、返回键/手势适配；
  - 播放页自动横屏，退出后恢复竖屏；
  - 原生 HTTP 请求绕过 WebView CORS 限制；
  - 应用内版本更新检测。
- **隐私优先**：无登录、无统计、无追踪，所有配置与数据保存在本地。

---

## 技术栈

| 类别 | 选型 | 版本 |
| --- | --- | --- |
| 框架 | Vue 3（`<script setup>`） | ^3.5 |
| 构建 | Vite | ^7.0 |
| 类型 | TypeScript（`exactOptionalPropertyTypes` 严格模式） | ^5.6 |
| 状态 | Pinia | ^2.2 |
| 路由 | vue-router（history 模式） | ^4.4 |
| UI 组件 | Vant | ^4.9 |
| 样式 | Tailwind CSS | ^4.0 |
| 视频 | Artplayer + hls.js | ^5.1 / ^1.5 |
| HTTP | Axios / CapacitorHttp | ^1.7 |
| 代码质量 | Biome | 2.4.5 |
| 测试 | Vitest | ^2.1 |
| 包管理 | pnpm workspace | 9.0.0 |
| 移动端壳 | Capacitor | ^7.0 |

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

### 本地 Android Studio 打包

```bash
# 打开 Android 工程
pnpm open:android
```

然后在 Android Studio 中：

1. 配置 `apps/hplayer_android/android/local.properties`（签名信息不提交到版本控制）。
2. 连接真机或启动模拟器。
3. 执行 `Build → Generate Signed App Bundle / APK` 或 `./gradlew assembleRelease`。

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
