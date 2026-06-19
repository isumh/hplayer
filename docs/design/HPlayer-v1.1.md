# HPlayer v1.1 增强设计文档

> 文档版本：v1.1-design
> 编写日期：2026-06-18
> 前置参考：[HPlayer-v1.md](./HPlayer-v1.md)
> 状态：completed，P7 V1.1 全部完成

## 0. 文档定位

本文件是 HPlayer **v1.1 增强版** 的设计定稿，基于 V1.0 MVP（[`HPlayer-v1.md`](file:///workspace/hplayer/docs/design/HPlayer-v1.md)）已交付功能，明确 V1.1 的：

- 目标与范围
- 新增/修改的模块、组件、页面
- 数据模型与接口变化
- 测试策略
- 里程碑与风险

## 1. 目标

V1.1 在 V1.0 MVP 基础上做**非破坏性增强**，核心目标：

1. **源适配更完整**：补齐 T0_XML 适配器，支持苹果 CMS XML 协议源。
2. **核心覆盖更足**：把 `core` 包中未覆盖的 store（favorite / player / preview / settings）补到单元测试。
3. **大列表更流畅**：聚合搜索结果在结果量大时启用虚拟列表。
4. **关键路径可回归**：用 Playwright E2E 覆盖「首次启动 → 添加源 → 首页 → 详情 → 播放」核心链路。

## 2. 范围

### 2.1 包含

| # | 功能 | 落点 |
| --- | --- | --- |
| 1 | T0_XML 适配器完整实现 | `packages/core/src/adapter/t0-xml.ts` |
| 2 | core store 补单元测试 | `packages/core/src/store/favorite.test.ts` / `player.test.ts` / `preview.test.ts` / `settings.test.ts` |
| 3 | 聚合搜索结果虚拟列表 | `packages/views/src/search/index.vue` + `packages/ui/src/business/SearchResultList.vue`（新增） |
| 4 | Playwright E2E 核心链路 | `e2e/`（新增目录） |

### 2.2 不包含（V1.1 不做）

- 视频源 JSON 配置文件导入/导出
- 视频源 / 分类长按拖拽排序
- V2.0 Capacitor 迁移
- 直播 / IPTV / EPG
- 用户登录、云端同步

## 3. 技术选型

| 类别 | 选型 | 版本 | 说明 |
| --- | --- | --- | --- |
| XML 解析 | `fast-xml-parser` | ^5.x | 浏览器 + Node 双环境可用 |
| 虚拟列表 | `vue-virtual-scroller` | ^2.x | Vue 3 兼容 |
| E2E | MCP Playwright | 1.57.0 | 通过 IDE MCP 工具执行无头 Chromium；传统 Playwright test runner 暂不使用 |

## 4. T0_XML 适配器

### 4.1 协议说明

苹果 CMS V10 XML 协议基础 URL：`{baseUrl}?ac=videolist&t=1&pg=1&pagesize=20&wd=...&ids=...`

XML 返回示例：

```xml
<?xml version="1.0" encoding="utf-8"?>
<rss version="5.1">
  <list page="1" pagecount="10" recordcount="200">
    <video>
      <id>123</id>
      <name>示例影片</name>
      <pic>https://x.com/a.jpg</pic>
      <type>剧情</type>
      <year>2024</year>
      <area>大陆</area>
      <actor>演员A</actor>
      <director>导演B</director>
      <des>剧情简介...</des>
      <note>更新至 12 集</note>
      <dl>
        <dd flag="线路1">第1集$https://x.com/1.m3u8#第2集$https://x.com/2.m3u8</dd>
      </dl>
    </video>
  </list>
  <class>
    <ty id="1">电影</ty>
    <ty id="2">电视剧</ty>
  </class>
</rss>
```

### 4.2 字段映射

| XML 字段 | VodItem 字段 | 说明 |
| --- | --- | --- |
| `id` | `id` | 转 string |
| `name` | `name` | — |
| `pic` | `pic` | — |
| `type` | `type` | 分类名称 |
| `year` | `year` | — |
| `area` | `area` | — |
| `actor` | `actor` | — |
| `director` | `director` | — |
| `des` | `desc` | — |
| `note` | `remarks` | — |

### 4.3 选集解析

`<dl>/<dd>` 结构：

- `flag` 属性 = 线路名
- `dd` text = 按 `#` 拆分，每段按 `$` 拆 `name$url`

解析结果：

```ts
{
  playFrom: [{ name: '线路1' }],
  playList: {
    '线路1': [
      { name: '第1集', url: 'https://x.com/1.m3u8' },
      { name: '第2集', url: 'https://x.com/2.m3u8' },
    ],
  },
}
```

### 4.4 接口实现

`T0XmlAdapter` 实现 `CmsAdapter` 接口，行为与 `T1JsonAdapter` 对齐：

- `init(config)`：缓存 baseUrl、pageSize
- `getCategories()`：请求 `ac=list`，解析 `<class>/<ty>`
- `getList({ categoryId, page, pageSize })`：请求 `ac=videolist&t=&pg=&pagesize=`
- `getDetail(id)`：请求 `ac=videolist&ids=`
- `search({ keyword, page, pageSize })`：请求 `ac=videolist&wd=`

### 4.5 错误处理

- XML 解析失败：返回空列表 / 抛出可识别错误，外层 Toast 提示。
- 字段缺失：用 `??` 兜底，不阻塞整体列表。

## 5. core store 补单元测试

### 5.1 待补测 store

| Store | 文件 | 测试重点 |
| --- | --- | --- |
| `useFavoriteStore` | `favorite.test.ts` | add / remove / toggle / 持久化 / 去重 |
| `usePlayerStore` | `player.test.ts` | setCurrent / clear / progress 同步 |
| `usePreviewStore` | `preview.test.ts` | open / close / 图片列表管理 |
| `useSettingsStore` | `settings.test.ts` | theme 切换 / deviceType 切换触发 UAPool.reset / 持久化 |

### 5.2 测试策略

- 每个 store 独立创建 pinia 实例，避免单例污染。
- `localStorage` 用 `vi.stubGlobal('localStorage', ...)` 或 `Storage` mock。
- `settings.test.ts` 需 mock `../api/ua-pool` 的 `setDeviceType`，验证调用。

## 6. 聚合搜索结果虚拟列表

### 6.1 触发条件

当聚合搜索结果总条数超过阈值 `VIRTUAL_LIST_THRESHOLD = 100` 时启用虚拟列表；低于阈值时保持现有 Vant List + Grid 渲染。

### 6.2 组件设计

新增 `packages/ui/src/business/SearchResultList.vue`：

```text
props:
  - items: VodItem[]
  - loading: boolean
  - finished: boolean
  - enableVirtual: boolean (items.length > 100)
  - onLoad: () => Promise<void>
  - onItemClick: (item: VodItem) => void

内部:
  - enableVirtual === false → 复用现有 Vant List + Grid
  - enableVirtual === true → 使用 vue-virtual-scroller 的 <RecycleScroller>
    - item-size 固定高度（卡片高度 + gap）
    - 列表项用 VodCard
```

### 6.3 与现有搜索页集成

`packages/views/src/search/index.vue` 中：

- 聚合模式结果合并后，当 `mergedItems.length > VIRTUAL_LIST_THRESHOLD` 时传 `enableVirtual`。
- 当前源模式结果通常 < 100，不启用虚拟列表。
- 上滑加载逻辑保持 `onLoad`，虚拟列表内部通过 `page++` 触发。

### 6.4 性能预期

- 1000 条结果下，DOM 节点从 ~300 个降至 ~20 个。
- 首次渲染时间 < 100ms（M3 Mac / Chrome）。

## 7. Playwright E2E 核心链路

### 7.1 目录结构

```text
e2e/
└── mock-t0-server.mjs          # 本地 T0_XML Mock 服务
```

> 说明：V1.1 不引入传统 Playwright test runner 与 spec 文件，E2E 验证通过 IDE 内置 MCP Playwright 工具完成。

### 7.2 测试场景

通过 MCP Playwright 手动/半自动执行以下场景：

```text
1. 准备测试源
   → 启动本地 mock T0_XML 服务（node e2e/mock-t0-server.mjs，端口 8787）
   → 使用 MCP Playwright 注入 localStorage：hplayer:sources + hplayer:activeSourceId

2. 首页加载
   → 刷新 /home
   → 分类栏渲染出 Mock 分类
   → 视频网格出现至少 1 张卡片

3. 详情页
   → 点击视频卡片详情按钮
   → /detail/:id 渲染
   → 剧情简介已 stripHtml

4. 播放页
   → 点击选集
   → /player/:id 渲染
   → video 元素存在 / ArtPlayer 实例初始化
```

### 7.3 Mock 源

E2E 不依赖真实 CMS，使用本地 Node.js HTTP 服务 `e2e/mock-t0-server.mjs`：

- `?ac=list` 返回分类 XML
- `?ac=videolist` 返回视频列表 XML
- `?ac=videolist&ids=xxx` 返回详情 XML（含 `<dl>/<dd>` 选集）

### 7.4 环境配置

- Playwright 固定为 `1.57.0`，对应 Chromium build `1200`，可从国内镜像 `https://registry.npmmirror.com/-/binary/playwright/builds/chromium/1200/` 快速下载。
- MCP Playwright 使用 Chromium 无头模式，viewport 默认 1280×720。
- 安装脚本（已执行）：
  ```bash
  pnpm add -D -w @playwright/test@1.57.0 playwright@1.57.0
  # Chromium build 1200 手动解压到 ~/.cache/ms-playwright/{chromium,chromium_headless_shell}-1200
  ```

## 8. 数据模型变化

V1.1 不新增持久化类型，仅扩展：

- `SourceType` 仍为 `'t0_xml' | 't1_json'`（T0_XML 已在 V1.0 占位）。
- `VideoSource` 等类型不变。
- 新增常量 `VIRTUAL_LIST_THRESHOLD = 100`。

## 9. 页面与组件变化

### 9.1 新增文件

| 文件 | 说明 |
| --- | --- |
| `packages/core/src/adapter/t0-xml.test.ts` | T0_XML 单元/集成测试 |
| `packages/core/src/store/favorite.test.ts` | favorite store 测试 |
| `packages/core/src/store/player.test.ts` | player store 测试 |
| `packages/core/src/store/preview.test.ts` | preview store 测试 |
| `packages/core/src/store/settings.test.ts` | settings store 测试 |
| `packages/ui/src/business/SearchResultList.vue` | 虚拟列表封装 |
| `e2e/playwright.config.ts` | Playwright 配置 |
| `e2e/tests/core-flow.spec.ts` | E2E 核心链路 |
| `e2e/fixtures/mock-source.json` | Mock 源配置 |

### 9.2 修改文件

| 文件 | 修改内容 |
| --- | --- |
| `packages/core/src/adapter/t0-xml.ts` | 占位实现 → 完整 XML 适配器 |
| `packages/core/src/adapter/index.ts` | 确认 T0XmlAdapter 导出 |
| `packages/core/src/index.ts` | 如需要，导出新增测试相关工具 |
| `packages/views/src/search/index.vue` | 接入 SearchResultList |
| `packages/ui/src/index.ts` | 导出 SearchResultList |
| `package.json` | 新增 e2e 脚本、playwright devDependency |
| `biome.json` | 如需要，排除 `e2e/` 中测试文件 |

## 10. 测试策略

### 10.1 单元/集成测试

| 范围 | 目标 |
| --- | --- |
| `t0-xml.test.ts` | 覆盖分类、列表、详情、搜索、错误解析 |
| `favorite.test.ts` | add/toggle/remove/去重/持久化 |
| `player.test.ts` | setCurrent/clear/progress |
| `preview.test.ts` | open/close/图片索引 |
| `settings.test.ts` | theme/deviceType/持久化/UA 池联动 |

### 10.2 覆盖率目标

- core 包覆盖率从 **78.43%** 提升到 **≥ 90%**。
- T0_XML 适配器自身覆盖率 ≥ 80%。

### 10.3 E2E 测试

- 核心链路 1 个 spec 文件，5 个场景，全部通过。
- CI 中 `pnpm e2e:ci` 返回 0。

## 11. 项目结构变化

```text
hplayer/
├── e2e/                              # 新增
│   └── mock-t0-server.mjs             # T0_XML Mock 服务
├── packages/
│   ├── core/src/
│   │   ├── adapter/
│   │   │   ├── t0-xml.ts              # 完整实现
│   │   │   └── t0-xml.test.ts         # 新增
│   │   └── store/
│   │       ├── favorite.test.ts       # 新增
│   │       ├── player.test.ts         # 新增
│   │       ├── preview.test.ts        # 新增
│   │       └── settings.test.ts       # 新增
│   ├── ui/src/business/
│   │   └── SearchResultList.vue       # 新增
│   └── views/src/search/
│       └── index.vue                  # 接入 SearchResultList
├── package.json                       # playwright 1.57.0 devDependency
└── biome.json                         # 如需要，调整 includes
```

## 12. 里程碑

### 批次 1：数据与测试层

- [x] Task 1.1：引入 `fast-xml-parser`，实现 `T0XmlAdapter`
- [x] Task 1.2：`t0-xml.test.ts` 单元/集成测试通过
- [x] Task 1.3：补 `favorite.test.ts`
- [x] Task 1.4：补 `player.test.ts`
- [x] Task 1.5：补 `preview.test.ts`
- [x] Task 1.6：补 `settings.test.ts`
- [x] Task 1.7：覆盖率复核（目标 ≥ 90%）
- [x] Task 1.8：commit

### 批次 2：交互与 E2E 层

- [x] Task 2.1：安装 `vue-virtual-scroller`
- [x] Task 2.2：实现 `SearchResultList.vue`
- [x] Task 2.3：`search/index.vue` 接入虚拟列表
- [x] Task 2.4：安装 Playwright 1.57.0，创建 `e2e/mock-t0-server.mjs`
- [x] Task 2.5：通过 MCP Playwright 注入测试源（localStorage）
- [x] Task 2.6：通过 MCP Playwright 执行 core-flow 验证
- [x] Task 2.7：E2E 本地通过，文档更新为 MCP 方案
- [x] Task 2.8：commit

## 13. 风险与对冲

| 风险 | 对冲 |
| --- | --- |
| `fast-xml-parser` 解析某些 CMS XML 字段大小写不一致 | 配置 `ignoreAttributes: false` + 字段别名映射 + 兜底 |
| 虚拟列表与 Vant PullRefresh/List 手势冲突 | 虚拟列表模式下关闭 Vant List，仅保留上滑触底加载 |
| Playwright 在沙箱环境无法启动 Chromium | CI 使用 `--no-sandbox`，本地用 `e2e:ui` |
| store 测试污染全局 localStorage | 每个测试独立创建 pinia + 清理 localStorage |
| 覆盖率提升不及预期 | 优先保证新增代码 ≥ 80%，旧代码逐步补测 |

## 14. 下一步

根据 [`08-phase-7-v1.1.md`](../dev-plans/08-phase-7-v1.1.md) 的开发计划，按批次执行 Task 1.1–1.8，再执行 Task 2.1–2.8。
