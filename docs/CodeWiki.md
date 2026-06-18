# zyfun Code Wiki

> 本 Wiki 基于仓库 `https://github.com/Hiram-Wong/zyfun` 当前主分支源码整理，旨在帮助新成员快速理解项目整体架构、模块职责、关键实现与运行方式。
>
> - 仓库：<https://github.com/Hiram-Wong/zyfun>
> - 名称：zyfun（基于 ZY-Player 演进）
> - 形态：跨平台桌面应用（Windows / macOS / Linux）
> - 技术栈：Electron + Vue 3 + TypeScript + Fastify + libSQL/SQLite + Drizzle ORM
> - 协议：AGPL-3.0

---

## 1. 项目定位

zyfun 是一款**免费、极简、全能的跨平台影音管家**，一站式管理 T1-T4 全类型影视/直播/解析资源，内置多核播放器，提供"老板键"等隐私保护能力。软件仅作为**播放工具**，不存储或分发资源。

- 前身：[ZY-Player](https://github.com/Hunlongyu/ZY-Player)
- 目标：聚合外部"站点/CMS"作为资源入口 → 经由"解析/AIGC"处理 → 通过内置/外置播放器播放
- 特性：插件体系（UI/System/Mix）、WebDAV/iCloud 云备份、AI 助理、嗅探、协议唤起等

---

## 2. 顶层目录结构

```text
zyfun/
├── .github/                # GitHub Issue 模板、CI workflows
├── .husky/                 # Git Hooks（commit-msg、pre-commit、prepare-commit-msg）
├── .vscode/                # VSCode 推荐扩展、调试配置、MCP 配置
├── build/                  # 应用图标、NSIS/MacOS 打包资源
├── design/                 # 设计稿（Sketch）
├── docs/                   # 项目文档（本 Wiki 之外的开发/发布/HarmonyOS 等说明）
├── packages/               # Monorepo 内部包
│   ├── crypto/             # @zy/crypto：base/编码/加密/消息认证等纯函数库（同时供主进程/渲染进程/插件使用）
│   └── vlc/                # @zy/vlc：Electron 中集成 VLC 原生库的本地加载器（Rust + Node-API）
├── patches/                # pnpm patchedDependencies，自定义修补过的依赖
├── resources/              # 资源
│   ├── scripts/            # 二进制下载脚本（uv、bun、ffmpeg、ffprobe）
│   ├── t3Catopen/          # TVBox/CatOpen 兼容的爬虫脚本模板
│   └── t3PyBase/           # T3_PY 适配器所依赖的 Python 爬虫基座
├── scripts/                # 构建/签名/公证/变更日志等 Node 脚本
├── src/
│   ├── main/               # Electron 主进程
│   ├── preload/            # 预加载脚本（contextBridge 暴露给渲染进程）
│   ├── renderer/           # 渲染进程（Vue 3 应用）
│   └── shared/             # 主/渲染进程共用的配置、类型、工具
├── electron.vite.config.ts # electron-vite 构建配置（main/preload/renderer）
├── electron-builder.yml    # electron-builder 打包配置
└── package.json            # 顶层 package、scripts、依赖、pnpm 配置
```

`pnpm-workspace.yaml` 声明：`packages/*`，并显式排除 `packages/vlc`（vlc 由独立的 VitePress 风格的 demo 仓库维护）。

---

## 3. 整体架构

zyfun 是一个典型的 **Electron 多进程 + 内部 HTTP 服务** 应用：

```text
┌──────────────────────────────────────────────────────────────────────┐
│                       Electron 主进程（src/main）                    │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐   │
│  │ Window/Menu │  │  Tray/      │  │  Fastify    │  │  DBService  │   │
│  │ Tray        │  │  Updater    │  │  (HTTP)     │  │  (libSQL)   │   │
│  └─────────────┘  └─────────────┘  └─────────────┘  └─────────────┘   │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐   │
│  │ Plugin      │  │ Proxy/      │  │ Binary/     │  │ FFmpeg/     │   │
│  │ WorkerPool  │  │ Storage     │  │ Python      │  │  CDP        │   │
│  └─────────────┘  └─────────────┘  └─────────────┘  └─────────────┘   │
└────────────▲────────────────────▲─────────────────────▲──────────────┘
             │ ipcMain.handle()   │ WebContents.send() │ Fetch HTTP   │
             │ (IPC 通道)         │ (事件推送)         │ (9978)       │
┌────────────┴────────────────────┴─────────────────────┴──────────────┐
│                       预加载（src/preload）                          │
│  - contextBridge 暴露 window.electron / window.api                   │
└────────────▲──────────────────────────────────────────────────────────┘
             │
┌────────────┴──────────────────────────────────────────────────────────┐
│            渲染进程（src/renderer）— Vue 3 + Pinia + TDesign         │
│  ┌────────┐ ┌────────┐ ┌────────┐ ┌────────┐ ┌────────┐ ┌────────┐    │
│  │  Film  │ │  Live  │ │ Parse  │ │ Moment │ │  Lab   │ │Setting │    │
│  └────────┘ └────────┘ └────────┘ └────────┘ └────────┘ └────────┘    │
│  ┌────────────────────────────────────────────────────────────────┐  │
│  │ Player（x-gplayer / artplayer / 外部播放器）/ Webview / 终端    │  │
│  └────────────────────────────────────────────────────────────────┘  │
└──────────────────────────────────────────────────────────────────────┘
```

关键设计要点：

1. **本地 HTTP 服务**：主进程内嵌一个 Fastify 服务（默认端口 `9978`），渲染进程通过 `@shared/config/env.PORT` 调用，避免把全部能力都通过 IPC 暴露。
2. **协议聚合（CMS Adapter）**：通过统一的 `Adapter` 接口（`init/home/homeVod/category/detail/search/play/action/proxy`）屏蔽 T0~T4 不同站点的差异，并发请求交给 `WorkerPool` 隔离。
3. **数据库 + 配置双写**：`ConfigManager`（基于 `electron-store`，存于 `userData/config.json`）负责"基础开关"；`DbService`（基于 `libSQL/Drizzle`）负责"业务数据"（站点/直播源/解析/收藏/历史/插件）。
4. **多播放器抽象**：`@zy/crypto`、`@zy/vlc` 作为独立工作区子包，编译产物同时被主进程和渲染进程复用。
5. **插件体系**：通过 `workerpool` 在独立线程中执行插件的 `start/stop`，避免主线程卡顿。

---

## 4. 主进程（`src/main`）

入口 [`src/main/index.ts`](file:///workspace/zyfun/src/main/index.ts) 负责：

1. `setupEnv()`：关闭 TLS 校验、安装全局 warning/uncaughtException/unhandledRejection 处理、`fix-path` 修复 macOS/Linux 下 GUI 子进程 PATH。
2. `setupApp()`：根据设置决定是否 `disableHardwareAcceleration`、注入 Chromium 启/停特性开关（`enable-features` / `disable-features`）。
3. `main()` 顺序：`fileStorage.initRequireDir()` → `dbService.init()` → `proxyManager.configureProxy()` → `fastifyService.start()` → `appLocale.init()` → `setupReady()`。
4. `setupReady()` 在 `app.whenReady()` 内创建主窗口、注册托盘/菜单、`installExtension(VUEJS_DEVTOOLS)`，并监听 `login`（HTTP Basic 凭据弹窗回填）、`second-instance`、`open-url`（深链协议）等。

### 4.1 服务清单（`src/main/services`）

| 服务                | 文件                                                                                                      | 职责                                                                                  |
| ------------------- | --------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------- |
| `AppService`        | [AppService.ts](file:///workspace/zyfun/src/main/services/AppService.ts)                                   | 自启动/单实例等应用级开关。                                                            |
| `AppLocale`         | [AppLocale.ts](file:///workspace/zyfun/src/main/services/AppLocale.ts)                                     | 根据系统/用户设置选语言，暴露 `changeLocale`、`isCHS()`。                              |
| `AppUpdater`        | [AppUpdater.ts](file:///workspace/zyfun/src/main/services/AppUpdater.ts)                                   | 封装 `electron-updater`，禁用自动下载/自动安装，把状态推回渲染进程。                   |
| `BinaryService`     | [BinaryService.ts](file:///workspace/zyfun/src/main/services/BinaryService.ts)                             | 下载/校验 `uv/bun/ffmpeg/ffprobe` 二进制到 `~/.zy/bin/`。                              |
| `ConfigManager`     | [ConfigManager.ts](file:///workspace/zyfun/src/main/services/ConfigManager.ts)                             | `electron-store` 包装，提供强类型 getter（`theme/lang/dns/ua/zoom/proxy/debug`）。    |
| `ContextMenu`       | [ContextMenu.ts](file:///workspace/zyfun/src/main/services/ContextMenu.ts)                               | 右键菜单（Webview/输入框）。                                                          |
| `DbService`         | [DbService/index.ts](file:///workspace/zyfun/src/main/services/DbService/index.ts)                         | libSQL + Drizzle ORM，提供表 CRUD/迁移/订阅/云备份。详见 §7。                          |
| `FastifyService`    | [FastifyService/index.ts](file:///workspace/zyfun/src/main/services/FastifyService/index.ts)               | 嵌入式 HTTP 服务。详见 §6。                                                            |
| `FFmpegService`     | [FFmpegService.ts](file:///workspace/zyfun/src/main/services/FFmpegService.ts)                             | 包装 `fluent-ffmpeg`，提供 `getBaseInfo` / `getScreenshot` / `getMediaInfo`。          |
| `FileStorage`       | [FileStorage.ts](file:///workspace/zyfun/src/main/services/FileStorage.ts)                                 | 文件选择/读写/路径初始化。                                                              |
| `LoggerService`     | [LoggerService.ts](file:///workspace/zyfun/src/main/services/LoggerService.ts)                             | Winston + daily-rotate-file，提供 `withContext` 创建子 logger。                         |
| `MenuService`       | [MenuService.ts](file:///workspace/zyfun/src/main/services/MenuService.ts)                                 | 应用菜单的构建/更新（根据语言）。                                                      |
| `NotificationService` | [NotificationService.ts](file:///workspace/zyfun/src/main/services/NotificationService.ts)                 | 系统通知。                                                                              |
| `PluginService`     | [PluginService.ts](file:///workspace/zyfun/src/main/services/PluginService.ts)                             | 插件安装/卸载/启停（`npminstall` + `workerpool`）。                                    |
| `ProxyManager`      | [ProxyManager/index.ts](file:///workspace/zyfun/src/main/services/ProxyManager/index.ts)                   | 系统代理/自定义代理切换，监听系统代理变化。                                            |
| `PythonService`     | [PythonService.ts](file:///workspace/zyfun/src/main/services/PythonService.ts)                             | T3_PY 适配器所依赖的 Python 进程管理（`uv` 驱动）。                                    |
| `SearchService`     | [SearchService.ts](file:///workspace/zyfun/src/main/services/SearchService.ts)                             | 多窗口嗅探/搜索。                                                                      |
| `ShortcutService`   | [ShortcutService.ts](file:///workspace/zyfun/src/main/services/ShortcutService.ts)                         | 全局/局部快捷键（含"老板键"）。                                                       |
| `StorageService`    | [StorageService/index.ts](file:///workspace/zyfun/src/main/services/StorageService/index.ts)               | WebDAV/iCloud 备份与恢复。                                                              |
| `ThemeService`      | [ThemeService.ts](file:///workspace/zyfun/src/main/services/ThemeService.ts)                               | 主题同步（亮/暗/跟随系统）。                                                            |
| `TrayService`       | [TrayService.ts](file:///workspace/zyfun/src/main/services/TrayService.ts)                                 | 系统托盘菜单/图标。                                                                    |
| `WebviewService`    | [WebviewService.ts](file:///workspace/zyfun/src/main/services/WebviewService.ts)                             | Webview UA 注入与会话。                                                                |
| `WindowService`     | [WindowService.ts](file:///workspace/zyfun/src/main/services/WindowService.ts)                             | 主/播放/搜索/浏览等 BrowserWindow 池化管理。                                          |
| `ProtocolClient`    | [ProtocolClient/index.ts](file:///workspace/zyfun/src/main/services/ProtocolClient/index.ts)               | 自定义协议 `zy://` 处理（深链唤起）。                                                  |
| `CdpElectron`       | [CdpElectron.ts](file:///workspace/zyfun/src/main/services/CdpElectron.ts)                                 | 通过 CDP（puppeteer-in-electron）做嗅探/调试。                                         |

### 4.2 IPC 注册（`src/main/ipc.ts`）

[`registerIpc()`](file:///workspace/zyfun/src/main/ipc.ts#L46-L779) 集中注册所有 `ipcMain.handle(IPC_CHANNEL.XXX, ...)`。通道名统一定义在 [`@shared/config/ipcChannel.ts`](file:///workspace/zyfun/src/shared/config/ipcChannel.ts)，便于渲染进程通过 `window.electron.ipcRenderer` 调用。主要分类：

- **应用/系统**：`APP_QUIT/REBOOT/PROXY/DNS/AUTO_LAUNCH`、`CHANGE_LANG/ZOOM`、`BINARY_INSTALL`。
- **窗口**：`WIN_OPEN/CLOSE/SHOW/MIN/MAX`、`WIN_DEVTOOLS`。
- **文件**：`FILE_SELECT_*_DIALOG`、`FILE_READ/WRITE/DELETE`。
- **业务**：`CALL_PLAYER`（唤起外部播放器）、`SHORTCUT_*`、`THEME_*`。
- **认证**：`LOGIN_BASIC`（HTTP Basic 凭据弹窗桥接）。

### 4.3 工具与中间件（`src/main/utils`）

- `hiker/`：JS 爬虫/规则解析（`baseSpider`、`ruleParse`、`inject`、`proxy`），用于 T3_DRPY 等适配器内嵌的 JS 脚本环境。
- `request/index.ts`：基于 `undici` 的 HTTP 客户端，支持 `getSystemProxy`。
- `file.ts`、`path.ts`、`process.ts`、`shell.ts`、`systeminfo.ts`、`ip.ts`、`argv.ts`、`tool.ts`：通用工具集合，路径统一通过 `getSystemPath/getUserPath` 走 `application` 单例。
- `electron.d.ts` / `env.d.ts`：扩展 Electron 类型与全局变量。

---

## 5. 预加载（`src/preload`）

[`src/preload/index.ts`](file:///workspace/zyfun/src/preload/index.ts) 仅做三件事：

1. `domReady()` + `useLoading()` 控制首屏 Loading。
2. 通过 `contextBridge` 暴露 `electron`（`@electron-toolkit/preload`）与 `api`（当前为空，预留）。
3. `process.contextIsolated` 兜底：未启用隔离时把 API 挂到 `window` 上。

> 渲染进程真正的 API 调用大多走 `fetch(127.0.0.1:9978/api/v1/...)` 打到主进程 Fastify，或通过 `window.electron` 走 IPC 通道。

---

## 6. Fastify API 服务（`src/main/services/FastifyService`）

### 6.1 服务基类

[`FastifyService`](file:///workspace/zyfun/src/main/services/FastifyService/index.ts) 是一个单例：

- `start()`：注册 `@fastify/cors` / `multipart` / `swagger`（仅 `isDev || configManager.debug`），挂载 `CacheService`。
- `registerRoutes()`：通过 `import.meta.glob('./v*/*/index.ts', { eager: true })` 自动发现 `v0`/`v1` 下的路由模块，v1 统一加 `api/v1` 前缀，v0 不加。
- `createLogStream()`：把 Pino 日志按级别桥接到主进程 `loggerService`。
- 统一错误处理返回 `{ code, msg, data }`，超时 60s。

### 6.2 路由模块

```text
routes/
├── v0/
│   └── proxy/                 # 通用本地代理（带缓存），被视频流/图片/CMS 嗅探复用
└── v1/
    ├── aigc/                  # AI 聊天/记忆/工具（WebSearch）
    ├── data/                  # 数据导入导出/云备份/数据库快照
    ├── file/                  # 文件管理/TVBox 兼容配置
    ├── film/                  # 影视核心
    │   ├── cms/               # CMS 资源（多适配器）
    │   ├── edit/              # 资源编辑/筛选
    │   ├── rec/               # 推荐/联想/弹幕/热搜
    │   └── site/              # 站点测速
    ├── live/                  # 直播（频道/IPTV/EPG）
    ├── moment/                # 收藏/历史
    ├── parse/                 # 解析源
    ├── plugin/                # 插件安装/启停
    ├── setting/               # 设置读写
    └── system/                # ffmpeg/cdp/process/二进制/嗅探
```

每个模块在 `routes/<v>/<name>/index.ts` 导出 `FastifyPluginAsync`，例如 [`routes/v1/film/index.ts`](file:///workspace/zyfun/src/main/services/FastifyService/routes/v1/film/index.ts) 再聚合 `cms/edit/rec/site`：

- **`film/cms`** 是最复杂的一组：[`cms/index.ts`](file:///workspace/zyfun/src/main/services/FastifyService/routes/v1/film/cms/index.ts) 暴露 `init/home/homeVod/category/detail/search/play/action/proxy/check`，通过 [`cms/utils/cache.ts`](file:///workspace/zyfun/src/main/services/FastifyService/routes/v1/film/cms/utils/cache.ts) 中的 `adapter(uuid)` 工厂方法按站点类型加载对应适配器并缓存实例；[`cms/adapter/`](file:///workspace/zyfun/src/main/services/FastifyService/routes/v1/film/cms/adapter) 内置：

  | 适配器                          | 适用                                                                 |
  | ------------------------------- | -------------------------------------------------------------------- |
  | `T0XmlAdapter` (`t0Xml.ts`)     | T0_XML，标准苹果 CMS XML                                            |
  | `T1JsonAdapter` (`t1Json.ts`)   | T1_JSON                                                              |
  | `T3DrpyAdapter`                 | T3_DRPY（含 `drpy-core-lite.min.js` + 多种 JS 库，离 Worker 执行） |
  | `T3CatopenAdapter`              | T3_DRPY 的"CatOpen"分支，资源在 `resources/t3Catopen`                |
  | `T3XbpqAdapter` / `T3XyqAdapter`| T3_XBPQ / T3_XYQ                                                    |
  | `T3AppYsV2Adapter` / `T3AppGet` | T3_APPYSV2 / T3_APPGET                                              |
  | `T3AlistAdapter`                | T3_ALIST（Alist 网盘）                                              |
  | `T3PyAdapter`                   | T3_PY（通过 `PythonService` 拉起 uv 进程执行 `resources/t3PyBase`）|
  | `T4CatvodAdapter` / `T4Drpys` / `T4DrpyJs0` | TVBox 系                                  |

- **`system/ffmpeg`**：[`ffmpeg.ts`](file:///workspace/zyfun/src/main/services/FastifyService/routes/v1/system/ffmpeg.ts) 提供 `info` 与 `screenshot` 两个端点。
- **`system/cdp`**：基于 `puppeteer-in-electron` 在隐藏窗口中嗅探视频 URL。
- **`live`**：包含 [`channel.ts`](file:///workspace/zyfun/src/main/services/FastifyService/routes/v1/live/channel.ts) 频道管理与 [`iptv.ts`](file:///workspace/zyfun/src/main/services/FastifyService/routes/v1/live/iptv.ts) 远程/本地 M3U 解析（[`utils/epg.ts`](file:///workspace/zyfun/src/main/services/FastifyService/routes/v1/live/utils/epg.ts) 提供节目单）。
- **`plugin`**：暴露插件增删改查，由 `PluginService` 在 worker 池中执行。
- **`v0/proxy`**：通用带缓存的本地反向代理（`HEAD` 命中缓存返回 `Content-Type`，`GET` 转发到目标并 base64 存储响应头/内容），CMS 与浏览器嗅探经常复用它。

### 6.3 Schema 校验

每个路由目录都有同名 `schemas/` 子目录，使用 `@sinclair/typebox` 描述请求/响应：

```text
schemas/
├── base.ts                     # 公共 ResponseSuccess/Error/Redirect
├── v0/proxy.ts
└── v1/
    ├── aigc/{chat,memory}.ts
    ├── data/{cloud,db}.ts
    ├── file/{manage,tvbox}.ts
    ├── flim/{cms,edit,rec,site}.ts        # 注：flim 为历史拼写，未修正
    ├── live/{channel,iptv}.ts
    ├── moment/{history,moment,star}.ts
    ├── parse/{analyze,parse}.ts
    ├── plugin/index.ts
    ├── setting/index.ts
    └── system/{binary,cdp,ffmpeg,other,process}.ts
```

`fastify.d.ts` 在 `TypeBoxTypeProvider` 上补充了 `code/msg/data` 的标准响应。

---

## 7. 数据库（`src/main/services/DbService`）

[`DbService`](file:///workspace/zyfun/src/main/services/DbService/index.ts) 单例封装了 libSQL + Drizzle ORM。

### 7.1 数据表

在 [`schemas/index.ts`](file:///workspace/zyfun/src/main/services/DbService/schemas/index.ts) 中聚合 8 张表（与 README 中给出的数据结构字段对应）：

| 表        | 用途                                                                  |
| --------- | --------------------------------------------------------------------- |
| `analyze` | 解析源（web/json 类型 + 自定义脚本）                                  |
| `iptv`    | 直播源（远程 M3U / 本地 / 文本）+ EPG / logo                         |
| `channel` | 直播频道（来自 IPTV 或手工添加）                                      |
| `site`    | 影视/直播站点（带 `type` 字段路由到 CMS Adapter）                     |
| `star`    | 收藏                                                                  |
| `history` | 播放历史（含 type 区分 film/live/parse）                              |
| `plugin`  | 已安装插件元数据                                                      |
| `setting` | KV 设置（key-value，`value.data` 为具体值），含 `version` 字段记录当前 schema 版本 |

每个 schema 在 `schemas/<table>.ts` 中以 Drizzle `sqliteTable` 描述，并在 `schemas/index.ts` 聚合。

### 7.2 CRUD

[`crud/`](file:///workspace/zyfun/src/main/services/DbService/crud) 为每张表暴露一致的方法：

- `all() / active() / get(id) / getByField() / add() / update(ids, doc) / remove() / removeByField() / set(docs) / clear() / page(page, pageSize, kw, ...)`。

[`DbService`](file:///workspace/zyfun/src/main/services/DbService/index.ts) 通过 getter 暴露 `{ analyze, channel, history, iptv, plugin, setting, site, star }`，并提供顶层 `db.all/init/clear` 三个聚合方法，用于云备份/恢复。

### 7.3 迁移

[`migrations/`](file:///workspace/zyfun/src/main/services/DbService/migrations) 目录按版本号存放迁移脚本（`migrate-3_3_1.ts` ~ `migrate-3_4_7.ts`）。`initMigrate` 为首次建表，`updateMigrate` 为补丁式变更；`migrate()` 通过 `semver.gt(m.version, dbVersion)` 过滤并顺序执行，执行成功后回写 `setting.version`。

### 7.4 订阅与文件监听

- `subscribe(key, cb) / unsubscribe / notifySubscribers`：简易发布订阅，常用于 `setting` 变更时通知主进程/渲染进程。
- `startWatcher()`：用 `chokidar` 监听 `data.db` 文件变化；
  - 若开启了"云同步"则把当前全量数据 `cloudBackup` 到 WebDAV / iCloud。
  - 否则把 `setting` 表同步到 `configManager`（即 `userData/config.json`），避免双源配置漂移。

### 7.5 云备份

`dbService.cloudBackup / cloudResume` 分别调用 [`WebdavStorage`](file:///workspace/zyfun/src/main/services/StorageService/WebdavStorage.ts) 或 [`ICloudStorage`](file:///workspace/zyfun/src/main/services/StorageService/ICloudStorage.ts) 把全表 JSON 写入 `config.json`。

---

## 8. 渲染进程（`src/renderer`）

技术栈：Vue 3 + TypeScript + Vue Router（hash 模式）+ Pinia（含 `pinia-plugin-persistedstate`、`pinia-shared-state`）+ TDesign + Less + Monaco Editor + xterm。

### 8.1 入口与生命周期

[`src/renderer/src/main.ts`](file:///workspace/zyfun/src/renderer/src/main.ts) 完成：

- `initDom()`：注入主题色、字体等 DOM 副作用。
- `consolePrint()`：控制台欢迎语。
- 注册 Pinia、Router、vue-i18n，挂载 `#app`，加载完成后调用 `window.removeLoading()` 隐藏 Loading。

### 8.2 路由

[`router/index.ts`](file:///workspace/zyfun/src/renderer/src/router/index.ts) 使用 `import.meta.glob('./modules/**/homepage.ts', { eager: true })` 加载 [`router/modules/homepage.ts`](file:///workspace/zyfun/src/renderer/src/router/modules/homepage.ts)，主要路由：

| 路径        | 组件                                       | 备注                         |
| ----------- | ------------------------------------------ | ---------------------------- |
| `/film`     | [pages/film](file:///workspace/zyfun/src/renderer/src/pages/film/index.vue) | 影视主入口                   |
| `/live`     | [pages/live](file:///workspace/zyfun/src/renderer/src/pages/live/index.vue) | 直播                         |
| `/parse`    | [pages/parse](file:///workspace/zyfun/src/renderer/src/pages/parse/index.vue) | 解析                         |
| `/moment`   | [pages/moment](file:///workspace/zyfun/src/renderer/src/pages/moment/index.vue) | 收藏 + 历史                |
| `/lab`      | [pages/lab](file:///workspace/zyfun/src/renderer/src/pages/lab/index.vue)   | 实验室（插件/加密/编辑器/播放器/嗅探） |
| `/setting`  | [pages/setting](file:///workspace/zyfun/src/renderer/src/pages/setting/index.vue) | 设置         |
| `/test`     | [pages/test](file:///workspace/zyfun/src/renderer/src/pages/test/index.vue) | 测试页（仅开发可见）         |
| `/player`   | [pages/player](file:///workspace/zyfun/src/renderer/src/pages/player/index.vue) | 独立播放窗口                |
| `/browser`  | [pages/browser](file:///workspace/zyfun/src/renderer/src/pages/browser/index.vue) | 内嵌浏览器                 |

### 8.3 布局

`src/renderer/src/layouts/index.vue` 使用 TDesign 的 `t-layout/aside/header/content`：

- `LayoutSideNav.vue`：左侧导航（图标 + i18n 标题）。
- `LayoutHeader.vue`：顶栏（系统控制、搜索、快捷菜单等）。
- `LayoutContent.vue`：内容区，包裹 `<router-view />`。

### 8.4 状态管理

[`store/index.ts`](file:///workspace/zyfun/src/renderer/src/store/index.ts) 注册 Pinia，自动持久化与跨窗口共享（`PiniaSharedState({ type: 'native' })`）。三个核心 store：

- [`store/modules/browser.ts`](file:///workspace/zyfun/src/renderer/src/store/modules/browser.ts)
- [`store/modules/player.ts`](file:///workspace/zyfun/src/renderer/src/store/modules/player.ts)
- [`store/modules/setting.ts`](file:///workspace/zyfun/src/renderer/src/store/modules/setting.ts)

### 8.5 通用组件（`src/renderer/src/components`）

按职责归类：

- **播放器**：[`multi-player`](file:///workspace/zyfun/src/renderer/src/components/multi-player) 是一个多播放核心，内置 `xgplayer` 与 `artplayer` 两种实现（[`src/core/xgplayer`](file:///workspace/zyfun/src/renderer/src/components/multi-player/src/core/xgplayer/index.ts)、[`src/core/artplayer`](file:///workspace/zyfun/src/renderer/src/components/multi-player/src/core/artplayer/index.ts)），并支持自定义 `webtorrent` 边下边播。`pages/player` 作为播放页的容器。
- **浏览器**：[`webview/`](file:///workspace/zyfun/src/renderer/src/components/webview/index.vue) 封装 Electron `<webview>` 标签，含 `Auth.vue` 组件处理 HTTP Basic。
- **代码编辑器**：[`code-editor/`](file:///workspace/zyfun/src/renderer/src/components/code-editor/src/code-editor.tsx) 基于 Monaco + `monaco-yaml`，被 `lab/edit` 用作规则/模板编辑。
- **终端**：[`terminal/`](file:///workspace/zyfun/src/renderer/src/components/terminal/index.vue) 集成 `xterm`。
- **通用**：`quick-menu`、`system-control`、`search-panel`、`setting-table`、`tag-nav`、`render-markdown`、`render-icon`、`common-nav`、`title-menu`、`share`、`lazy-bg`、`input-req`、`input-shortcut`、`group-btn`、`dialog-document`、`aigc`、`action`、`play-show`、`router-control`。

### 8.6 实验室（`pages/lab`）

聚合了多个实验性能力：

- `crypto/`：调用 `@zy/crypto` 进行 base/编码/加密/哈希实验，CPU 密集型任务放在 Web Worker。
- `extension/`：插件中心（环境、插件列表、安装/卸载）。
- `edit/`：Monaco + 注入的 `lab/edit/utils/inject` 提供 JS 智能补全与类型。
- `player/`：播放器调试台。
- `sniffer/`：调用主进程 `system/cdp` 接口嗅探视频源。
- `diff/`：差异对比（可结合代码编辑）。
- `sift/`：影视筛选规则。

### 8.7 设置（`pages/setting`）

- `base/`：基础设置（主题、语言、UA、代理、老板键、嗅探、DNS、弹幕、更新等 Dialog）。
- `data/`：数据导入导出、云备份。
- `film/live/parse/`：业务数据管理（站点、直播源、解析源），各自由 `DialogForm.vue` 提供表单。

### 8.8 API 客户端（`src/renderer/src/api`）

按域分文件：`aigc.ts / data.ts / film.ts / live.ts / moment.ts / parse.ts / plugin.ts / proxy.ts / setting.ts / system.ts`，统一封装对 `http://127.0.0.1:9978/api/v1/*` 的请求。

### 8.9 HTTP 工具

- [`utils/request/api.ts`](file:///workspace/zyfun/src/renderer/src/utils/request/api.ts)：基于 [`@shared/modules/request`](file:///workspace/zyfun/src/shared/modules/request/index.ts) 创建的 Axios 实例，统一前缀 `api/v1`，统一处理 `{ code, msg, data }`。
- [`utils/request/sse.ts`](file:///workspace/zyfun/src/renderer/src/utils/request/sse.ts)：SSE 客户端，用于 AIGC 流式响应。
- [`utils/request/ws.ts`](file:///workspace/zyfun/src/renderer/src/utils/request/ws.ts)：WebSocket 客户端，跨窗口通信。
- `utils/console.ts`、`emitter.ts`、`logger.ts`、`ospy.ts`、`setup.ts`、`systeminfo.ts`、`tool.ts`、`vitalsObserver.ts`：通用工具。

### 8.10 国际化

[`src/renderer/src/locales`](file:///workspace/zyfun/src/renderer/src/locales) 注册 `vue-i18n`；文案源在 [`src/shared/locales/lang`](file:///workspace/zyfun/src/shared/locales/lang)，按 `zh-CN / zh-TW / en-US` 三语拆分，pages/component/media/system 分文件。

---

## 9. 共享层（`src/shared`）

供主进程/渲染进程/预加载复用：

### 9.1 配置（`shared/config`）

| 文件                              | 作用                                                                          |
| --------------------------------- | ----------------------------------------------------------------------------- |
| `appinfo.ts`                      | `APP_NAME / APP_NAME_PROTOCOL / APP_VERSION / titleBarOverlay*` 等常量       |
| `cmsAction.ts`                    | CMS Adapter 的标准动作名                                                      |
| `constant.ts` / `data.ts`         | 业务枚举与默认数据                                                            |
| `dns.ts`                          | 默认 DoH 服务器列表                                                           |
| `env.ts`                          | `PORT / ORIGIN / PREFIX / PROXY_API` 等运行时常量                             |
| `film.ts` / `live.ts` / `parse.ts`| 各业务模块共享的类型与默认值                                                  |
| `ipcChannel.ts`                   | 所有 IPC 通道名                                                              |
| `logger.ts`                       | `LOG_MODULE` 枚举、级别、颜色码                                                |
| `notification.ts`                 | 通知模板                                                                      |
| `req.ts`                          | 全局请求默认头/UA                                                             |
| `setting.ts` / `tblSetting.ts`    | `ISetting` / `IStoreKey` 等强类型                                            |
| `shortcut.ts`                     | 快捷键配置类型与默认值                                                        |
| `theme.ts` / `userAgent.ts`       | 主题/UA 预设                                                                  |
| `window.ts`                       | 窗口名称 + 默认尺寸                                                          |
| `xmlOptions.ts`                   | fast-xml-parser 配置                                                          |

### 9.2 类型（`shared/types`）

`auth.ts / barrage.ts / cms.ts / common.ts / db.ts / sift.ts / systeminfo.ts` 等。`cms.ts` 定义了适配器对外暴露的 `ICmsHome/Category/Detail/...` 接口；`db.ts` 定义了与 Drizzle 映射的 `IModels` 等。

### 9.3 通用模块（`shared/modules`）

- `cache.ts` / `lrucache.ts`：内存级 LRU 缓存，被 Fastify 通过 `fastify.decorate('cache', CacheService)` 共享。
- `function.ts`：`runFunction`（异步不阻塞）、`runRetryAsyncFunction`（带重试）。
- `headers.ts`：HTTP 头清洗/转换，`UNSAFE_HEADERS`、URL 安全相关。
- `ip.ts` / `date.ts` / `camelcase.ts` / `obj.ts` / `toString.ts` / `size.ts` / `singleton.ts` / `schedule.ts` / `validate.ts`：小工具集。
- `request/`：跨进程可复用的"请求工具包"，提供 Axios / SSE / WebSocket 抽象，详见 §8.9。
- `zip/`：基于 `node-7z` / `tar` 的 7z/gz/zip/tgz 打包与解包。

---

## 10. Monorepo 子包

### 10.1 `@zy/crypto`（[`packages/crypto`](file:///workspace/zyfun/packages/crypto)）

纯函数加密工具库，可同时被主进程、渲染进程、Lab/插件、`.env` 解析等场景使用。结构：

```text
src/
├── core/
│   ├── base.ts           # base64/base32/hex/URL/...
│   ├── encode.ts         # unicode / utf8 / html / url / punycode
│   ├── encrypt/          # aes、rsa、sm（国密）、crypto（聚合导出）
│   └── mac.ts            # HMAC / CMAC
├── modules/atob-btoa.ts  # 浏览器端安全 atob/btoa
├── utils/                # forge、wordArray、base 辅助
├── index.ts
└── type.ts
```

打包配置使用 `tsdown`，输出 CJS/ESM 供工作区其他包直接 import。`example/` 目录下提供了一份独立的 Vite + shadcn/ui 调试页面。

### 10.2 `@zy/vlc`（[`packages/vlc`](file:///workspace/zyfun/packages/vlc)）

把 VLC 原生库集成到 Electron 的桥接包：

- `native/`：Rust（N-API + koffi）实现，编译为 `zyfun-vlc.node`，与 [`packages/vlc/src/renderer/vlc-player.ts`](file:///workspace/zyfun/packages/vlc/src/renderer/vlc-player.ts) 协作。
- `src/`：TypeScript 部分，包含 `control/`（API/IPC/原生加载器）、`renderer/`（UI 控件 + 插件 + Mixin）、`types.ts`、`index.ts`。
- `example/`：最小化 Electron 集成示例。

> 由于 `pnpm-workspace.yaml` 中 `packages/vlc` 被排除出 workspace，故不在主项目里编译；构建产物通过 `asarUnpack: node_modules/@zy/vlc/**` 在打包时携带。

---

## 11. 关键类与函数

### 11.1 `DbService`（核心数据访问）

- 位置：[`DbService/index.ts`](file:///workspace/zyfun/src/main/services/DbService/index.ts)
- 单例：`getInstance() / reload()`。
- 关键方法：
  - `init()` → `conn() → migrate() → dbSyncStore() → startWatcher()`。
  - `db.all([tables]) / db.init(doc) / db.clear([tables])`：用于云备份与恢复。
  - 各表 getter：返回 `{ all, get, getByField, add, update, remove, removeByField, set, clear, page, ... }`；`setting` 还提供 `getValue` 与 `subscribe/notify` 通路。

### 11.2 `FastifyService`（HTTP 容器）

- 位置：[`FastifyService/index.ts`](file:///workspace/zyfun/src/main/services/FastifyService/index.ts)
- 单例；`start/stop/restart/status` 四元组控制生命周期。
- 路由注册：`registerRoutes()` 通过 `import.meta.glob` 自动发现。

### 11.3 `WindowService`（窗口池）

- 位置：[`WindowService.ts`](file:///workspace/zyfun/src/main/services/WindowService.ts)
- `winPool: Map<name, { window, lastCrashTime }>` 维护所有窗口；提供 `getWindow/getAllWindows/createMainWindow/createSearchWindow/showWindow/closeWindow/...`，并保存窗口位置/大小（结合 `electron-window-state`）。

### 11.4 `ProxyManager`

- 位置：[`ProxyManager/index.ts`](file:///workspace/zyfun/src/main/services/ProxyManager/index.ts)
- 负责系统代理与自定义代理切换，内部委托 [`NodeProxyController`](file:///workspace/zyfun/src/main/services/ProxyManager/nodeProxy.ts) 与 [`bootstrap.ts`](file:///workspace/zyfun/src/main/services/ProxyManager/bootstrap.ts) 处理 Node 进程内代理转发；当 `mode === 'system'` 时启动 1 分钟轮询，自动同步系统代理变更。

### 11.5 `PluginService`

- 位置：[`PluginService.ts`](file:///workspace/zyfun/src/main/services/PluginService.ts)
- 解析插件包（`package.json` + `main/web`），通过 `npminstall` 安装依赖；在 `workerpool` 中 `start/stop` 插件，并把 worker 内 `console.log/info/warn/error/debug` 统一通过 `workerEmit` 回传。

### 11.6 `PythonService`

- 位置：[`PythonService.ts`](file:///workspace/zyfun/src/main/services/PythonService.ts)
- 借助 `uv` 二进制管理 T3_PY 适配器对应的 Python 进程：检测 `pyproject.toml`/`requirements.txt`，用 `uv pip install` 同步依赖，并提供 `matchProcess/matchPort/killProcess` 的进程管理。

### 11.7 `FFmpegService`

- 位置：[`FFmpegService.ts`](file:///workspace/zyfun/src/main/services/FFmpegService.ts)
- 包装 `fluent-ffmpeg`，提供 `getBaseInfo / getMediaInfo / getScreenshot`，可注入 `timeout` 与 `userAgent`。

### 11.8 `ConfigManager`

- 位置：[`ConfigManager.ts`](file:///workspace/zyfun/src/main/services/ConfigManager.ts)
- 基于 `electron-store`，位于 `userData/config.json`；提供 `theme/lang/zoom/dns/hardwareAcceleration/timeout/ua/debug/proxy` 强类型 getter。设置改动通常由 `dbService.dbSyncStore` 同步。

### 11.9 CMS Adapter 基类（JS 端）

- 位置：[`utils/hiker/baseSpider.ts`](file:///workspace/zyfun/src/main/utils/hiker/baseSpider.ts)
- 提供 `home/category/detail/search/play/homeVod/proxy` 占位方法与 `fetch(url, options)` 工具。DRPY/XBPQ 等适配器继承此类。

### 11.10 `cms/utils/cache.ts::adapter()`

- 位置：[`cms/utils/cache.ts`](file:///workspace/zyfun/src/main/services/FastifyService/routes/v1/film/cms/utils/cache.ts)
- 根据 `dbService.site.get(uuid).type` 字段，懒加载并缓存对应 Adapter 实例；T3_DRPY/T3_CatOpen 适配器还会在 `setup()` 中拉起 `worker.ts` 子进程。

---

## 12. 依赖关系

### 12.1 进程内模块依赖

```text
渲染进程 (Vue 3)
  ├── 直接 IPC → preload (contextBridge)
  ├── fetch(127.0.0.1:9978) → FastifyService
  └── store.modules.*  ↔ dbService.setting  （通过 Fastify + WebContents 事件）

主进程
  ├── FastifyService
  │    ├── DbService  (CRUD)
  │    ├── FFmpegService / BinaryService / PythonService
  │    ├── PluginService (workerpool)
  │    └── StorageService (WebDAV / iCloud)
  ├── WindowService / TrayService / MenuService / ShortcutService / ThemeService
  ├── ProxyManager (os-proxy-config + 自建 NodeProxy)
  └── AppUpdater (electron-updater)
```

### 12.2 关键三方依赖（节选自 `package.json`）

| 类别    | 包                                                                             | 用途                                       |
| ------- | ------------------------------------------------------------------------------ | ------------------------------------------ |
| 框架    | `electron` `electron-vite` `electron-builder`                                  | 应用骨架/构建/打包                         |
| UI      | `vue` `vue-router` `pinia` `pinia-plugin-persistedstate` `pinia-shared-state`  | 渲染层核心                                 |
| 组件库  | `tdesign-vue-next` `tdesign-icons-vue-next` `@tdesign-vue-next/chat`           | UI 库（含 Chat 组件供 AIGC 复用）          |
| 编辑器  | `monaco-editor` `monaco-yaml` `@xterm/xterm` 及多个 addons                    | 规则编辑 / 终端                            |
| 播放器  | `xgplayer` `xgplayer-hls` / `-flv` / `-mp4` / `-music` / `-shaka`             | 西瓜播放器多协议                           |
|         | `artplayer` `artplayer-plugin-danmuku` `flv.js` `hls.js` `dashjs` `mpegts.js`  | 艺术播放器 + 备选解码器                    |
| 网络    | `axios` `undici` `ws` `isomorphic-ws` `@microsoft/fetch-event-source`           | HTTP / WebSocket / SSE                     |
| 数据库  | `@libsql/client` `drizzle-orm`                                                 | 本地 libSQL                                |
| AI      | `ai` `@ai-sdk/anthropic` `@ai-sdk/google` `@ai-sdk/openai-compatible` `ollama-ai-provider-v2` | AIGC 路由与多模型         |
| 代理    | `os-proxy-config` `proxy-agent` `fetch-socks` `qs`                            | 代理与查询串                                |
| 工具    | `fastify` `@fastify/cors` `@fastify/multipart` `@fastify/swagger` `@fastify/swagger-ui` `@fastify/type-provider-typebox` `@sinclair/typebox` | 内部 HTTP 服务 + API 契约   |
|         | `winston` `winston-daily-rotate-file` `@logdna/tail-file`                       | 日志                                       |
|         | `puppeteer-core` `puppeteer-in-electron` `jsdom`                               | 嗅探 / 测试                                |
|         | `chokidar` `fdir` `file-stream-rotator`                                        | 文件监听/搜索                              |
| 打包/包 | `npminstall` `workerpool` `tar` `node-7z` `node-stream-zip` `adm-zip` `7zip-bin-full` | 插件/压缩                |
|         | `electron-updater` `electron-store` `electron-window-state` `electron-localshortcut` | 更新/配置/窗口/快捷键         |
|         | `cheerio` `fast-xml-parser` `jsonpath-plus` `iconv-lite`                       | 解析/编码                                  |
|         | `dayjs` `fuse.js` `splitpanes` `v3-infinite-loading` `tldts` `magnet-uri`      | 时间/搜索/UI/无限滚动/域名                 |
| 工具链  | `eslint` `prettier` `stylelint` `vitest` `vue-tsc` `@typescript/native-preview`(tsgo) | 代码质量 + 测试 + 类型       |
| 内部    | `@zy/crypto` `workspace:*`                                                     | 加密/编码工具                              |
|         | `@electron-toolkit/utils` `@electron-toolkit/preload` `@electron-toolkit/tsconfig` | 官方脚手架                          |

### 12.3 关键 patched 依赖

`patches/` 中维护以下依赖的本地补丁（升级前需先看 `AGENTS.md` 与 `pnpm-workspace.yaml`）：

- `artplayer@5.4.0`、`dplayer@1.32.7`、`@oplayer-*`、`@libsql/client@0.15.15` / `libsql@0.4.7` / `@libsql__client@0.15.15`
- `@tdesign-vue-next/chat@0.5.2`、`shaka-player@4.13.0`
- `atomically@1.7.0`、`electron-devtools-installer@4.0.0`、`electron-updater@6.7.0`、`file-stream-rotator@0.6.1`

---

## 13. 构建与运行

### 13.1 环境要求

- Node.js ≥ 24.11.1（见 `.node-version` / `engines.node`）
- pnpm 10.27.0（`packageManager` 字段，通过 `corepack enable` 即可）
- Rust 工具链（`@zy/vlc` 需要）

### 13.2 常用脚本（节选自 `package.json`）

| 用途         | 命令                            | 说明                                                       |
| ------------ | ------------------------------- | ---------------------------------------------------------- |
| 安装依赖     | `pnpm install`                  | 含 `electron-builder install-app-deps`                     |
| 开发         | `pnpm dev`                      | `dotenv electron-vite dev`                                 |
| 调试         | `pnpm debug`                    | 启动 CDP 远程调试，配合 `chrome://inspect`                 |
| 类型检查     | `pnpm typecheck`                | node/web/packages 三段分别调用 `tsgo` / `vue-tsc`          |
| Lint         | `pnpm lint` / `pnpm lint:fix`   | ESLint 校验                                                |
| 样式检查     | `pnpm stylelint`                | Stylelint                                                  |
| 测试         | `pnpm test`                     | Vitest，含 `:main / :renderer / :shared` 子集              |
| 打包         | `pnpm build:win / build:mac / build:linux` | 调用 `electron-builder`，可继续加 `:x64` / `:arm64`        |
| 不打包预览   | `pnpm build:unpack`             | `electron-builder --dir`                                   |
| 子包构建     | `pnpm build:packages`           | 单独构建 `@zy/crypto`                                      |
| 提交前检查   | `pnpm build:check`              | `lint + test`（建议提交前跑一次）                          |

### 13.3 数据/配置目录

| 平台    | 数据库/文件/插件/日志                                | 二进制                |
| ------- | ---------------------------------------------------- | --------------------- |
| macOS   | `~/Library/Application Support/zyfun/`               | `~/.zy/bin/`          |
| Linux   | `~/.config/zyfun/`                                   | `~/.zy/bin/`          |
| Windows | `%USERPROFILE%\AppData\Roaming\zyfun\`               | `%USERPROFILE%\.zy\bin\` |

二进制由 `BinaryService` 按需下载 `uv / bun / ffmpeg / ffprobe`，存放在上述 `~/.zy/bin/`。

### 13.4 协议与深链

`electron-builder.yml` 注册 `zy://` 协议；主进程通过 [`ProtocolClient`](file:///workspace/zyfun/src/main/services/ProtocolClient/index.ts) 解析 `zy://...` URL，配合 `app.on('open-url' | 'second-instance')` 实现从浏览器唤起。

### 13.5 应用目录约定

[`src/main/utils/path.ts`](file:///workspace/zyfun/src/main/utils/path.ts) 统一通过 `getSystemPath / getUserPath` 暴露命名空间下的目录：`log/cache/plugin/db/data/...`，避免代码中散落 `app.getPath()` 与 `os.homedir()`。

---

## 14. 关键流程示例

### 14.1 站点加载 / 播放请求

```text
渲染进程 (Film 页面)
  → 调 window.electron.ipcRenderer 或 fetch 127.0.0.1:9978/api/v1/film/cms/home?uuid=xxx
    → FastifyService 注册的 cms/home 路由
      → adapter(uuid)  # cms/utils/cache.ts
        → 命中缓存则返回
        → 否则按 site.type 选 Adapter (T0Xml / T1Json / T3Drpy / ...)
          → T3Drpy/T3Catopen 还会在 worker.ts 中运行 JS 规则
        → 缓存实例
      → 调用 adapter.home() / detail() / play() / ...
    → 统一格式化结果 (formatCategories / formatEpisode / formatInfoContent)
  → 响应回渲染进程，Pinia + Vue 响应式更新 UI
```

### 14.2 插件启动

```text
PluginService.installPlugin(url)
  → npminstall 安装到 userData/plugins/<name>
  → 读取 package.json + plugin.json → IPluginInfo
  → dbService.plugin.add(meta)
  → PluginService.start(uuid)
    → workerpool 创建 worker → 加载插件 main.js
    → 注入 console.* → workerEmit
    → 启动成功，更新 dbService.plugin.status
```

### 14.3 云备份

```text
DbService.startWatcher (chokidar on data.db)
  → on('change')：
      若 setting.cloud.sync = true → dbService.cloudBackup(type, options)
        → WebdavStorage.putFileContents('config.json', JSON.stringify(db.all()))
      否则 → dbService.dbSyncStore() → configManager.set(key, value)
```

### 14.4 HTTP Basic 凭据回填

```text
WebContents 触发 'login' 事件（authInfo.scheme === 'basic'）
  → 尝试 fastify.cache.get(`login-auth:<scheme>:<host>:<port>:<realm>`)
  → 命中：直接 callback(user, pass) 一次并标记 attempt
  → 未命中：把 callback 暂存到 cache 'login-progress'
            → 给主窗口 webContents.send(LOGIN_BASIC, ...)
            → 渲染端弹窗 → 提交 LOGIN_BASIC_RELAY
            → 拿到 user/pass 后 callback + 写入 cache
```

---

## 15. 已知约定与陷阱（摘自 `AGENTS.md`）

- 严格 TypeScript，类型集中放 `src/renderer/src/types/` 与 `src/shared/`。
- Vue 组件用 `PascalCase.tsx` / 服务与工具用 `camelCase.ts` / 测试用 `*.test.ts` 或 `__tests__/`。
- UI 库使用 TDesign，不要在仓库中混用其他 UI 框架。
- 主进程日志必须用 `loggerService.withContext(LOG_MODULE.XXX)`，不要直接 `console.log`。
- 路径统一通过 `application.getPath('namespace.key')` / `getUserPath/getSystemPath`，禁止 `app.getPath()`、`os.homedir()` 直调。
- IPC：先在 `@shared/config/ipcChannel.ts` 声明通道名，再在主/渲染两端分别实现。
- 升级依赖前，先看 `patches/` 目录，避免覆盖官方 patch。
- 提交前跑 `pnpm build:check`（`lint + test`）。

---

## 16. 文档与扩展阅读

- [`docs/Develop.md`](file:///workspace/zyfun/docs/Develop.md) — 项目搭建、调试、打包流程。
- [`docs/Mcp.md`](file:///workspace/zyfun/docs/Mcp.md) — MCP 相关说明。
- [`docs/HarmonyOS_Electron.md`](file:///workspace/zyfun/docs/HarmonyOS_Electron.md) — OpenHarmony 适配说明。
- [`docs/Loong_Electron.md`](file:///workspace/zyfun/docs/Loong_Electron.md) — LoongArch 适配说明。
- [`docs/Conventional_Commits.md`](file:///workspace/zyfun/docs/Conventional_Commits.md) — 提交信息规范。
- [`README.md`](file:///workspace/zyfun/README.md) — 用户视角的字段表与导入数据结构。
- [`AGENTS.md`](file:///workspace/zyfun/AGENTS.md) — AI 协作指南与开发约束。

---

## 17. 模块索引（按职责分类）

```text
应用骨架          src/main/index.ts, src/preload/index.ts
窗口/托盘/菜单    src/main/services/{WindowService,TrayService,MenuService,ShortcutService,ThemeService}.ts
HTTP 服务         src/main/services/FastifyService/**
数据库/迁移       src/main/services/DbService/**
插件              src/main/services/PluginService.ts, packages/crypto/**
解析适配器        src/main/services/FastifyService/routes/v1/film/cms/adapter/**
直播/IPTV         src/main/services/FastifyService/routes/v1/live/**
AIGC              src/main/services/FastifyService/routes/v1/aigc/**
设置              src/main/services/ConfigManager.ts, src/main/services/FastifyService/routes/v1/setting/**
二进制/Python/FFmpeg  src/main/services/{BinaryService,PythonService,FFmpegService}.ts
代理              src/main/services/ProxyManager/**
存储              src/main/services/StorageService/**
UI/路由/状态      src/renderer/src/{router,store,layouts,pages,components}/**
请求/工具/国际化  src/renderer/src/{api,utils,locales}/**  +  src/shared/**
```

---

> 文档基于仓库 `main` 分支当前快照生成；模块增删后请同步更新本 Wiki。
