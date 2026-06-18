# hplayer 设计文档

> 文档版本：v1.0（已根据用户决策定稿）
> 编写日期：2026-06-13
> 最后更新：2026-06-13（v1.0 最终决策回填）
> 参考项目：[zyfun](file:///workspace/docs/CodeWiki.md)、[vue3-vant-mobile](https://github.com/vue-zone/vue3-vant-mobile)
> 目标：移动端优先的极简影视浏览/搜索/播放 App（Web 先行，Android 后续集成）

## 变更记录

| 版本 | 日期 | 变更 |
| --- | --- | --- |
| v1.0 | 2026-06-13 | 初稿 |
| v1.0-final | 2026-06-13 | 回填用户决策：① 路由守卫用 `replace`；② 5 天清理采用"滑动窗口"；③ `pageSize` 暴露在源编辑表单；④ 多源时优先选上次选中（持久化 `activeSourceId`）；⑤ 图片预览为单图模式 |

---

## 1. 项目概述

### 1.1 定位

hplayer 是一款**移动端优先**的极简影视资源浏览器，专注于"浏览 → 搜索 → 播放"三步体验：

- 借鉴 zyfun 的**多视频源聚合**思路，但**只取其精华**——CMS 适配器 + 播放 + 收藏。
- **不包含**直播、解析源、插件、实验室、AI、云同步、代理、桌面特性、多窗口、i18n 等 zyfun 的扩展能力。
- 形态演进：**V1 = Web Mobile（PWA/H5）** → **V2 = Capacitor Android 打包**。

### 1.2 与 zyfun 的关系

| 维度 | zyfun | hplayer |
| --- | --- | --- |
| 形态 | 桌面（Electron） | Web Mobile → Android（Capacitor） |
| 页面 | 9 个（film/live/parse/moment/lab/setting/test/player/browser） | 4 个（首页/搜索/设置/详情）+ 1 个播放层 |
| 视频源 | T0~T4 全套 | **T0_XML + T1_JSON**（V1） |
| 存储 | libSQL + 配置双写 | **localStorage**（V1）→ Capacitor SQLite（V2） |
| 状态 | Pinia + pinia-shared-state | Pinia + persistedstate（单窗口，无需跨窗口） |
| UI 库 | TDesign Vue Next | **Vant 4** + **Tailwind CSS 4** |
| 代码质量 | ESLint + Prettier + Stylelint | **Biome 2.4.5** |
| 后端 | 嵌入 Fastify（端口 9978） | **无后端**，浏览器直连第三方源 |
| 代码复用 | — | 仅参考 CMS Adapter、HTTP 客户端、播放器封装思路；不直接搬运 zyfun 渲染端代码 |

### 1.3 目标用户

- 拥有自定义视频源（Apple CMS JSON/XML）且希望**移动端**浏览的人群。
- 重视隐私与本地化（数据全部存在本地，不上云）。
- 偏好极简 UI，不需要桌面端那种"全能管家"。

### 1.4 核心价值主张

1. **快**：Web 端 Vite HMR，UI 调整即时生效；移动端列表/详情/播放无等待。
2. **轻**：V1 离线首屏 < 300KB，V2 APK < 20MB。
3. **稳**：多源聚合、单点故障不影响整体浏览。
4. **私**：无登录、无统计、无追踪、无云端。

---

## 2. 技术选型

### 2.1 选型总览

| 类别 | 选型 | 版本 | 理由 |
| --- | --- | --- | --- |
| 框架 | Vue 3 | ^3.5 | 组合式 API + `<script setup>` + 响应式稳定 |
| 构建 | Vite | ^7.0 | 启动 < 1s，HMR < 100ms |
| UI 组件 | Vant | ^4.9 | 移动端最佳实践，TS 一等公民，内置 60+ 组件 |
| 工具样式 | Tailwind CSS | ^4.0 | 与 Vant 互补，覆盖自定义类名与原子化布局 |
| 状态 | Pinia | ^2.2 | 轻量 + 持久化插件成熟 |
| 路由 | vue-router | ^4.4 | 移动端 hash 模式 + Capacitor 兼容 |
| 语言 | TypeScript | ^5.6 | 严格模式 |
| HTTP | Axios | ^1.7 | 拦截器、取消、并发控制成熟 |
| 视频 | hls.js | ^1.5 | HLS 标准方案 |
| 视频 | artplayer | ^5.1 | 移动端手势 + UI 自定义 |
| 工具 | @vueuse/core | ^11 | 移动端手势、媒体查询、滚动等 composable |
| 工具 | dayjs | ^1.11 | 轻量日期库（用于 5 天历史清理） |
| 代码质量 | Biome | ^2.4.5 | 替代 ESLint+Prettier，速度 10-100x，零配置 |
| 测试 | Vitest | ^2.1 | 与 Vite 同源，watch 模式 |
| 包管理 | pnpm | ^9.0 | 节省磁盘、Monorepo 一等公民 |

### 2.2 不选/延后项

- **Vue I18n**：您明确要求不要 i18n。
- **Pinia-shared-state**：V1 单窗口，无需跨窗口同步。
- **WebDAV/iCloud/云同步**：V1 不做。
- **HTTP 代理**：V1 不做（直接走浏览器原生 fetch）。
- **直播/IPTV/EPG**：V1 不做。
- **解析源模块**：V1 不做（T0/T1 直接返回播放 URL，无需独立解析）。
- **AIGC/插件/加密/Lab/终端/Monaco/Webview**：V1 不做。
- **VLC 原生桥接**：V1 不做（Web 用 artplayer + hls.js 已够用）。

---

## 3. 信息架构（IA）

### 3.1 顶层导航

```text
┌─────────────────────────────────────────────────────────────┐
│ Tab 1: 首页         Tab 2: 搜索         Tab 3: 设置         │
│   /home              /search            /settings           │
└─────────────────────────────────────────────────────────────┘
```

底部 Tabbar 三个入口（Vant [Tabbar](https://vant-ui.github.io/vant/v4/#/zh-CN/tabbar)）。

### 3.2 页面树

```text
/                     # 重定向到 /home（首次启动若无视频源则跳 /settings/source/add）
├── /home             # 首页
│   ├── (顶栏)
│   │   ├── 左侧：hplayer Logo + 标题
│   │   ├── 中间：当前视频源名（点击弹 Popup）
│   │   └── 右侧：收藏 / 历史 入口图标
│   ├── (分类条)      # Vant Sidebar 或横向滚动 Tab
│   └── (视频列表)    # Vant PullRefresh + List + 卡片
├── /search           # 搜索
│   ├── 搜索框 + 选项切换
│   ├── 搜索历史区
│   └── 搜索结果列表（复用视频卡片）
├── /settings         # 设置
│   ├── 视频源管理（增删改查）
│   ├── 主题（亮/暗/跟随系统）
│   ├── 关于
│   └── （V2 预留：数据导入/导出）
├── /detail/:id       # 视频详情
│   ├── 封面 + 标题 + 描述
│   ├── 线路切换（Tab）
│   └── 选集列表
├── /favorite         # 收藏列表
├── /history          # 历史列表
└── /player/:id       # 全屏播放
```

### 3.3 状态机

```text
┌──────────────┐    首次启动无源    ┌──────────────────────┐
│  App Start   │ ──────────────────▶│ /settings/source/add │
└──────────────┘                    └──────────┬───────────┘
        │                                     │ 添加成功
        │ 有源                                ▼
        ▼                              ┌──────────────┐
   ┌──────────────┐                    │   /home      │
   │   /home      │ ◀──────────────────└──────────────┘
   └──────┬───────┘
          │ 点击视频源名
          ▼
   ┌──────────────┐
   │ Popup 选择源 │ ── 切换 ──▶ 重新加载分类与列表 + 持久化 activeSourceId
   └──────────────┘
```

> **源选中策略（用户决策 #4）**：
> - 启动时优先读取 `localStorage['hplayer:activeSourceId']` 作为首页当前源。
> - 若该源已被删除，则回退到 `enabled === true` 的源中 `order` 最小的源。
> - 若 `activeSourceId` 不存在（首次启动后只添加过一个源），则将该源设为 `activeSourceId` 并持久化。

---

## 4. 关键页面流程

### 4.1 首次启动（无视频源）

```text
App 启动
  → 检查 localStorage.sources 是否为空
    → 空 → router.replace('/settings/source/add')        // 用户决策 #1
    → 非空 → router.replace('/home')
```

### 4.1.1 多源启动时的"上次选中"逻辑（用户决策 #4）

```text
/home 加载前
  → activeSourceId = localStorage['hplayer:activeSourceId']
  → 若 activeSourceId 存在且对应源仍存在且 enabled === true
      → 设为当前源
  → 否则
      → 候选 = sourceStore.list.filter(s => s.enabled).sort(byOrder)
      → 候选[0] 设为当前源，并写回 localStorage['hplayer:activeSourceId']
  → 加载该源的分类与列表
```

> **删除当前选中源时的行为**：sourceStore.remove(id) 时，若 id === activeSourceId，则按 §4.1.1 的回退策略自动切换到下一个候选源，并刷新首页。

### 4.2 首页浏览

```text
/home
  → sourceStore.activeSource = 当前选中源（默认第一个）
  → 加载分类（adapter.getCategories）
  → 默认选中第一个分类
  → 加载该分类第 1 页（adapter.getList({categoryId, page:1, pageSize})）
  → 渲染视频卡片瀑布流
  → 下拉刷新：page=1，重新加载
  → 上滑触底：page++，增量加载
  → 点击视频卡片 → /detail/:id
  → 点击卡片右上角播放图标 → /detail/:id
```

### 4.3 搜索

```text
/search
  → 输入关键词 → 防抖 500ms
  → 模式：单源 | 聚合
    → 单源：调当前 activeSource.adapter.search(kw, page, pageSize)
    → 聚合：并发所有 enabled sources 的 search，Promise.allSettled
  → 搜索结果合并，每个 result 标记 sourceId/sourceName
  → 点击结果 → /detail/:id?sourceId=xxx
  → 写入搜索历史（更新 lastAccessTime）
```

### 4.4 视频详情与播放

```text
/detail/:id?sourceId=xxx
  → sourceStore.getById(sourceId).adapter.getDetail(id)
  → 渲染：封面、标题、描述、年份、地区、演员
  → 选集（按线路分组）：Tabs 切换
  → 点击某集 → /player/:id?sourceId=xxx&episode=xxx
  → 写入 history（progress=0）
  → 全屏 artplayer 播放
  → 播放结束/退出：更新 history.progress
```

### 4.5 收藏/历史

```text
/favorite
  → favoriteStore.list()
  → 列表项：封面 + 标题 + 来源 + 操作（取消收藏）
  → 点击 → /detail/:id?sourceId=xxx

/history
  → historyStore.list()，按 lastWatchTime 倒序
  → 自动清理 lastAccessTime > 5×24h 的项（每次启动时跑一次，用户决策 #2 滑动窗口）
  → 列表项：封面 + 标题 + 进度条 + 来源
  → 点击 → /player/:id?sourceId=xxx（带 progress 续播）
```

### 4.6 设置

```text
/settings
  → 视频源管理
    → 列表（Vant Cell Group）
    → 增 / 删 / 改 / 启停（Switch）
    → 长按拖拽排序
  → 主题（Vant Radio Group）：亮 / 暗 / 跟随系统
  → 关于（版本号、GitHub、开源协议）
```

---

## 5. 页面与组件清单

### 5.1 页面（V1）

| 路径 | 组件 | 职责 |
| --- | --- | --- |
| `/home` | `views/home/index.vue` | 首页（顶栏/分类/列表） |
| `/search` | `views/search/index.vue` | 搜索页 |
| `/settings` | `views/settings/index.vue` | 设置首页 |
| `/settings/source/add` | `views/settings/source-form.vue` | 新增/编辑视频源 |
| `/detail/:id` | `views/detail/index.vue` | 视频详情 |
| `/favorite` | `views/favorite/index.vue` | 收藏 |
| `/history` | `views/history/index.vue` | 历史 |
| `/player/:id` | `views/player/index.vue` | 全屏播放 |

### 5.2 通用组件（`src/components/`）

| 组件 | 职责 |
| --- | --- |
| `TabBar.vue` | 底部三 Tab（Vant Tabbar 封装） |
| `AppHeader.vue` | 顶栏（左 logo、中源名 Pop、右收藏历史） |
| `SourcePicker.vue` | 视频源选择 Popup（Vant Popup + Cell） |
| `CategoryBar.vue` | 横向滚动分类条（Vant Sidebar 或自绘 Tab） |
| `VodList.vue` | 视频卡片网格（Vant PullRefresh + List + 网格） |
| `VodCard.vue` | 单个视频卡片（图片 + 标题 + 播放图标） |
| `ImagePreview.vue` | 图片预览（Vant ImagePreview 包装） |
| `EmptyState.vue` | 空状态 |
| `LoadingState.vue` | 加载占位（Skeleton） |
| `NavBar.vue` | 详情页/子页的 Vant Navbar 封装 |

### 5.3 业务组件（`src/components/business/`）

| 组件 | 职责 |
| --- | --- |
| `SearchBar.vue` | 搜索框（Vant Search 封装）+ 选项切换 |
| `SearchHistory.vue` | 搜索历史（Vant Cell + Tag） |
| `EpisodeList.vue` | 选集列表（Vant Tabs + Grid） |
| `SourceForm.vue` | 视频源表单（Vant Form + Field），字段见 §6.4 |

---

## 6. 数据模型

### 6.1 localStorage 键设计（V1）

| Key | 类型 | 用途 |
| --- | --- | --- |
| `hplayer:sources` | `VideoSource[]` | 视频源列表 |
| `hplayer:activeSourceId` | `string` | 当前选中的视频源 ID |
| `hplayer:sourceOrder` | `string[]` | 视频源排序 |
| `hplayer:favorites` | `FavoriteItem[]` | 收藏 |
| `hplayer:history` | `HistoryItem[]` | 历史（带 5 天清理） |
| `hplayer:searchHistory` | `SearchHistoryItem[]` | 搜索历史（5 天） |
| `hplayer:settings` | `Settings` | 主题等设置 |

### 6.2 类型定义（`src/types/`）

```ts
// 视频源
export type SourceType = 't0_xml' | 't1_json';

export interface VideoSource {
  id: string;            // uuid
  name: string;          // 用户可编辑
  type: SourceType;      // 适配器类型
  baseUrl: string;       // 基础 URL，如 https://caiji.maotaizy.cc/api.php/provide/vod
  pageSize?: number;     // 单页条数；缺省 20
  enabled: boolean;
  createdAt: number;     // 时间戳（毫秒）
  order: number;         // 排序权重
  remark?: string;       // 备注
}

// 分类
export interface Category {
  id: string;
  name: string;
  sourceId: string;
}

// 视频列表项
export interface VodItem {
  id: string;            // 源站 ID
  sourceId: string;      // 所属视频源
  name: string;          // 标题
  pic: string;           // 海报 URL
  year?: string;
  area?: string;
  type?: string;         // 分类名
  remarks?: string;      // 备注（如"更新至 24 集"）
  // 详情页才有的字段（可选）
  actor?: string;
  director?: string;
  desc?: string;
}

// 视频详情（含选集）
export interface VodDetail extends VodItem {
  playFrom: PlayLine[];  // 多个线路
  playList: Record<string, Episode[]>; // 线路名 → 集列表
}

export interface PlayLine {
  name: string;          // 线路名，如"线路1"
}

export interface Episode {
  name: string;          // 集名，如"第01集"
  url: string;           // 播放 URL
}

// 收藏
export interface FavoriteItem {
  id: string;            // uuid
  vod: VodItem;          // 冗余存储关键字段，便于离线展示
  sourceId: string;
  createdAt: number;
}

// 历史
export interface HistoryItem {
  id: string;            // uuid
  vod: VodItem;
  sourceId: string;
  episode?: Episode;
  progress: number;      // 0~1
  duration?: number;     // 秒
  lastWatchTime: number; // 时间戳
}

// 搜索历史
export interface SearchHistoryItem {
  keyword: string;
  lastAccessTime: number; // 滑动窗口清理依据（5×24h）
}

// 设置
export interface Settings {
  theme: 'light' | 'dark' | 'auto';
  activeSourceId?: string;
}
```

### 6.3 V1 → V2 迁移预案

| V1 存储 | V2 存储 | 迁移方式 |
| --- | --- | --- |
| `hplayer:sources` | SQLite `site` 表 | 启动时检测并迁移 |
| `hplayer:favorites` | SQLite `star` 表 | 同上 |
| `hplayer:history` | SQLite `history` 表 | 同上 |
| `hplayer:searchHistory` | SQLite `search_history` 表 | 同上 |
| `hplayer:settings` | SQLite `setting` 表 | 同上 |

> 迁移逻辑写在 `src/utils/migrate.ts`，V2 集成 Capacitor SQLite 时启用。

### 6.4 视频源编辑表单字段（用户决策 #3）

`SourceForm.vue` 的字段定义（与 `VideoSource` 类型对应）：

| 字段 | 控件 | 必填 | 默认值 | 校验 |
| --- | --- | --- | --- | --- |
| `name` | Vant Field | ✅ | — | 1~20 字符 |
| `type` | Vant Radio | ✅ | `t1_json` | 仅 `t0_xml` / `t1_json` |
| `baseUrl` | Vant Field | ✅ | — | URL 格式，存前 `trim`，自动去除尾部 `/` |
| `pageSize` | Vant Stepper | ❌ | `20` | 1~100 整数 |
| `enabled` | Vant Switch | ❌ | `true` | — |
| `remark` | Vant Field（textarea） | ❌ | — | ≤ 200 字符 |

> **pageSize 校验范围**：1 ≤ pageSize ≤ 100。低于 1 自动重置为 1，高于 100 重置为 100。提交时去除前后空格。
> **pageSize 使用规则**（§7.2 细化）：
> - 用户在 T1_JSON 接口调用时透传 `pagesize` 参数。
> - 若用户未填（缺省 20），`getList` / `search` 默认走 20。
> - 单次调用可临时覆盖（`getList({ pageSize: 10 })`），但 UI 不暴露该能力。

---

## 7. CMS 适配器

### 7.1 接口定义

```ts
// src/adapter/types.ts
export interface CmsAdapter {
  readonly type: SourceType;
  getCategories(): Promise<Category[]>;
  getList(params: { categoryId: string | number; page: number; pageSize: number }): Promise<{ list: VodItem[]; total: number; pageCount: number }>;
  getDetail(id: string | number): Promise<VodDetail>;
  search(params: { keyword: string; page: number; pageSize: number }): Promise<{ list: VodItem[]; total: number; pageCount: number }>;
  // 可选：嗅探/代理/动作（V1 占位，V2 再实现）
  init?(config: VideoSource): void | Promise<void>;
}
```

### 7.2 T1_JSON 适配器（优先实现）

**参考接口**：[苹果CMS V10 标准 JSON API](https://www.maccms.la/doc/v10/api.html)

**基础 URL 形式**：`{baseUrl}?ac={action}&pg={page}&pagesize={pageSize}&t={typeId}&wd={keyword}&ids={ids}`

| action | 用途 | 关键参数 |
| --- | --- | --- |
| `videolist` | 列表 | `t`(分类ID)、`pg`(页码)、`pagesize`(每页条数) |
| `videolist` | 搜索 | `wd`(关键词)、`pg`、`pagesize` |
| `detail` | 详情 | `ids`(视频ID) |

**返回结构**（标准 MacCms V10 JSON）：

```json
{
  "code": 1,
  "msg": "数据列表",
  "page": 1,
  "pagecount": 100,
  "total": 2000,
  "list": [
    {
      "vod_id": 123,
      "vod_name": "示例剧名",
      "vod_pic": "https://.../cover.jpg",
      "vod_remarks": "更新至 24 集",
      "vod_year": "2025",
      "vod_area": "大陆",
      "vod_class": "电视剧",
      "vod_actor": "...",
      "vod_director": "...",
      "vod_content": "剧情简介...",
      "vod_play_from": "线路1$$$线路2",
      "vod_play_url": "第01集$url1#第02集$url2$$$第01集$url3#第02集$url4"
    }
  ]
}
```

**字段映射**：

| 适配器字段 | JSON 字段 |
| --- | --- |
| `id` | `vod_id` |
| `name` | `vod_name` |
| `pic` | `vod_pic` |
| `remarks` | `vod_remarks` |
| `year` | `vod_year` |
| `area` | `vod_area` |
| `type` | `vod_class` |
| `actor` | `vod_actor` |
| `director` | `vod_director` |
| `desc` | `vod_content` |
| `playFrom` | 解析 `vod_play_from.split('$$$')` |
| `playList` | 解析 `vod_play_url.split('$$$')` → 数组 → 按 `###` 或 `#` 拆集 |

**接口实现要点**：

```ts
// src/adapter/t1-json.ts（伪代码）
class T1JsonAdapter implements CmsAdapter {
  readonly type = 't1_json' as const;
  private baseUrl: string;
  private defaultPageSize: number;

  init(config: VideoSource) {
    this.baseUrl = config.baseUrl.replace(/\/+$/, '');
    this.defaultPageSize = clampPageSize(config.pageSize ?? 20);  // §6.4 校验
  }

  async getCategories() { /* GET baseUrl?ac=list */ }
  async getList({ categoryId, page, pageSize }) {
    const ps = clampPageSize(pageSize ?? this.defaultPageSize);
    // GET `${baseUrl}?ac=videolist&t=${categoryId}&pg=${page}&pagesize=${ps}`
  }
  async getDetail(id) {
    // GET `${baseUrl}?ac=detail&ids=${id}`
  }
  async search({ keyword, page, pageSize }) {
    const ps = clampPageSize(pageSize ?? this.defaultPageSize);
    // GET `${baseUrl}?ac=videolist&wd=${encodeURIComponent(keyword)}&pg=${page}&pagesize=${ps}`
  }
}

// 工具：pageSize 范围约束（1 ≤ x ≤ 100）
function clampPageSize(n: number): number {
  if (!Number.isFinite(n) || n < 1) return 1;
  if (n > 100) return 100;
  return Math.floor(n);
}
```

### 7.3 T0_XML 适配器

使用 [fast-xml-parser](https://github.com/NaturalIntelligence/fast-xml-parser) 解析，字段映射与 JSON 一致。请求参数 `ac/list/videolist/detail` 相同，差异仅在数据格式。

### 7.4 适配器工厂

```ts
// src/adapter/index.ts
const factories: Record<SourceType, (config: VideoSource) => CmsAdapter> = {
  t0_xml: (c) => new T0XmlAdapter(c),
  t1_json: (c) => new T1JsonAdapter(c),
};

export function createAdapter(config: VideoSource): CmsAdapter {
  return factories[config.type](config);
}

const cache = new Map<string, CmsAdapter>();
export function getAdapter(sourceId: string): CmsAdapter | null {
  if (cache.has(sourceId)) return cache.get(sourceId)!;
  const src = sourceStore.getById(sourceId);
  if (!src) return null;
  const adapter = createAdapter(src);
  cache.set(sourceId, adapter);
  return adapter;
}
```

### 7.5 聚合搜索实现

```ts
// src/adapter/aggregate.ts
export async function aggregateSearch(keyword: string, page = 1, pageSize = 20) {
  const sources = sourceStore.list.filter(s => s.enabled);
  const results = await Promise.allSettled(
    sources.map(async (s) => {
      const adapter = getAdapter(s.id)!;
      const res = await adapter.search({ keyword, page, pageSize });
      return res.list.map(item => ({ ...item, sourceName: s.name }));
    })
  );
  return results
    .filter((r): r is PromiseFulfilledResult<VodItem[]> => r.status === 'fulfilled')
    .flatMap(r => r.value);
}
```

### 7.6 缓存策略

- **LRU 内存缓存**（`@vueuse/core` 的 `useStorage` + 自实现 LRU）：
  - 分类：10 分钟
  - 列表：5 分钟
  - 详情：30 分钟
  - 搜索：1 分钟
- 容量上限：500 条，避免 OOM。
- 失效策略：手动刷新（PullRefresh）清空当前分类与列表缓存。

### 7.7 错误处理

- 网络错误：Toast 提示，列表保留上次数据。
- 4xx 错误：标记该源为 `degraded`（图标降级），仍可使用其他源。
- 5xx 错误：指数退避重试 3 次（间隔 1s/2s/4s）。
- 鉴权错误（401/403）：V1 直接忽略（V1 不做账号体系）。

---

## 8. 播放方案

### 8.1 视频源类型与播放器映射

| 协议 | 检测 | 播放器 |
| --- | --- | --- |
| HLS | URL 含 `.m3u8` | `hls.js` + `<video>` |
| MP4 | URL 含 `.mp4` 或 Content-Type | 原生 `<video>` |
| FLV | URL 含 `.flv` | `flv.js` + `<video>`（V1 占位） |
| 其他 | — | 原生 `<video>` 兜底 |

### 8.2 artplayer 配置（V1 推荐）

```ts
new Artplayer({
  container: el,
  url: episode.url,
  type: episode.url.includes('.m3u8') ? 'm3u8' : 'auto',
  customType: {
    m3u8: (video, url) => {
      const hls = new Hls();
      hls.loadSource(url);
      hls.attachMedia(video);
    },
  },
  autoplay: true,
  playsInline: true,
  fullscreen: true,
  lock: true,
  theme: '#3b82f6', // 蓝色主色
  controls: [
    { name: 'play', position: 'tl' },
    { name: 'time', position: 'tl' },
    { name: 'progress', position: 'tl' },
    { name: 'pip', position: 'tr' },
    { name: 'fullscreen', position: 'tr' },
  ],
});
```

### 8.3 移动端优化

- `playsInline` 必开，避免 iOS Safari/WebView 默认全屏接管。
- 启用 `x5-video-player-type="h5"`（V1 Web 端可不设，V2 Android WebView 需设置）。
- 锁屏控制：使用 `MediaSession` API（V1 浏览器支持，V2 Capacitor 用插件）。
- 进度记录：监听 `timeupdate`，10 秒一次写入 `historyStore`。

### 8.4 播放页布局

```text
┌─────────────────────────────────────┐
│ ← 返回                          ⋮  │  ← Vant Navbar（透明）
├─────────────────────────────────────┤
│                                     │
│           [视频画面]                │
│                                     │
├─────────────────────────────────────┤
│ 标题: 视频名 - 第 01 集            │
│ 来源: xxx视频源                     │
│ [线路1] [线路2] [线路3]  ← Tabs    │
│ 第01集 第02集 第03集 ...  ← 网格   │
└─────────────────────────────────────┘
```

---

## 9. 状态管理

### 9.1 Pinia Store 划分

| Store | 路径 | 职责 | 持久化 |
| --- | --- | --- | --- |
| `useSourceStore` | `store/source.ts` | 视频源增删改查、当前选中 | `localStorage` |
| `useFavoriteStore` | `store/favorite.ts` | 收藏列表 | `localStorage` |
| `useHistoryStore` | `store/history.ts` | 历史列表 + 5 天清理 | `localStorage` |
| `useSearchHistoryStore` | `store/search-history.ts` | 搜索历史 + 5 天清理 | `localStorage` |
| `useSettingsStore` | `store/settings.ts` | 主题等 | `localStorage` |
| `usePlayerStore` | `store/player.ts` | 当前播放上下文（不持久化） | 内存 |

### 9.2 Store 通信

- **首页 → 搜索页**：通过 `useSearchHistoryStore`，无直接耦合。
- **首页 → 详情页**：通过路由参数 `?sourceId=xxx&id=xxx`。
- **详情页 → 播放页**：通过路由参数 + `usePlayerStore`（进入播放页前 set，播放页 onUnmounted 时清）。
- **设置页 → 全局**：直接调 `useSourceStore` / `useSettingsStore`，无事件总线。

### 9.3 持久化

使用 [pinia-plugin-persistedstate](https://prazdevs.github.io/pinia-plugin-persistedstate/)，按 store 单独声明：

```ts
// store/favorite.ts
export const useFavoriteStore = defineStore('favorite', () => {
  // ...
}, {
  persist: {
    key: 'hplayer:favorites',
    storage: localStorage,
  },
});
```

---

## 10. 路由设计

### 10.1 路由表

```ts
// src/router/index.ts
const routes = [
  { path: '/', redirect: '/home' },
  {
    path: '/',
    component: () => import('@/layouts/TabLayout.vue'),
    children: [
      { path: 'home', component: () => import('@/views/home/index.vue'), meta: { title: '首页' } },
      { path: 'search', component: () => import('@/views/search/index.vue'), meta: { title: '搜索' } },
      { path: 'settings', component: () => import('@/views/settings/index.vue'), meta: { title: '设置' } },
    ],
  },
  { path: '/detail/:id', component: () => import('@/views/detail/index.vue'), meta: { title: '详情' } },
  { path: '/player/:id', component: () => import('@/views/player/index.vue'), meta: { title: '播放', fullscreen: true } },
  { path: '/favorite', component: () => import('@/views/favorite/index.vue'), meta: { title: '收藏' } },
  { path: '/history', component: () => import('@/views/history/index.vue'), meta: { title: '历史' } },
  { path: '/settings/source/add', component: () => import('@/views/settings/source-form.vue'), meta: { title: '新增视频源' } },
  { path: '/settings/source/edit/:id', component: () => import('@/views/settings/source-form.vue'), meta: { title: '编辑视频源' } },
];
```

### 10.2 路由守卫

```ts
router.beforeEach((to) => {
  if (to.path === '/home' || to.path.startsWith('/detail') || to.path.startsWith('/player')) {
    if (sourceStore.list.length === 0) {
      // 首次启动无源 → 使用 replace 跳转（用户决策 #1），避免返回栈污染
      return { path: '/settings/source/add', replace: true };
    }
  }
});
```

> **首次跳转使用 `router.replace` 而非 `router.push`**：避免用户在添加源后按返回键回到空白首页。

### 10.3 Hash vs History

V1 使用 **hash 模式**，V2 Capacitor Android 切换为 **history 模式**（Capacitor 内部 WebView 自动处理 `index.html` fallback）。

---

## 11. 视觉与交互

### 11.1 主题色

| Token | 亮色 | 暗色 |
| --- | --- | --- |
| `--van-primary-color` | `#3b82f6`（blue-500） | `#60a5fa`（blue-400） |
| `--van-background` | `#ffffff` | `#0a0a0a` |
| `--van-background-2` | `#f7f8fa` | `#1a1a1a` |
| `--van-text-color` | `#1f2937` | `#e5e7eb` |

### 11.2 主题切换实现

- 主题通过 Vant 的 ConfigProvider + CSS 变量切换。
- `useSettingsStore.theme` 控制：
  - `light`：始终亮色
  - `dark`：始终暗色
  - `auto`：跟随 `prefers-color-scheme`（`@vueuse/core` 的 `usePreferredDark`）

### 11.3 动画与过渡

- 路由切换：`<router-view v-slot="{ Component }">` + `<transition name="slide">`（左右滑入）。
- 列表项：进入动画用 Vant `<transition-group>`，每项 50ms 错开。
- 卡片点击：`transform: scale(0.97)` + 100ms 过渡。

### 11.4 移动端手势

| 场景 | 手势 | 库 |
| --- | --- | --- |
| 分类条切换 | 左右滑 | Vant Sidebar 自带 |
| 图片预览 | 双指缩放、单击关闭 | Vant ImagePreview |
| 下拉刷新 | 下拉 | Vant PullRefresh |
| 上滑加载 | 触底 | Vant List |
| 详情页左右切集 | 左右滑 | `@vueuse/gesture` |
| 播放器锁屏 | 双击 | artplayer |

### 11.5 响应式断点

| 设备 | 宽度 | 布局 |
| --- | --- | --- |
| 手机 | < 768px | 单列，3-4 卡片/行（自适应） |
| 平板 | 768~1024 | 5 卡片/行 |
| 桌面 | > 1024 | 居中容器，6 卡片/行，限宽 1200px |

> V2 桌面适配可选；V1 优先保证手机体验。

---

## 12. 性能优化

### 12.1 图片懒加载

- 所有 `VodCard` 的图片用 Vant [Lazyload](https://vant-ui.github.io/vant/v4/#/zh-CN/lazyload) 指令。
- 缩略图：使用源站提供的图源，宽度限制 300px 减少流量。
- 占位：[Vant Skeleton](https://vant-ui.github.io/vant/v4/#/zh-CN/skeleton) 渲染 3 张灰色占位卡。

### 12.2 虚拟列表

- 搜索聚合结果可能上千条：使用 [vue-virtual-scroller](https://github.com/Akryum/vue-virtual-scroller) 的 `RecycleScroller`。
- 视频列表默认不上虚拟列表（一般 20-60 条），仅聚合搜索结果上虚拟列表。

### 12.3 请求去重

- 同一 `sourceId + categoryId + page` 的请求在 200ms 内合并。
- 实现：基于 `@vueuse/core` 的 `useDebounceFn` + Map 缓存 Promise。

### 12.4 启动优化

- 路由懒加载（已规划）。
- 视频源数据预热：仅预热当前选中源的 `getCategories`，其余按需。
- 字体：使用系统字体栈，无 webfont 加载。

### 12.5 缓存复用

- HTTP 缓存：V1 浏览器默认即可，V2 Capacitor 可加 `Cache-Control` 拦截器。
- 内存 LRU：见 §7.6。

---

## 13. Capacitor 集成规划（V2）

### 13.1 工程结构

```text
hplayer/
├── apps/
│   ├── hplayer_web/                # V1 Web SPA
│   └── hplayer_android/            # V2 Capacitor Android
│       ├── android/                # Gradle 工程
│       └── capacitor.config.ts
├── packages/
│   ├── core/
│   ├── player/
│   ├── ui/
│   ├── router/
│   ├── store/
│   └── utils/
```

### 13.2 插件清单（V2 选型）

| 能力 | 插件 | 用途 |
| --- | --- | --- |
| 状态栏 | `@capacitor/status-bar` | 沉浸式 |
| 启动屏 | `@capacitor/splash-screen` | 启动体验 |
| KV 存储 | `@capacitor/preferences` | 主题、版本号 |
| SQLite | `@capacitor-community/sqlite` | 业务数据 |
| 文件系统 | `@capacitor/filesystem` | 缓存 |
| 后台播放 | `@capawesome/capacitor-background-task` | 切后台继续播放 |
| 锁屏控制 | `@capacitor-community/mediainfo` | MediaSession |
| 应用更新 | `@capawesome/capacitor-app-update` | APK 热更新 |
| 屏幕方向 | `@capacitor/screen-orientation` | 播放页强制横屏（可选） |
| 触觉反馈 | `@capacitor/haptics` | 关键操作反馈 |

### 13.3 V1 → V2 迁移

- 数据迁移：`src/utils/migrate.ts` 在 V2 启动时执行，检测 localStorage → 写入 SQLite。
- 视频源导入：新增 "导入 zyfun 备份 JSON" 功能（解析 zyfun 备份中的 `site` 表）。

### 13.4 性能优化

- WebView 优化：开启硬件加速、禁用长按菜单。
- 视频预加载：V1 已用 `<video preload="metadata">`，V2 增加 `media_kit` 原生层预加载。
- 包大小：移除 Vant 不需要的组件（按需引入已自带 tree-shaking）。

---

## 14. 测试策略

### 14.1 单元测试（Vitest）

| 模块 | 覆盖 |
| --- | --- |
| `adapter/t1-json.ts` | 字段映射、URL 拼接、错误码处理 |
| `adapter/t0-xml.ts` | XML 解析、字段映射 |
| `utils/lru.ts` | LRU 命中/淘汰 |
| `utils/migrate.ts` | V1 → V2 字段映射 |
| `store/favorite.ts` | 增删查 |
| `store/history.ts` | 5 天清理逻辑 |
| `utils/play-url.ts` | HLS/MP4/FLV 协议识别 |

### 14.2 组件测试（Vitest + Vue Test Utils）

| 组件 | 覆盖 |
| --- | --- |
| `VodCard.vue` | 渲染图片/标题/播放图标；点击事件 |
| `SourcePicker.vue` | 列表渲染、切换事件 |
| `CategoryBar.vue` | 横向滚动、点击切换 |
| `EpisodeList.vue` | 线路切换、选集点击 |

### 14.3 E2E（Playwright，可选）

| 流程 | 覆盖 |
| --- | --- |
| 添加视频源 → 浏览 → 搜索 → 播放 | 关键路径 |
| 收藏 → 取消收藏 | 持久化 |
| 5 天历史清理 | 时钟模拟 |

### 14.4 覆盖率目标

- 单元测试 + 组件测试：**70%**
- E2E：覆盖 3 个核心流程

---

## 15. 项目结构

```text
hplayer/
├── apps/
│   ├── hplayer_web/
│   │   ├── index.html
│   │   ├── vite.config.ts
│   │   └── src/
│   │       └── main.ts
│   └── hplayer_android/             # V2 占位
├── packages/
│   ├── core/
│   │   ├── src/
│   │   │   ├── api/                # Axios 实例
│   │   │   ├── adapter/
│   │   │   │   ├── types.ts
│   │   │   │   ├── t0-xml.ts
│   │   │   │   ├── t1-json.ts
│   │   │   │   ├── aggregate.ts
│   │   │   │   └── index.ts        # 工厂 + 缓存
│   │   │   ├── model/              # 类型定义
│   │   │   ├── store/
│   │   │   │   ├── source.ts
│   │   │   │   ├── favorite.ts
│   │   │   │   ├── history.ts
│   │   │   │   ├── search-history.ts
│   │   │   │   ├── settings.ts
│   │   │   │   └── player.ts
│   │   │   ├── utils/
│   │   │   │   ├── storage.ts      # localStorage 封装
│   │   │   │   ├── lru.ts
│   │   │   │   ├── migrate.ts      # V1 → V2
│   │   │   │   ├── play-url.ts     # 协议识别
│   │   │   │   └── time.ts         # 5 天判定
│   │   │   └── index.ts
│   │   └── package.json
│   ├── player/
│   │   ├── src/
│   │   │   ├── index.ts            # 统一接口
│   │   │   ├── hls.ts
│   │   │   ├── artplayer.ts
│   │   │   └── web-player.vue      # 播放页组件
│   │   └── package.json
│   ├── ui/
│   │   ├── src/
│   │   │   ├── components/         # 通用组件
│   │   │   │   ├── TabBar.vue
│   │   │   │   ├── AppHeader.vue
│   │   │   │   ├── SourcePicker.vue
│   │   │   │   ├── CategoryBar.vue
│   │   │   │   ├── VodList.vue
│   │   │   │   ├── VodCard.vue
│   │   │   │   ├── ImagePreview.vue
│   │   │   │   ├── EmptyState.vue
│   │   │   │   └── NavBar.vue
│   │   │   ├── business/           # 业务组件
│   │   │   │   ├── SearchBar.vue
│   │   │   │   ├── SearchHistory.vue
│   │   │   │   ├── EpisodeList.vue
│   │   │   │   └── SourceForm.vue
│   │   │   ├── theme/
│   │   │   │   ├── light.css
│   │   │   │   └── dark.css
│   │   │   └── index.ts
│   │   └── package.json
│   ├── router/
│   │   ├── src/index.ts
│   │   └── package.json
│   └── utils/
│       ├── src/                    # 通用工具
│       └── package.json
├── pnpm-workspace.yaml
├── package.json
├── biome.json
├── tailwind.config.js
├── tsconfig.json
├── vite.config.ts
└── docs/
    ├── CodeWiki.md
    └── design/
        └── HPlayer.md              # 本文档
```

---

## 16. 里程碑

### V1.0 MVP（Web Mobile）

- [ ] 初始化 pnpm + Vite + Vue 3 + TS + Vant 4 + Tailwind 4 + Biome
- [ ] 路由 + Tab 布局
- [ ] 视频源管理（增删改查）
- [ ] T1_JSON 适配器
- [ ] 首页：顶栏 / 分类 / 视频列表
- [ ] 详情页：选集
- [ ] 播放页：artplayer + hls.js
- [ ] 搜索：单源 + 聚合
- [ ] 搜索历史（5 天）
- [ ] 收藏
- [ ] 历史（5 天保留 + 进度续播）
- [ ] 主题切换（亮/暗/跟随）
- [ ] 单元测试（70% 覆盖）

### V1.1 增强

- [ ] T0_XML 适配器
- [ ] 图片预览（双指缩放、点击关闭）
- [ ] 视频源导入（JSON 配置）
- [ ] 长按拖拽排序
- [ ] E2E 测试

### V2.0 Android（Capacitor）

- [ ] Capacitor 8+ 集成
- [ ] localStorage → Capacitor SQLite 迁移
- [ ] 后台播放 + 锁屏控制
- [ ] APK 打包 + 签名
- [ ] 应用内更新

---

## 17. 风险与对冲

| 风险 | 应对 |
| --- | --- |
| 第三方 CMS 接口不规范（字段缺失、命名差异） | 适配器层加 `try/catch` 与字段兼容，必要时扩展 `config.fieldMap` |
| HTTPS 跨域 | 多数 CMS 已 CORS，必要时用 `?ac=...&ct=1` 强制 JSONP 或让用户用浏览器扩展 |
| HLS 在某些 Android WebView 不支持 | V2 切换 `media_kit` 原生 ExoPlayer |
| localStorage 容量超限（>5MB） | 历史/搜索历史用 LRU 上限，源站海报不缓存 |
| 第三方源站稳定性 | 适配器层加超时 + 指数退避 + degraded 标记 |
| Vant 主题与 Tailwind 冲突 | Tailwind 限制 `corePlugins.preflight: false`，不重置按钮等原生元素 |

---

## 18. 参考资料

- zyfun 源码：[CodeWiki.md](file:///workspace/docs/CodeWiki.md)
- vue3-vant-mobile 模板：[vue-zone/vue3-vant-mobile](https://github.com/vue-zone/vue3-vant-mobile)（仅参考 UI 风格/结构/构建，Tailwind 4 替换 UnoCSS）
- 苹果 CMS V10 API 文档：[https://www.maccms.la/doc/v10/api.html](https://www.maccms.la/doc/v10/api.html)
- Vant 4 文档：[https://vant-ui.github.io/vant/v4/](https://vant-ui.github.io/vant/v4/)
- Tailwind CSS 4 文档：[https://tailwindcss.com/docs/installation/using-vite](https://tailwindcss.com/docs/installation/using-vite)
- Biome 文档：[https://biomejs.dev/](https://biomejs.dev/)
- artplayer 文档：[https://artplayer.org/](https://artplayer.org/)
- Capacitor 文档：[https://capacitorjs.com/](https://capacitorjs.com/)

---

## 19. 最终决策（v1.0-final）

> 本节替代原"§19 待您确认的 5 个点"，所有问题已在 2026-06-13 答复并落地到对应章节。

| # | 问题 | 决策 | 落地位置 |
| - | --- | --- | --- |
| 1 | 路由守卫跳转 | `router.replace`（避免返回栈污染） | §4.1 / §10.2 |
| 2 | 5 天清理基准 | **滑动窗口**：`now - lastAccessTime > 5×24h` 即过期 | §3.2 / §4.5 / §6.1 |
| 3 | 分页参数 `pageSize` | 暴露在视频源编辑表单（Vant Stepper，默认 20，1-100） | §6.4 / §7.2 |
| 4 | 多源时选中策略 | 优先 `activeSourceId`（持久化）；缺失时按 `order` 最小回退 | §3.3 / §4.1.1 / §6.1 |
| 5 | 图片预览 | **单图**（Vant ImagePreview 包装，双指缩放 + 单击关闭） | §11.4 |

### 19.1 5 天清理的"滑动窗口"实现细节

- 启动时：清理 `now - item.lastAccessTime > 5 * 24 * 60 * 60 * 1000` 的项。
- 写入时：每次搜索/播放都更新对应项的 `lastAccessTime`（不止首次创建时）。
- 删除策略：**物理删除**（不标记"已过期"）。
- 范围：仅 `searchHistory` 与 `history` 两类数据；`favorites` 不过期。

### 19.2 activeSourceId 持久化

- 存储位置：`localStorage['hplayer:activeSourceId']`（与 §6.1 一致）。
- 写入时机：
  - 首次添加源后自动写入。
  - 用户在 `SourcePicker` 切换源时写入。
- 失效时机（读时校验 + 写时清理）：
  - `removeSource(id)`：若 `id === activeSourceId`，先回退到新候选再写入。
  - 启动时若 `activeSourceId` 对应的源不存在或 `enabled === false`，按 §4.1.1 流程回退。

---

## 20. 下一步

v1.0 设计已完成。在开始 V1.0 MVP 脚手架前，请确认：

1. 是否同意按当前文档进入 **V1.0 MVP 脚手架初始化**（pnpm workspace + Vite + Vue 3 + Vant 4 + Tailwind 4 + Biome + 完整目录骨架 + 可在浏览器跑通的 demo 页面）？
2. 脚手架初始化时是否使用 **web-dev** 技能？该技能可保证 UI 风格与 Vant 4 移动端规范一致。

确认后我会按 §15 / §16 的目录与里程碑顺序输出代码骨架。
