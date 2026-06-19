# 代码简化重构记录

> 日期：2026-06-19
> 范围：整个 hplayer 项目源码（packages/、apps/、e2e/）
> 目标：在保持功能、页面结构、布局、流程、数据结构不变的前提下，提升代码清晰度与可维护性
> 验证：`pnpm lint`、`pnpm type-check`、`pnpm test` 全部通过

---

## 1. 变更概览

本次重构以「消除重复、减少嵌套、显式命名」为核心，未引入任何新依赖，未修改业务逻辑与数据类型。

共涉及 **12 个文件**，净减少 **5 行代码**（删除 83 行，新增 78 行）。

---

## 2. 按包变更说明

### 2.1 packages/core

#### `packages/core/src/adapter/index.ts`

- **问题**：`clearAdapterCache(sourceId?)` 两个分支都调用了 `cache.clear()`，`sourceId` 参数形同虚设。
- **改动**：当传入 `sourceId` 时调用 `cache.delete(sourceId)`，否则全量清空。
- **影响**：修复了按源清理缓存的语义；调用方无感知（原调用均不传参）。

#### `packages/core/src/utils/lru.ts`

- **改动**：新增 `delete(key)` 方法，支撑 `clearAdapterCache` 按 key 清理。
- **影响**：仅新增 API，无现有行为变更。

#### `packages/core/src/store/history.ts`

- **问题**：`touch()` 中历史记录去重 key 的拼接逻辑重复出现两次。
- **改动**：提取顶层辅助函数 `historyKey(item)`。
- **影响**：去重规则统一，后续若调整 key 结构只需改一处。

#### `packages/core/src/store/player.ts`

- **问题**：`current` ref 与 `setCurrent` 的参数类型完全相同，却以匿名内联类型重复书写。
- **改动**：提取 `PlayerPayload` 接口复用。
- **影响**：类型定义集中，便于后续扩展（如 Android 2.0 新增播放状态字段）。

#### `packages/core/src/api/client.ts`

- **问题**：拦截器内直接写死电影天堂域名，且 `import.meta.env` 类型断言散落在条件中。
- **改动**：
  - 提取常量 `DYTT_PROXY_TARGET`、`DYTT_PROXY_PATH`。
  - 提取 `isDevEnv()` 辅助函数。
- **影响**：代理目标更清晰；开发/生产判断逻辑可复用。

### 2.2 packages/ui

#### `packages/ui/src/business/VodList.vue`

- **问题**：`onLoad / onRefresh / onSelect / onPlay` 四个函数均为纯透传，无额外逻辑。
- **改动**：删除透传函数，模板中直接使用 `$emit(...)`。
- **影响**：组件代码更短，`defineEmits` 仍为事件提供类型声明。

#### `packages/ui/src/business/SearchResultList.vue`

- **问题**：同上，存在纯透传函数。
- **改动**：仅保留带守卫逻辑的 `onLoad()`，其余事件改为模板直接 `$emit(...)`。
- **影响**：保持虚拟列表加载守卫的同时减少冗余代码。

### 2.3 packages/views

#### `packages/views/src/player/index.vue`

- **问题**：
  - 倍速校验使用 `(RATES as readonly number[]).includes(savedRate)` 并伴随多次 `as Rate` 强制转换。
  - `cur.vod as VodDetail` 类型断言在 `onMounted` 与 `watch` 中重复出现，但 `vod` 实际仅需 `VodItem` 中的 `name`/`pic`。
  - `getEp()` 辅助函数在 `onMounted` 中仅使用一次。
- **改动**：
  - 新增类型守卫 `isRate(value): value is Rate`。
  - 移除 `VodDetail` 相关导入与断言，直接使用 `cur.vod`。
  - 删除 `getEp()`，内联获取当前 episode。
- **影响**：类型更安全，代码更短；播放页功能不变。

#### `packages/views/src/search/index.vue`

- **问题**：模板中两处 `sourceStore.activeSource?.name` 三元表达式重复且冗长。
- **改动**：提取 `sourceName` 计算属性。
- **影响**：模板表达式更简洁，搜索栏与结果列表共用同一来源名逻辑。

#### `packages/views/src/home/index.vue`

- **问题**：`activeCategoryId.value === null || activeCategoryId.value === undefined` 过于冗长。
- **改动**：改为 `activeCategoryId.value == null`。
- **影响**：语义不变，覆盖 `null` 与 `undefined`。

#### `packages/views/src/settings/index.vue`

- **问题**：`setDevice` 中存在嵌套三元表达式生成设备中文名。
- **改动**：拆分为 `deviceLabel(device)` 函数，使用 if/else 链。
- **影响**：符合项目避免嵌套三元的规范，可读性提升。

#### `packages/views/src/settings/source-form.vue`

- **问题**：`sourceId` computed 使用 `(route.params.id as string | undefined) ?? undefined`，`?? undefined` 冗余。
- **改动**：简化为 `route.params.id as string | undefined`。
- **影响**：行为相同，更简洁。

---

## 3. Android 2.0 适配注意事项

当前 hplayer 为 Web Mobile 应用，V2.0 计划通过 Capacitor 打包为 Android 应用。本次简化重构在以下方面为后续迁移保留了便利：

### 3.1 持久化抽象层

- `packages/core/src/utils/storage.ts` 仍然是唯一的 localStorage 访问点。
- V2.0 迁移时，只需替换 `storage.get / set / remove / clearAll` 为 Capacitor Preferences / SQLite 实现，所有 store（`source.ts`、`history.ts`、`favorite.ts` 等）无需改动。

### 3.2 网络请求抽象

- `packages/core/src/api/client.ts` 是唯一 Axios 实例创建点。
- Android 2.0 若需绕过 WebView CORS，可在此统一注入 Capacitor HTTP plugin 或原生请求客户端；`adapterProxy` 与各 adapter 不感知底层实现。

### 3.3 适配器与源管理

- 适配器通过 `adapterProxy` 访问，内部使用 `getAdapter(source)` 缓存实例。
- `clearAdapterCache(sourceId?)` 修复后支持按源清理，未来在多源切换或源编辑后刷新场景更可控。

### 3.4 播放页类型安全

- `player.ts` 提取的 `PlayerPayload` 是播放会话的唯一数据结构。
- V2.0 若需新增「后台播放状态」「投屏状态」等字段，只需扩展 `PlayerPayload`，视图与 store 的改动点集中。

### 3.5 未引入破坏性变更

- 所有组件 props、emit 事件、页面路由、数据类型保持不变。
- 本次重构未修改 `tailwind.css`、`vant-theme.css`、`vite.config.ts` 等构建/样式配置。

---

## 4. 验证结果

```bash
pnpm lint        # ✅ 通过，自动修复 1 处格式
pnpm type-check  # ✅ 5/5 packages 通过
pnpm test        # ✅ 23 个测试文件，135 个测试全部通过
```

---

## 5. 未处理项（后续可选）

以下代码存在重复，但属于跨页面/跨组件的通用逻辑，若后续决定抽象再统一处理：

- `favorite/index.vue` 与 `history/index.vue` 的 SwipeCell 互斥关闭逻辑（`bindRef`、`isInsideAnyCell`、`closeAllCells`、`onDocClick`）。
- `favorite/index.vue` 与 `history/index.vue` 的 `fmtTime` 时间格式化函数。

若 V2.0 中这些页面继续存在且重复逻辑增加，建议抽取为：
- `packages/views/src/composables/use-swipe-cell-group.ts`
- `packages/core/src/utils/format-time.ts`
