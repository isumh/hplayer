# HPlayer v1.0 设计定稿文档

> 文档版本：v1.0-final
> 编写日期：2026-06-18
> 最后更新：2026-06-18（基于 P0–P6 实施完成态）
> 前置参考：[HPlayer.md](file:///workspace/docs/design/HPlayer.md)（v1.0 规划稿）/ [CodeWiki.md](file:///workspace/docs/CodeWiki.md)
> 状态：**V1.0 MVP 已交付**（104/104 task 完成，81 个测试通过，core 包覆盖率 78.43%）

## 0. 文档定位

本文件是 HPlayer v1.0 MVP **实际交付态** 的设计定稿，对照 [HPlayer.md](file:///workspace/docs/design/HPlayer.md)（v1.0 规划稿）记录：

- 已落地的架构、模块、数据模型
- 实施过程中与原规划的**变更点**
- 用户驱动的 18 项细化需求（P4 之后追加）
- 当前遗留的待办与 V1.1 / V2 路线图

如需查阅原始设计意图，请阅读 [HPlayer.md](file:///workspace/docs/design/HPlayer.md)。

---

## 1. 变更记录

| 版本 | 日期 | 变更 |
| --- | --- | --- |
| v1.0 | 2026-06-13 | 初稿（规划态） |
| v1.0-final | 2026-06-18 | 实施定稿：P0–P6 全部 104 task 完成；81 测试通过；core 包覆盖率 78.43% |

---

## 2. 项目概述

### 2.1 定位

HPlayer 是一款**移动端优先**的极简影视资源浏览器，专注于"浏览 → 搜索 → 播放"三步体验。

- 形态：V1 = Web Mobile（PWA / H5）→ V2 = Capacitor Android。
- 借鉴 zyfun 的**多视频源聚合**思路，取其精华（CMS 适配器 + 播放 + 收藏）。
- **不包含**直播、解析源、插件、实验室、AI、云同步、代理、桌面特性、多窗口、i18n 等 zyfun 的扩展能力。

### 2.2 目标用户

- 拥有自定义视频源（Apple CMS JSON/XML）且希望**移动端**浏览的人群。
- 重视隐私与本地化（数据全部存本地，不上云）。
- 偏好极简 UI，不需要"全能管家"。

### 2.3 核心价值主张

1. **快**：Web 端 Vite HMR，UI 调整即时生效。
2. **轻**：V1 离线首屏 < 300KB，V2 APK < 20MB（规划）。
3. **稳**：多源聚合、单点故障不影响整体浏览。
4. **私**：无登录、无统计、无追踪、无云端。

### 2.4 核心指标（V1.0 实际）

| 指标 | 实际值 |
| --- | --- |
| 总 task 数 | 104 |
| 已完成 | 104 / 104 |
| 单元 / 集成测试 | 81 通过 |
| core 包覆盖率 | 78.43% |
| 提交次数 | 8（`24a71f2` → `9b2aeec`） |
| dev server | `http://localhost:5173/` |

---

## 3. 技术选型（实际版本）

| 类别 | 选型 | 版本 | 落地备注 |
| --- | --- | --- | --- |
| 框架 | Vue 3 | ^3.5 | 组合式 API + `<script setup>` |
| 构建 | Vite | ^7.0 | HMR < 100ms |
| UI 组件 | Vant | ^4.9 | TS 一等公民，60+ 组件 |
| 工具样式 | Tailwind CSS | ^4.0 | 与 Vant 互补 |
| 状态 | Pinia | ^2.3.1 | setup store 风格 |
| 路由 | vue-router | ^4.4 | hash 模式（V1） |
| 语言 | TypeScript | ^5.6 | `exactOptionalPropertyTypes: true` 严格模式 |
| HTTP | Axios | ^1.7 | 拦截器 + UAPool 随机 UA |
| 视频 | hls.js | ^1.5 | HLS 标准方案 |
| 视频 | artplayer | ^5.1 | 移动端手势 + UI 自定义 |
| UA 随机化 | user-agents | ^2.1.89 | intoli 维护，每日更新 |
| 桌面端 touch | @vant/touch-emulator | latest | 桌面浏览器 SwipeCell 适配 |
| 代码质量 | Biome | ^2.4.5 | lint + format 合并 |
| 测试 | Vitest | ^2.1 | 与 Vite 同源 |
| 包管理 | pnpm | ^10.x | Monorepo workspace |

### 3.1 与原规划的关键差异

| 项 | 原规划 | 实际 |
| --- | --- | --- |
| Pinia 持久化 | `pinia-plugin-persistedstate` | **手写 store + `storage` 工具**（V1 不需要跨窗口同步） |
| `player` 包 | 独立 `packages/player` | **合并到 `views/player/index.vue`**（单页播放器，组件化收益小） |
| `utils` 包 | 独立 `packages/utils` | **合并到 `packages/core/src/utils/`**（减少跨包依赖） |
| `theme/` 目录 | `light.css` / `dark.css` 分文件 | **用 Vant CSS 变量 + ConfigProvider** |
| `SourcePicker.vue` 通用组件 | 列出 | **未实现**（首页直接展示当前源名） |

### 3.2 延后项（V1 不做）

- Vue I18n
- Pinia-shared-state（跨窗口同步）
- WebDAV / iCloud / 云同步
- HTTP 代理
- 直播 / IPTV / EPG
- 解析源模块（T0/T1 直接返回播放 URL）
- AIGC / 插件 / 加密 / Lab
- VLC 原生桥接
- Vue I18n
- T0_XML 适配器（仅占位，未完整实现）

---

## 4. 信息架构（IA）

### 4.1 顶层导航

```text
┌─────────────────────────────────────────────────────────────┐
│ Tab 1: 首页         Tab 2: 搜索         Tab 3: 设置         │
│   /home              /search            /settings           │
└─────────────────────────────────────────────────────────────┘
```

底部 [Tabbar](https://vant-ui.github.io/vant/v4/#/zh-CN/tabbar) 三入口（Vant Tabbar 封装在 `ui/components/TabBar.vue`）。

### 4.2 页面树

```text
/                              # 重定向到 /home（无源则跳 /settings/source/add）
├── /home                      # 首页（顶栏 / 分类 / 视频列表）
├── /search                    # 搜索页
├── /settings                  # 设置首页
│   ├── /settings/source/add   # 新增视频源
│   └── /settings/source/edit/:id  # 编辑视频源（含删除）
├── /detail/:id?sourceId=xxx   # 视频详情
├── /favorite                  # 收藏（SwipeCell）
├── /history                   # 历史（SwipeCell，续播减 10s）
└── /player/:id?sourceId=xxx&episode=xxx  # 全屏播放
```

### 4.3 状态机

```text
App Start
  → activeSourceId = localStorage['hplayer:activeSourceId']
  → 若 id 存在且对应源 enabled → 设为当前源
  → 否则按 enabled + order 最小回退
  → 加载该源的分类与列表（默认选中第一个分类）
  → 渲染 /home
```

---

## 5. 关键页面流程

### 5.1 首次启动（无视频源）

```text
App 启动
  → 检查 localStorage.sources
    → 空 → router.replace('/settings/source/add')
    → 非空 → /home（按 activeSourceId 选源）
```

### 5.2 首页浏览

```text
/home
  → sourceStore.activeSource
  → 加载分类（adapter.getCategories）
  → 默认选中第一个分类 → 触发 showCatSkeleton
  → 加载该分类第 1 页（adapter.getList）
  → 触发 showGridSkeleton → items.length === 0 时显示
  → 数据到达后 items.value = [...] → 隐藏骨架
  → 分类切换：items.value = [] 触发骨架
  → 上滑触底：page++，Toast loading 区分
  → 下拉刷新：page=1，watch(props.loading) 回收 refreshing 标志
  → 点击视频卡片 → /detail/:id?sourceId=xxx
```

### 5.3 搜索

```text
/search
  → 输入关键词 → 防抖 500ms
  → 模式：当前源（源名称）| 聚合
    → 当前源：activeSource.adapter.search(kw, page, pageSize)
    → 聚合：Promise.allSettled 调所有 enabled sources
  → 写入 searchHistory（更新 lastAccessTime）
```

### 5.4 视频详情与播放

```text
/detail/:id?sourceId=xxx
  → 加载详情（adapter.getDetail）
  → stripHtml(detail.desc) 剥除 HTML 标签 + 解码实体
  → 选集（按线路分组）：Tabs 切换
  → 点击某集 → /player/:id?sourceId=xxx&episode=xxx
  → 写 history（progress=0, startAt=0）
  → 全屏 artplayer
  → 播放结束/退出：history.progress 更新
```

### 5.5 收藏 / 历史

```text
/favorite
  → favoriteStore.items 按 createdAt 倒序
  → SwipeCell + Cell 组合
  → 互斥关闭：Map<id, SwipeCellInstance> + document click 监听
  → 点击主体 → /detail/:id?sourceId=xxx
  → 左滑 → showConfirmDialog 二次确认 → store.remove

/history
  → historyStore.items 按 lastWatchTime 倒序
  → SwipeCell + Cell 组合（同上）
  → 点击主体 → /player/:id?sourceId=xxx
    → startAt = max(0, progress - 10)（续播减 10s）
  → 左滑 → showConfirmDialog 二次确认 → store.remove
```

### 5.6 设置

```text
/settings
  → 视频源管理：列表 / 增 / 改 / 启停 / 删
  → 主题：亮 / 暗 / 跟随系统
  → UA 设备类型：移动 / 桌面 / 平板
  → 数据管理：导出（Blob + FileReader）/ 导入（FileReader + JSON）
  → 关于（可选）
```

---

## 6. 页面与组件清单

### 6.1 页面（`packages/views/src/`）

| 路径 | 组件 | 职责 |
| --- | --- | --- |
| `/` | (router redirect) | → `/home` 或 `/settings/source/add` |
| `/home` | `home/index.vue` | 首页（顶栏 / 分类 / 视频列表） |
| `/search` | `search/index.vue` | 搜索页 |
| `/settings` | `settings/index.vue` | 设置首页 |
| `/settings/source/add` | `settings/source-form.vue` | 新增视频源 |
| `/settings/source/edit/:id` | `settings/source-form.vue` | 编辑视频源（含删除） |
| `/detail/:id` | `detail/index.vue` | 视频详情 |
| `/favorite` | `favorite/index.vue` | 收藏 |
| `/history` | `history/index.vue` | 历史 |
| `/player/:id` | `player/index.vue` | 全屏播放 |

### 6.2 通用组件（`packages/ui/src/components/`）

| 组件 | 职责 |
| --- | --- |
| `TabBar.vue` | 底部三 Tab（Vant Tabbar 封装） |
| `AppHeader.vue` | 顶栏（左 logo、中源名 Pop、右收藏历史） |
| `NavBar.vue` | 详情页 / 子页 Vant Navbar 封装（含 `rightText` 透传） |
| `EmptyState.vue` | 空状态（Vant `<van-empty>` + default slot） |
| `LoadingState.vue` | 加载占位（Vant Skeleton） |

### 6.3 业务组件（`packages/ui/src/business/`）

| 组件 | 职责 |
| --- | --- |
| `CategoryBar.vue` | 横向滚动分类条（自绘，支持拖动） |
| `CategoryBarSkeleton.vue` | 分类条骨架 |
| `VodList.vue` | 视频卡片网格（Vant PullRefresh + List + Grid） |
| `VodCard.vue` | 单个视频卡片（封面 + 标题 + 详情/播放图标） |
| `VodGridSkeleton.vue` | 视频网格骨架 |
| `ImagePreview.vue` | 图片预览（wheel 缩放 + 双指缩放 + 点击关闭） |
| `SearchBar.vue` | 搜索框（Vant Search）+ 模式切换 |
| `SearchHistory.vue` | 搜索历史（Vant Cell + Tag） |
| `EpisodeList.vue` | 选集列表（Vant Tabs + Grid） |
| `SourceForm.vue` | 视频源表单（Vant Form + Field） |

### 6.4 布局（`packages/views/src/layouts/`）

| 文件 | 职责 |
| --- | --- |
| `TabLayout.vue` | 带 TabBar 的根布局（`<router-view>` + 底部 Tab） |

### 6.5 全局预览（`apps/hplayer_web/src/App.vue`）

- `<usePreviewStore>` 单一 `<van-image-preview>` 实例位于根组件
- 任意子组件调 `usePreviewStore().open([...])` 即可触发
- 支持双指缩放、wheel 缩放、点击关闭

---

## 7. 数据模型

### 7.1 localStorage 键设计

| Key | 类型 | 用途 |
| --- | --- | --- |
| `hplayer:sources` | `VideoSource[]` | 视频源列表 |
| `hplayer:activeSourceId` | `string` | 当前选中的视频源 ID |
| `hplayer:favorites` | `FavoriteItem[]` | 收藏 |
| `hplayer:history` | `HistoryItem[]` | 历史（5 天清理） |
| `hplayer:searchHistory` | `SearchHistoryItem[]` | 搜索历史（5 天清理） |
| `hplayer:settings` | `Settings` | 主题 / UA 设备类型 |

### 7.2 类型定义（`packages/core/src/types/`）

```ts
// 视频源
export type SourceType = 't0_xml' | 't1_json'

export interface VideoSource {
  id: string
  name: string
  type: SourceType
  baseUrl: string
  pageSize?: number     // 1–100，默认 20
  enabled: boolean
  createdAt: number
  order: number
  remark?: string
}

// 分类
export interface Category {
  id: string
  name: string
  sourceId: string
}

// 视频列表项
export interface VodItem {
  id: string
  sourceId: string
  name: string
  pic: string
  year?: string
  area?: string
  type?: string
  remarks?: string
  actor?: string
  director?: string
  desc?: string
}

// 视频详情
export interface VodDetail extends VodItem {
  playFrom: PlayLine[]
  playList: Record<string, Episode[]>
}

export interface PlayLine { name: string }
export interface Episode { name: string; url: string }

// 收藏
export interface FavoriteItem {
  id: string
  vod: VodItem
  sourceId: string
  createdAt: number
}

// 历史
export interface HistoryItem {
  id: string
  vod: VodItem
  sourceId: string
  episode?: Episode
  progress: number       // 0–1
  duration?: number
  lastWatchTime: number
}

// 搜索历史
export interface SearchHistoryItem {
  keyword: string
  lastAccessTime: number // 滑动窗口清理依据
}

// 设置
export interface Settings {
  theme: 'light' | 'dark' | 'auto'
  deviceType: 'mobile' | 'desktop' | 'tablet'
  activeSourceId?: string
}
```

### 7.3 SourceForm 字段顺序（用户决策）

| # | 字段 | 控件 | 必填 | 默认值 | 校验 |
| --- | --- | --- | --- | --- | --- |
| 1 | `baseUrl` | Vant Field | ✅ | — | URL 格式，trim，自动去尾 `/` |
| 2 | `name` | Vant Field | ✅ | — | 1–20 字符 |
| 3 | `type` | Vant Radio | ✅ | `t1_json` | `t0_xml` / `t1_json` |
| 4 | `pageSize` | Vant Stepper | ❌ | `20` | 1–100 整数 |
| 5 | `enabled` | Vant Switch | ❌ | `true` | — |
| 6 | `remark` | Vant Field (textarea) | ❌ | — | ≤ 200 字符 |

> 编辑模式底部追加：红色「删除视频源」按钮 → `showConfirmDialog` 二次确认 → `store.remove(id)` → 跳回 `/settings`。

---

## 8. CMS 适配器

### 8.1 接口定义

```ts
export interface CmsAdapter {
  readonly type: SourceType
  init?(config: VideoSource): void
  getCategories(): Promise<Category[]>
  getList(params: { categoryId: string | number; page: number; pageSize: number }): Promise<ListPage<VodItem>>
  getDetail(id: string | number): Promise<VodDetail>
  search(params: { keyword: string; page: number; pageSize: number }): Promise<ListPage<VodItem>>
}

export interface ListPage<T> {
  list: T[]
  total: number
  pageCount: number
  currentPage: number
}
```

### 8.2 T1_JSON 适配器

苹果 CMS V10 JSON 协议。基础 URL：`{baseUrl}?ac=videolist&pg=1&pagesize=20&t=1&wd=...&ids=...`

| action | 用途 | 关键参数 |
| --- | --- | --- |
| `list` | 分类 | — |
| `videolist` | 列表 / 搜索 | `t` / `pg` / `pagesize` / `wd` |
| `detail` | 详情 | `ids` |

**字段映射**：`vod_id → id` / `vod_name → name` / `vod_pic → pic` / `vod_play_from` 按 `$$$` 拆线路 / `vod_play_url` 按 `$$$` 拆线路再按 `#` 拆集。

### 8.3 T0_XML 适配器

V1 仅占位（`t0-xml.ts`），V1.1 用 `fast-xml-parser` 实现。

### 8.4 适配器工厂

```ts
const cache = new Map<string, CmsAdapter>()
export function getAdapter(sourceId: string): CmsAdapter | null {
  if (cache.has(sourceId)) return cache.get(sourceId)!
  const src = sourceStore.getById(sourceId)
  if (!src) return null
  const adapter = createAdapter(src)
  cache.set(sourceId, adapter)
  return adapter
}
```

### 8.5 错误处理

- 网络错误：Toast 提示，列表保留上次数据。
- 4xx / 5xx / 超时：拦截器 `console.warn`，不 throw 到 UI（依赖响应拦截器处理）。
- 鉴权（401/403）：V1 忽略（无账号体系）。

### 8.6 UA 随机化（V1 增强）

`packages/core/src/api/ua-pool.ts`：

- `user-agents` 库（intoli 维护，每日更新）预生成 5 个 UA 池
- Axios `request` 拦截器每次请求 `nextUA()`，天然轮询 → 失败回退
- 设备类型（mobile / desktop / tablet）由 `useSettingsStore.setDeviceType` 触发池重建
- 防御性：池为空时回退到默认 mobile UA

### 8.7 缓存策略

- LRU 内存缓存（`utils/lru.ts`），容量 500。
- 分类 10min / 列表 5min / 详情 30min / 搜索 1min。
- 手动刷新（PullRefresh）清空当前分类与列表缓存。

---

## 9. 播放方案

### 9.1 协议映射

| 协议 | 检测 | 播放器 |
| --- | --- | --- |
| HLS | URL 含 `.m3u8` | `hls.js` + `<video>` |
| MP4 | URL 含 `.mp4` | 原生 `<video>` |
| FLV | URL 含 `.flv` | 原生 `<video>`（V1 占位） |
| 其他 | — | 原生 `<video>` 兜底 |

### 9.2 artplayer 配置

`playerStore.current.startAt` 在 `loadedmetadata` 后设置 `art.currentTime = startAt`，实现历史续播（减 10s 由 detail/index.vue 算出后写入 startAt）。

### 9.3 移动端优化

- `playsInline: true`（iOS 关键）
- 锁屏：artplayer 双击锁
- 进度记录：`timeupdate` 10s 一次写 history

---

## 10. 状态管理

### 10.1 Pinia Store 列表（`packages/core/src/store/`）

| Store | 职责 | 持久化 |
| --- | --- | --- |
| `useSourceStore` | 视频源增删改查、当前选中 | `localStorage` |
| `useFavoriteStore` | 收藏列表 | `localStorage` |
| `useHistoryStore` | 历史列表 + 5 天清理 | `localStorage` |
| `useSearchHistoryStore` | 搜索历史 + 5 天清理 | `localStorage` |
| `useSettingsStore` | 主题 / UA 设备类型 | `localStorage` |
| `usePlayerStore` | 当前播放上下文（不持久化） | 内存 |
| `usePreviewStore` | 全局图片预览 | 内存 |

### 10.2 与原规划的差异

- **未使用** `pinia-plugin-persistedstate` → 手写 `useXxxStore` + `storage` 工具
- **未使用** Pinia `pinia-shared-state` → V1 单窗口无需跨窗口同步
- **新增** `usePreviewStore`（P4 之后用户驱动）— 全局单一 ImagePreview 实例
- **新增** `useSettingsStore.setDeviceType` 触发 `UAPool.reset`

### 10.3 工具函数（`packages/core/src/utils/`）

| 工具 | 职责 |
| --- | --- |
| `storage.ts` | localStorage 封装（get/set + JSON 序列化） |
| `lru.ts` | LRU 缓存（Map 双向） |
| `migrate.ts` | V1 → V2 迁移（V2 启用） |
| `play-url.ts` | HLS / MP4 / FLV 协议识别 |
| `time.ts` | 5 天判定 / 时间格式化 |
| `page-size.ts` | 1–100 范围约束 |
| `strip-html.ts` | HTML 标签剥除 + 实体解码（用于剧情文本） |
| `backup.ts` | 数据导入导出（sources / favorites / history） |
| `ua-pool.ts` | user-agents 包装（设备类型 + 池轮询） |

---

## 11. 路由设计

### 11.1 路由表（`packages/router/src/index.ts`）

```ts
const routes = [
  { path: '/', redirect: '/home' },
  {
    path: '/',
    component: () => import('@hplayer/views').then(m => m.TabLayout),
    children: [
      { path: 'home',     component: () => import('@hplayer/views').then(m => m.HomePage) },
      { path: 'search',   component: () => import('@hplayer/views').then(m => m.SearchPage) },
      { path: 'settings', component: () => import('@hplayer/views').then(m => m.SettingsPage) },
    ],
  },
  { path: '/detail/:id',                  component: () => import('@hplayer/views').then(m => m.DetailPage) },
  { path: '/player/:id',                  component: () => import('@hplayer/views').then(m => m.PlayerPage) },
  { path: '/favorite',                    component: () => import('@hplayer/views').then(m => m.FavoritePage) },
  { path: '/history',                     component: () => import('@hplayer/views').then(m => m.HistoryPage) },
  { path: '/settings/source/add',         component: () => import('@hplayer/views').then(m => m.SourceFormPage) },
  { path: '/settings/source/edit/:id',    component: () => import('@hplayer/views').then(m => m.SourceFormPage) },
]
```

### 11.2 路由守卫

```ts
router.beforeEach((to) => {
  if (/^(\/home|\/detail|\/player)/.test(to.path)) {
    if (sourceStore.list.length === 0) {
      return { path: '/settings/source/add', replace: true }
    }
  }
})
```

### 11.3 Hash vs History

V1 用 **hash 模式**（V2 Capacitor Android 切换为 history 模式）。

---

## 12. 视觉与交互

### 12.1 主题色（Vant CSS 变量）

| Token | 亮色 | 暗色 |
| --- | --- | --- |
| `--van-primary-color` | `#3b82f6` | `#60a5fa` |
| `--van-background` | `#ffffff` | `#0a0a0a` |
| `--van-background-2` | `#f7f8fa` | `#1a1a1a` |
| `--van-text-color` | `#1f2937` | `#e5e7eb` |

### 12.2 主题切换

`useSettingsStore.theme` + `watch(theme, applyTheme)`：
- `light` / `dark` / `auto`（`prefers-color-scheme`）

### 12.3 关键交互（P4 之后用户驱动）

| 场景 | 实现 |
| --- | --- |
| 视频卡片 | 名称加粗居中 + 单行省略 + `title` tip；左上角详情 / 右上角播放图标 |
| 分类栏 | 去滚动条 + 拖动 + 紧凑（gap 4px, padding 6px 12px, 按钮 22px 高） |
| 首次选中 | 默认选中第一个分类 |
| 切换骨架 | `onCategorySelect` 清空 `items` → `showGridSkeleton` 显示 |
| 详情页 | `stripHtml(detail.desc)` 剥除 `<p>` / `<br>` / 实体 |
| 图片预览 | wheel 缩放 + 双指缩放 + 点击关闭 |
| 收藏/历史 | SwipeCell 互斥关闭 + showConfirmDialog 清空 |
| 清空按钮 | 边框 + padding 提升可点击性 |
| 搜索模式 | `当前源（源名称）` 替代 `当前源` |
| SourceForm | 字段对调（接口地址前置）+ 删除按钮 |
| 桌面端 touch | `@vant/touch-emulator`（SwipeCell 可拖） |

### 12.4 动画与过渡

- 路由切换：`<router-view v-slot="{ Component }">` + `<transition>`（左右滑入）。
- 列表项：进入动画用 Vant `<transition-group>`。
- 卡片点击：`transform: scale(0.97)` + 100ms 过渡。

### 12.5 响应式断点

| 设备 | 宽度 | 布局 |
| --- | --- | --- |
| 手机 | < 768px | 单列，3–4 卡片/行 |
| 平板 | 768–1024 | 5 卡片/行 |
| 桌面 | > 1024 | 居中容器，6 卡片/行，限宽 1200px |

> V1 优先保证手机体验，桌面端 `@vant/touch-emulator` 兜底手势。

---

## 13. 性能优化

### 13.1 图片懒加载

- `VodCard` 用 Vant `Lazyload` 指令
- 缩略图：源站原图（V1 不做压缩，依赖源站 CDN）
- 占位：`VodGridSkeleton` + `CategoryBarSkeleton`

### 13.2 虚拟列表

- 视频列表默认不上虚拟列表（20–60 条/页）
- 聚合搜索结果（V1 未上虚拟列表，规划中）

### 13.3 请求去重

- 同一 `sourceId + categoryId + page` 的请求在 200ms 内合并
- LRU 缓存已覆盖大部分重复请求

### 13.4 启动优化

- 路由懒加载
- 字体：系统字体栈，无 webfont 加载
- Vite chunk splitting：`vite.config.ts` `build.rollupOptions.output.manualChunks`

---

## 14. 测试与质量门禁（V1 实际）

### 14.1 单元 / 集成测试（Vitest）

**共 81 个测试通过 / 12 个测试文件**：

| 文件 | 覆盖 |
| --- | --- |
| `adapter/t1-json.test.ts` | T1JsonAdapter 字段映射 / 错误码 |
| `adapter/t1-json.integration.test.ts` | mock http 全链路 |
| `store/source.test.ts` | sourceStore 增删改查 + 持久化 |
| `store/source-delete.test.ts` | 删除边界（active 源回退 / 禁用源跳过） |
| `store/history.test.ts` | 5 天清理 |
| `store/search-history.test.ts` | 5 天清理 + 滑动窗口 |
| `utils/lru.test.ts` | LRU 命中 / 淘汰 |
| `utils/play-url.test.ts` | 协议识别 |
| `utils/time.test.ts` | 5 天判定 |
| `utils/page-size.test.ts` | 1–100 范围 |
| `utils/strip-html.test.ts` | HTML 剥除 + 实体解码 |
| `utils/backup.test.ts` | 数据导入导出 |
| `api/ua-pool.test.ts` | UA 池轮询 / reset / 单例 |

### 14.2 覆盖率

```
core 包：78.43%（utils 89.91% / store 81.67% / adapter 69.53%）
```

排除范围（`vite.config.ts coverage.exclude`）：
- `*.test.ts` / `*.spec.ts`
- `types/**`（纯类型无运行时）
- `index.ts`（re-export）
- `adapter/aggregate.ts` / `adapter/t0-xml.ts`（V1 占位）
- `store/favorite.ts` / `player.ts` / `preview.ts` / `settings.ts`（P5 范围外）
- `utils/migrate.ts`（V2 启用）

### 14.3 Biome 配置

```jsonc
{
  "linter": { "rules": {
    "recommended": true,
    "suspicious": { "noExplicitAny": "off" },
    "style": { "useImportType": "error", "useNodejsImportProtocol": "error" },
    "complexity": { "noBannedTypes": "error" }
  }},
  "javascript": { "formatter": {
    "quoteStyle": "single",
    "semicolons": "asNeeded",
    "trailingCommas": "all",
    "quoteProperties": "asNeeded"
  }},
  "files": { "includes": [
    "apps/**/*", "packages/**/*", "*.json", "*.ts", "*.vue",
    "!**/src/**/*.test.ts",     // 排除测试文件
    "!**/src/**/*.spec.ts"
  ]}
}
```

执行：
- `pnpm lint` → 0 errors / 101 warnings
- `pnpm format` → 92 files
- `pnpm type-check` → 5/5 packages
- `pnpm test --coverage` → 78.43%
- `pnpm build` → dist 产物

---

## 15. 项目结构（实际）

```text
hplayer/
├── apps/
│   └── hplayer_web/
│       ├── index.html
│       ├── vite.config.ts
│       ├── package.json
│       └── src/
│           ├── App.vue              # 根 + 单一 ImagePreview
│           ├── main.ts              # Vue + Pinia + Router + Vant + touch-emulator
│           ├── env.d.ts
│           └── styles/
│               ├── tailwind.css
│               └── vant-theme.css
├── packages/
│   ├── core/                        # 业务核心：types + stores + utils + adapter + api
│   │   ├── src/
│   │   │   ├── api/                 # client.ts (axios + UAPool) + ua-pool.ts
│   │   │   ├── adapter/             # types + t0-xml + t1-json + aggregate + index
│   │   │   ├── store/               # source / favorite / history / search-history
│   │   │   │                        #   settings / player / preview
│   │   │   ├── types/               # 全部类型定义
│   │   │   ├── utils/               # storage / lru / migrate / play-url
│   │   │   │                        #   time / page-size / strip-html / backup
│   │   │   └── index.ts             # 包入口
│   │   └── package.json
│   ├── router/
│   │   ├── src/
│   │   │   ├── index.ts
│   │   │   └── shims-vue.d.ts
│   │   └── package.json
│   ├── ui/                          # 业务无关组件
│   │   ├── src/
│   │   │   ├── business/            # CategoryBar / VodList / VodCard / SourceForm / ...
│   │   │   ├── components/          # TabBar / AppHeader / NavBar / Empty / Loading
│   │   │   └── index.ts
│   │   └── package.json
│   └── views/                       # 页面级组件
│       ├── src/
│       │   ├── home/
│       │   ├── search/
│       │   ├── settings/            # 含 source-form.vue
│       │   ├── detail/
│       │   ├── favorite/
│       │   ├── history/
│       │   ├── player/
│       │   ├── layouts/TabLayout.vue
│       │   └── index.ts
│       └── package.json
├── biome.json
├── package.json
├── pnpm-workspace.yaml
├── tailwind.config.js
├── tsconfig.json
├── tsconfig.base.json
├── vite.config.ts
└── coverage/                        # vitest 覆盖率输出
```

---

## 16. 里程碑

### V1.0 MVP（已完成 ✅）

- [x] pnpm + Vite + Vue 3 + TS + Vant 4 + Tailwind 4 + Biome（**P0**）
- [x] Core types + utils + stores（**P1**）
- [x] T1_JSON 适配器（**P2**）
- [x] UI 业务组件（**P3**）
- [x] 页面 + 路由（**P4**）
- [x] 集成测试 + 覆盖率 78.43%（**P5**）
- [x] lint + format + type-check + build（**P6**）
- [x] P4 之后 18 项用户驱动细化需求（合入 `9b2aeec`）
- [x] UA 随机化（`9b2aeec`）

### V1.1 增强（规划）

- [ ] T0_XML 适配器完整实现
- [ ] 聚合搜索结果虚拟列表（`vue-virtual-scroller`）
- [ ] 长按拖拽排序（视频源 / 分类）
- [ ] E2E 测试（Playwright）
- [ ] 把 `core` 排除 store 补单元测试（favorite / player / preview / settings）
- [ ] 视频源导入（JSON 配置文件）

### V2.0 Android（规划）

- [ ] Capacitor 8+ 集成
- [ ] localStorage → Capacitor SQLite 迁移（启用 `utils/migrate.ts`）
- [ ] 后台播放 + 锁屏控制（`@capacitor-community/mediainfo`）
- [ ] APK 打包 + 签名
- [ ] 应用内更新

---

## 17. 风险与对冲（V1 实际）

| 风险 | V1 应对 |
| --- | --- |
| 第三方 CMS 接口不规范 | 适配器层字段兼容 + 防御性 `??` 兜底 |
| HTTPS 跨域 | 多数 CMS 已 CORS，必要时用浏览器扩展 |
| HLS 在某些 Android WebView 不支持 | V2 切换 `media_kit` 原生 ExoPlayer |
| 单一 UA 触发反爬 | `UAPool` 随机化（`user-agents` 每日更新） |
| localStorage 容量超限 | 历史 / 搜索历史 5 天清理 + LRU 500 上限 |
| 第三方源站稳定性 | Axios 拦截器 `console.warn` + 适配器异常隔离 |
| 桌面端 SwipeCell 不可拖 | `@vant/touch-emulator` 桌面适配 |
| 资源站 403/反爬 | UAPool 自动轮换（每次请求 nextUA） |

---

## 18. 用户驱动细化需求（P4 之后）

> 全部在 P4 完成后由用户驱动追加，已合入 `a8bd4ca`（P4 final）与 `9b2aeec`（UA + biome）两个 commit。

| # | 需求 | 落地位置 |
| --- | --- | --- |
| 1 | 视频卡片视觉（标题加粗居中 + 省略 + tip + 详情/播放图标） | `business/VodCard.vue` |
| 2 | 分类栏去滚动条 + 拖动 + 紧凑 | `business/CategoryBar.vue` |
| 3 | 首次默认选中第一个分类 | `home/index.vue` `onMounted` |
| 4 | 分类切换显示骨架屏 | `home/index.vue` `onCategorySelect` + `showGridSkeleton` |
| 5 | 上滑分页 Toast loading | `VodList.vue` `onLoad` |
| 6 | 下拉刷新回收 `refreshing` | `VodList.vue` `watch(props.loading)` |
| 7 | AppHeader 收藏/历史按钮跳转 | `components/AppHeader.vue` `useRouter.push` |
| 8 | NavBar `rightText` 透传 | `components/NavBar.vue` |
| 9 | EmptyState 改 Vant `<van-empty>` | `components/EmptyState.vue` |
| 10 | 详情页剧情 HTML 剥除 | `core/utils/strip-html.ts` + `detail/index.vue` |
| 11 | 图片预览 wheel 缩放 + 点击关闭 | `business/ImagePreview.vue` |
| 12 | 收藏/历史 SwipeCell 互斥关闭 | `favorite/index.vue` + `history/index.vue` |
| 13 | 清空按钮 showConfirmDialog | 同上 |
| 14 | 清空按钮加边框 | `NavBar.vue` `:deep(.van-nav-bar__text)` |
| 15 | 搜索模式重命名 `当前源（源名称）` | `business/SearchBar.vue` + `search/index.vue` |
| 16 | 数据导入导出 | `core/utils/backup.ts` + `settings/index.vue` |
| 17 | SourceForm 字段对调（接口地址前置） | `business/SourceForm.vue` |
| 18 | SourceForm 删除按钮 | 同上 |
| 19 | 桌面端 touch 适配 | `apps/hplayer_web/src/main.ts` 引入 `@vant/touch-emulator` |
| 20 | Vant CSS 引入 | 同上 `import 'vant/lib/index.css'` |
| 21 | UA 随机化 | `core/api/ua-pool.ts` + `client.ts` |
| 22 | 设置页 UA 设备类型切换 UI | `settings/index.vue` |
| 23 | biome 配置更新（`noExplicitAny: off` / `semicolons: asNeeded` / `quoteProperties: asNeeded` / 排除测试文件） | `biome.json` |

---

## 19. 与原 v1.0 规划稿的对比（实施变更点）

| 维度 | 规划稿 | 实施定稿 | 变更原因 |
| --- | --- | --- | --- |
| Pinia 持久化 | `pinia-plugin-persistedstate` | 手写 store + `storage` 工具 | 减少依赖；store 与 utils 紧耦合更易测 |
| `player` 包 | 独立 `packages/player` | 合并到 `views/player/index.vue` | 播放页单点，单包无收益 |
| `utils` 包 | 独立 `packages/utils` | 合并到 `core/src/utils` | 跨包依赖过重 |
| `theme/` 目录 | `light.css` / `dark.css` | Vant CSS 变量 + `useSettingsStore` | 避免重复维护 |
| `SourcePicker.vue` | 通用组件 | 未实现（首页直接展示源名） | 用户偏好更紧凑布局 |
| `imagePreview` 单元 | 多图 + 缩略图 | 单图（V1 决策 #5） | mac-cms 海报通常 1:1 比例 |
| 5 天清理 | 滑动窗口 | 滑动窗口（**保留**） | 与原规划一致 |
| activeSourceId 持久化 | 优先选中 | **保留** | 与原规划一致 |
| `pageSize` 暴露 | 编辑表单 | **保留** | 与原规划一致 |
| 路由 `replace` 守卫 | `router.replace` | **保留** | 与原规划一致 |

---

## 20. 下一步建议

1. **V1.1**（推荐先做）：
   - T0_XML 适配器完整实现
   - core 包未覆盖 store 补单元测试（覆盖率 78% → 90%+）
   - E2E 测试（Playwright）覆盖关键路径

2. **V2.0**（长期）：
   - Capacitor 8+ 集成
   - 启用 `utils/migrate.ts` 做 localStorage → SQLite 迁移
   - 后台播放 + MediaSession

3. **V1 后续 bug 跟踪**：见 `STATE.md` 变更记录，所有 P4-P6 期间发现并修复的 30+ issue 已在 `STATE.md` 留痕。

---

## 21. 参考资料

- 原 v1.0 规划稿：[HPlayer.md](file:///workspace/docs/design/HPlayer.md)
- zyfun 源码分析：[CodeWiki.md](file:///workspace/docs/CodeWiki.md)
- 实施计划索引：[dev-plans/00-INDEX.md](file:///workspace/docs/dev-plans/00-INDEX.md)
- 阶段状态跟踪：[dev-plans/STATE.md](file:///workspace/docs/dev-plans/STATE.md)
- 苹果 CMS V10 API：[https://www.maccms.la/doc/v10/api.html](https://www.maccms.la/doc/v10/api.html)
- Vant 4 文档：[https://vant-ui.github.io/vant/v4/](https://vant-ui.github.io/vant/v4/)
- Tailwind CSS 4 文档：[https://tailwindcss.com/docs/installation/using-vite](https://tailwindcss.com/docs/installation/using-vite)
- Biome 文档：[https://biomejs.dev/](https://biomejs.dev/)
- artplayer 文档：[https://artplayer.org/](https://artplayer.org/)
- user-agents：[https://github.com/intoli/user-agents](https://github.com/intoli/user-agents)
- Capacitor 文档：[https://capacitorjs.com/](https://capacitorjs.com/)
