# Phase 7: V1.1 增强

> 对应设计文档：[docs/design/HPlayer-v1.1.md](../design/HPlayer-v1.1.md)
>
> **目标**：在 V1.0 MVP 基础上做非破坏性增强，分两个批次完成。

## 状态

- [x] pending
- [x] in_progress
- [ ] completed

## 依赖

- V1.0 MVP 全部完成（P0–P6）。
- `packages/core`、`packages/ui`、`packages/views` 已稳定。

## 阶段目标

1. **批次 1（数据/测试层）**：
   - T0_XML 适配器完整实现并补测试。
   - 补齐 `core` 包未覆盖 store 的单元测试（favorite / player / preview / settings）。
   - core 包覆盖率 ≥ 90%。

2. **批次 2（交互/E2E 层）**：
   - 聚合搜索结果超过阈值时启用 `vue-virtual-scroller` 虚拟列表。
   - 引入 Playwright，覆盖「首次启动 → 添加源 → 首页 → 详情 → 播放」核心链路。

## 范围确认

**包含**：T0_XML、core store 补测、聚合搜索虚拟列表、Playwright E2E。

**不包含**：JSON 源导入、拖拽排序、V2.0 Capacitor、直播/IPTV/登录/云端。

## 中断恢复说明

- 16 个 task 按批次顺序执行。
- **恢复点**：`STATE.md` 中 `[P7-1]` / `[P7-2]` 行的 `last_task` 字段（格式 `Task X.Y`）。
- 批次 1 全部完成后方可进入批次 2。

---

## Agent P7-1: T0_XML + core store 补测

**Own Files:**
- Create: `packages/core/src/adapter/t0-xml.test.ts`
- Create: `packages/core/src/store/favorite.test.ts`
- Create: `packages/core/src/store/player.test.ts`
- Create: `packages/core/src/store/preview.test.ts`
- Create: `packages/core/src/store/settings.test.ts`
- Modify: `packages/core/src/adapter/t0-xml.ts`
- Modify: `packages/core/src/adapter/index.ts`
- Modify: `packages/core/src/index.ts`（按需导出）
- Modify: `package.json`（新增 `fast-xml-parser` dependency）

---

- [ ] **Task 1.1: 安装 fast-xml-parser 并实现 T0XmlAdapter**

安装 `fast-xml-parser` 到 `packages/core`：

```bash
pnpm --filter @hplayer/core add fast-xml-parser
```

实现 `packages/core/src/adapter/t0-xml.ts`：

- `init(config)`：缓存 baseUrl、pageSize。
- `getCategories()`：请求 `ac=list`，解析 `<rss><class><ty id="...">...</ty></class>`。
- `getList({ categoryId, page, pageSize })`：请求 `ac=videolist&t=&pg=&pagesize=`。
- `getDetail(id)`：请求 `ac=videolist&ids=`。
- `search({ keyword, page, pageSize })`：请求 `ac=videolist&wd=`。
- 私有 `mapItem(xmlVideo)`：按 [HPlayer-v1.1.md §4.2](../design/HPlayer-v1.1.md) 字段映射。
- 私有 `parsePlayLists(dl)`：解析 `<dl><dd flag="...">...</dd></dl>`。

验证：`pnpm type-check` 通过。

---

- [ ] **Task 1.2: T0_XML 测试**

创建 `packages/core/src/adapter/t0-xml.test.ts`：

- mock `../api/client` 的 `http.get`。
- 测试分类解析（`<class>/<ty>`）。
- 测试列表解析（`<list pagecount recordcount><video>...</video></list>`）。
- 测试详情解析（含 `<dl>/<dd>` 选集）。
- 测试搜索解析。
- 测试字段缺失时的兜底行为。
- 测试 XML 解析失败时的错误处理。

验证：`pnpm test -- packages/core/src/adapter/t0-xml.test.ts` 通过。

---

- [ ] **Task 1.3: favorite store 单元测试**

创建 `packages/core/src/store/favorite.test.ts`：

- 初始化 pinia + mock localStorage。
- 测试 `add(item)`：新增收藏。
- 测试 `add(item)` 重复：相同 `id+sourceId` 不重复添加。
- 测试 `remove(id)`。
- 测试 `toggle(item)`：未收藏则添加，已收藏则移除。
- 测试持久化：操作后 `localStorage['hplayer:favorites']` 更新。

---

- [ ] **Task 1.4: player store 单元测试**

创建 `packages/core/src/store/player.test.ts`：

- 测试 `setCurrent(current)`。
- 测试 `clear()`。
- 测试 `updateProgress(progress)` 同步到 current。
- 验证 store 不持久化（无 localStorage 写入）。

---

- [ ] **Task 1.5: preview store 单元测试**

创建 `packages/core/src/store/preview.test.ts`：

- 测试 `open(images, startIndex)`。
- 测试 `close()`。
- 测试 `next()` / `prev()` 索引边界。
- 验证不持久化。

---

- [ ] **Task 1.6: settings store 单元测试**

创建 `packages/core/src/store/settings.test.ts`：

- mock `../api/ua-pool` 的 `setDeviceType`。
- 测试 `setTheme(theme)` 持久化。
- 测试 `setDeviceType(device)` 持久化 + 调用 `setDeviceType(device)`。
- 测试初始值从 localStorage 恢复。

---

- [ ] **Task 1.7: 覆盖率复核**

运行：

```bash
pnpm test --coverage
```

目标：
- core 包覆盖率 ≥ 90%。
- T0_XML 适配器自身覆盖率 ≥ 80%。

若未达标：分析 `coverage/` 报告，补充测试用例。

---

- [ ] **Task 1.8: commit 批次 1**

```bash
git add .
git commit -m "feat(P7-1): T0_XML adapter + core store unit tests (coverage >= 90%)"
```

---

## Agent P7-2: 聚合搜索虚拟列表 + Playwright E2E

**Own Files:**
- Create: `packages/ui/src/business/SearchResultList.vue`
- Create: `e2e/playwright.config.ts`
- Create: `e2e/fixtures/mock-source.json`
- Create: `e2e/tests/core-flow.spec.ts`
- Create: `e2e/utils/source-helper.ts`
- Modify: `packages/views/src/search/index.vue`
- Modify: `packages/ui/src/index.ts`
- Modify: `package.json`（新增 e2e 脚本、playwright devDependency、vue-virtual-scroller dependency）
- Modify: `biome.json`（如需要，排除 `e2e/` 测试文件）

---

- [ ] **Task 2.1: 安装 vue-virtual-scroller**

```bash
pnpm --filter @hplayer/ui add vue-virtual-scroller
```

确认 Vue 3 兼容版本。

---

- [ ] **Task 2.2: 实现 SearchResultList.vue**

创建 `packages/ui/src/business/SearchResultList.vue`：

- props：`items`、`loading`、`finished`、`enableVirtual`、`onLoad`、`onItemClick`。
- `enableVirtual === false`：使用现有 `VodList`（Vant List + Grid）。
- `enableVirtual === true`：使用 `<RecycleScroller>`，item-size 固定，列表项用 `VodCard`。
- 虚拟列表模式下保留上滑触底加载（通过 `page++` 触发 `onLoad`）。

验证：`pnpm type-check` 通过。

---

- [ ] **Task 2.3: 搜索页接入虚拟列表**

修改 `packages/views/src/search/index.vue`：

- 聚合模式合并结果后，当 `mergedItems.length > VIRTUAL_LIST_THRESHOLD`（100）时启用虚拟列表。
- 当前源模式保持原逻辑。
- 导出 `SearchResultList` 在 `packages/ui/src/index.ts`。

验证：
- `pnpm type-check` 通过。
- 首页/搜索页手动预览无异常。

---

- [x] **Task 2.4: 安装 Playwright 1.57.0 并创建 E2E mock 服务**

> 本机为 x86_64 Linux，npmmirror 上 Playwright 1.61 所需 Chromium build 1228 仅有 arm64，无法快速安装。降级到 Playwright 1.57.0（Chromium build 1200），该版本在镜像上有完整 linux64 包，可秒级下载。

```bash
pnpm add -D -w @playwright/test@1.57.0 playwright@1.57.0
# 手动从 https://registry.npmmirror.com/-/binary/playwright/builds/chromium/1200/
# 下载 chromium-linux.zip 与 chromium-headless-shell-linux.zip
# 解压到 ~/.cache/ms-playwright/{chromium,chromium_headless_shell}-1200
```

创建 `e2e/mock-t0-server.mjs`：

- 本地 HTTP 服务，端口 8787。
- 提供 `?ac=list`、`?ac=videolist`、`?ac=videolist&ids=` 三个 T0_XML 端点。

---

- [x] **Task 2.5: 通过 MCP Playwright 准备测试源（localStorage 注入）**

不再编写传统 Playwright spec，改用 IDE 内置 MCP Playwright 工具：

1. 启动 `pnpm dev` 与 `node e2e/mock-t0-server.mjs`。
2. `playwright_navigate` 到 `http://localhost:5174/`。
3. `playwright_evaluate` 注入：
   - `localStorage.setItem('hplayer:sources', JSON.stringify([mockSource]))`
   - `localStorage.setItem('hplayer:activeSourceId', JSON.stringify(mockSource.id))`
4. 刷新页面使应用读取注入的源。

---

- [x] **Task 2.6: 通过 MCP Playwright 执行 core-flow 验证**

验证步骤：

1. 首页 `/home` 渲染分类栏与视频卡片。
2. 点击 `.vod-card .detail-btn` 进入 `/detail/:id`。
3. 详情页展示影片信息、剧情简介、线路与选集。
4. 点击 `.ep-btn` 进入 `/player/:id`。
5. 播放页 ArtPlayer 初始化，video 元素存在，video url 正确。

---

- [x] **Task 2.7: 验证通过 + 更新设计/计划文档为 MCP 方案**

- 已确认 core-flow 在本地通过 MCP Playwright 跑通。
- 已更新 `docs/design/HPlayer-v1.1.md` §7 E2E 章节为 MCP 方案。
- 已更新本文档 Task 2.4–2.7 为完成状态。

---

- [ ] **Task 2.8: commit 批次 2**

```bash
git add .
git commit -m "feat(P7-2): virtual scroller + MCP Playwright E2E core flow (playwright@1.57.0)"
```

---

## 阶段完成判定

| 检查项 | 标准 |
| --- | --- |
| `pnpm type-check` | 5/5 packages 通过 |
| `pnpm test --coverage` | core 包覆盖率 ≥ 90% |
| `pnpm lint` | 0 errors（warnings 数量不增加） |
| `pnpm build` | 产物构建成功 |
| MCP Playwright core-flow | 首页 → 详情 → 播放 手动验证通过 |

---

## 变更记录

| 版本 | 日期 | 变更 |
| --- | --- | --- |
| v1.0 | 2026-06-18 | 初始计划：16 task，分两个批次 |
