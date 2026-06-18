# STATE — hplayer V1.0 MVP 执行进度

> **主 agent 维护**：每次 task 完成后立即更新本文件。
> **TRAE 恢复协议**：新会话开始时先读本文件，再加载 `current_phase` 对应的 phase 文档。

---

## 全局状态

| 字段 | 值 |
| --- | --- |
| `current_phase` | **done（V1.0 MVP 完成）** |
| `current_agent` | — |
| `last_completed_task` | P6-1:Task 6.6（最终 commit） |
| `last_commit_hash` | `33e5510` |
| `current_branch` | `feat/hplayer-v1.0-mvp` |
| `start_time` | 2026-06-17 |
| `last_update` | 2026-06-18（V1.0 MVP 收尾完成） |

---

## 阶段总览

| 阶段 | 状态 | 已完成 task | 失败 task | 最后 commit |
| --- | --- | --- | --- | --- |
| P0 工作区 + 构建 | completed | 23/23 | — | `24a71f2` |
| P1 Core + Stores | completed | 24/24 | — | `87bdb1f` |
| P2 CMS Adapter | completed | 8/8 | — | `9d4214c` |
| P3 UI 组件 | completed | 17/17 | — | `58bf2b4` |
| P4 页面 + 路由 | completed | 17/17 | — | `a8bd4ca` |
| P5 集成测试 | completed | 9/9 | — | `f251be4` |
| P6 质量门禁 | **completed** | **6/6** | — | `33e5510` |

**任务总数**：23 + 24 + 8 + 17 + 17 + 9 + 6 = **104 个 task** 全部完成。

**🎉 hplayer V1.0 MVP 实施完成**

---

## 并行 Agent 状态行（P1 / P3 / P4 阶段使用）

> 主 agent 在派发并行 subagent 前，必须先为每个 agent 创建独立状态行，格式：
> `- [P<phase>-<letter>] agent_id=<id> | status=pending/in_progress/completed/failed | last_task=<id> | commit=<hash>`

### P1（最多 2 并行）
- [P1-A] agent_id=inline-main | status=completed | last_task=1.16 | commit=cc9f50e
- [P1-B] agent_id=inline-main | status=completed | last_task=1.24 | commit=87bdb1f

### P2（单 agent）
- [P2-1] agent_id=inline-main | status=completed | last_task=2.8 | commit=9d4214c

### P3（最多 3 并行）
- [P3-A] agent_id=inline-main | status=completed | last_task=3.6 | commit=f7883f9  *(布局组件)*
- [P3-B] agent_id=inline-main | status=completed | last_task=3.10 | commit=76db1db  *(视频组件)*
- [P3-C] agent_id=inline-main | status=completed | last_task=3.17 | commit=58bf2b4  *(业务组件)*

### P4（最多 6 并行）
- [P4-A] agent_id=inline-main | status=completed | last_task=4.5 | commit=——  *(home 页)*
- [P4-B] agent_id=inline-main | status=completed | last_task=4.7 | commit=fd735a3  *(search 页)*
- [P4-C] agent_id=inline-main | status=completed | last_task=4.10 | commit=38c6a4f  *(settings 页)*
- [P4-D] agent_id=inline-main | status=completed | last_task=4.12 | commit=fe1f0a4  *(detail 页)*
- [P4-E] agent_id=inline-main | status=completed | last_task=4.15 | commit=48cdcbb  *(fav/hist 页)*
- [P4-F] agent_id=inline-main | status=completed | last_task=4.17 | commit=a8bd4ca  *(player 页)*

---

## 失败 / 阻塞任务

> 失败 task 在此记录。格式：
> `- [phase:task_id] 错误摘要 - 修复方案`

（暂无）

---

## 变更记录

> 计划执行期间如需调整（如新增 / 删除 / 拆分 task），在此追加并标注 date / phase / reason。

- **2026-06-17 / P0 / 计划修复**：
  1. **Step 16 App.vue 前向引用问题**：原计划在 P0 的 `App.vue` 中 `import { useHistoryStore, useSearchHistoryStore } from '@hplayer/core'`，但这些 store 在 P1 才创建。修复方式：将 import 注释为 `TODO(P1)`，在 P1 启用。
  2. **Step 15 main.ts 前向引用问题**：原计划 `import { router } from '@hplayer/router'`，但 `router` 在 P4 才创建。修复方式：同 1，注释为 `TODO(P4)`。
  3. **Step 20 顺序问题**：原计划先 `pnpm install` 再创建空 packages（Step 21），但 `apps/hplayer_web/package.json` 已引用 workspace 依赖。修复方式：调整顺序——先创建空 packages（Step 21）再 install（Step 20）。
  4. **依赖 peer 冲突**：`@vitejs/plugin-vue@5` 不支持 Vite 7；`pinia-plugin-persistedstate@4` 要求 Pinia 3。修复方式：plugin-vue 升到 `^6.0.0`、persistedstate 降到 `^3.2.0`（保持 Pinia 2 稳定线）。
  5. **Biome 规则冲突**：`env.d.ts` 中 Vite SFC shim 的 `{}` / `any` 触发 `noBannedTypes` / `noExplicitAny`；`tailwind.css` 的 `@theme` 触发 CSS parse error。修复方式：env.d.ts 加 `biome-ignore` 注释，biome.json 启用 `css.parser.tailwindDirectives`。
  6. **分支约定**：使用 `feat/hplayer-v1.0-mvp` 分支而非 `main`，遵循 executing-plans skill 的 "Never start on main without consent"。
  7. **pnpmlockfile**：沙箱默认 `--frozen-lockfile`，首次 install 前删除 `pnpm-lock.yaml` 即可。
8. **2026-06-17 / P1-A / 计划修复**：
   1. **vitest 启动失败**：`vite.config.ts` 在根目录被 vitest 加载，但 `@vitejs/plugin-vue` 只在 `apps/hplayer_web` 声明为 devDep。修复方式：把 `@vitejs/plugin-vue` 和 `jsdom` 提升到根 devDependencies（与 vitest 配置一致）。
   2. **Task 1.14 部分执行**：按计划字面"P1-A 仅完成到 Task 1.13 即可"会留下 index.ts 空白，P1-B 无法 import @hplayer/core。采用折中：P1-A 先在 index.ts 导出 types+utils+api，store/* 留待 P1-B 完成后追加，adapter/* 留待 P2 追加。
9. **2026-06-17 / P1-B / 计划修复**：
   1. **history.ts import 错误**：原计划 `import { STORAGE_KEYS, isExpired, storage } from '../utils/time'` 中 `STORAGE_KEYS` 和 `storage` 实际位于 `storage.ts`。修复方式：拆为两行 import——`storage` 系列从 `utils/storage`，`isExpired` 从 `utils/time`。
   2. **vitest 解析 'vue'/'pinia' 失败**：pnpm 隔离 node_modules 模式下，store 文件 `import 'vue'` 在根 vitest 视角下不可见。修复方式：`vue` + `pinia` 提升到根 devDependencies。
10. **2026-06-17 / P3 / 计划修复**：
    1. **vue-router 未声明**：`TabBar`/`NavBar`/`SourceForm` 都使用 `useRouter`/`useRoute`，但 `packages/ui/package.json` 缺少 `vue-router`。修复方式：在 `packages/ui` 依赖中新增 `vue-router@^4.4.0`。
    2. **`exactOptionalPropertyTypes` 冲突（5 处）**：
       - `AppHeader.vue`：`useSourceStore`/`activeSource` 未使用，触发 TS6133；`activeSource` computed 也未在模板用。修复方式：移除未使用的导入和变量。
       - `LoadingState.vue`：`Skeleton` 仅用于类型注册但被 TS6133 标记未用。修复方式：模板中改用 `<Skeleton>` 命名组件而非 `<van-skeleton>`，让 import 被实际使用。
       - `NavBar.vue`：`props` 未在模板使用触发 TS6133；`:title="title"` / `:left-arrow="showBack"` 在 `exactOptionalPropertyTypes` 下需处理 undefined。修复方式：移除 props 解构赋值，模板中改用 `?? ''` / `?? true` 提供默认值。
       - `VodList.vue`：`:source-name="sourceName"` 在 `exactOptionalPropertyTypes` 下不允许 undefined。修复方式：`?? ''` 提供默认空串（VodCard 内 `v-if` 处理空串）。
       - `SourceForm.vue`：`form.pageSize`/`form.remark` 在 Omit 类型下为可选，触发 TS2379。修复方式：模板中用 `as number`/`as string` 类型断言。
    3. **plan bug（已修正）**：
       - `CategoryBar.vue`：`import { ref } from 'vant'`（错误，应为 'vue'）。修复方式：改为 `import { ref } from 'vue'`。
       - `EpisodeList.vue`：第二个 `<script lang="ts">` 块中的 `ref` 未导出到 script setup 作用域。修复方式：合并为单个 `<script setup lang="ts">` 块。
       - `VodList.vue`：同上，`refreshing` 在非 setup script 块定义但模板引用。修复方式：移到 script setup 块。
    4. **SourcePicker 跨 agent 依赖**：P3-A 的 `AppHeader.vue` import `SourcePicker.vue`（P3-C）。修复方式：P3-A 阶段先创建 `SourcePicker.vue` 占位 stub（`<span class="source-picker-stub">SourcePicker</span>`），P3-C 阶段完整覆盖实现。
11. **2026-06-17 / P4 / 计划修复**：
    1. **`@hplayer/views` 缺少依赖**：search/detail/player 等页面需要 `vue-router`、`artplayer`、`hls.js`。修复方式：在 `packages/views/package.json` 补充这三个依赖。
    2. **router 包 `.vue` 解析失败**：`tsc` 不识别 `.vue` 导入。修复方式：新增 `packages/router/src/shims-vue.d.ts` 声明文件。
    3. **plan bug：TabLayout 导入名不一致**：plan 中 `TabLayout.vue` 写 `import { HPlayerTabBar }`，但 `ui/index.ts` 导出名是 `TabBar`。修复方式：TabLayout 改用 `import { TabBar }` 与 index.ts 保持一致。
    4. **`exactOptionalPropertyTypes` 冲突（5 处）**：
       - `search/index.vue`：`:source-name="mode === 'single' ? sourceStore.activeSource?.name : ''"` 在 `exactOptionalPropertyTypes` 下要求显式 `?? ''`。修复方式：模板表达式包一层 `?? ''`。
       - `detail/index.vue`：从 `@hplayer/ui` 导入的 `Cell`/`CellGroup` 实际未在 ui 包导出。修复方式：改从 `'vant'` 直接导入。
       - `favorite/index.vue` + `history/index.vue`：同理，从 `@hplayer/ui` 导入 `Button`/`Dialog` 未导出。修复方式：改从 `'vant'` 直接导入。
       - `source-form.vue`：`sourceId` 是 `string | undefined` 不能传给 `sourceId?: string` prop。修复方式：模板拆 `v-if` + `v-else` 两个分支分别传。
       - `player/index.vue`：`Artplayer` 的 `Option` 类型在 `exactOptionalPropertyTypes` 下要求每个可选字段实际存在（不能是 undefined）。修复方式：构造 `options: Record<string, unknown>` 兜底，HLS 分支条件添加 `options.type`。
    5. **player 类型联合问题**：`cur.episode` 在 `Omit<HistoryItem, ...>` 上下文是 `Episode | undefined`，不能直接传给 `Episode` 形参。修复方式：引入 `getEp(): Episode | null` guard 集中处理。
    6. **router 中 `route.params` 缺类型**：`route.params.id` 是 `string | string[]`。修复方式：显式 `as string`。
- **2026-06-17 / P4 / 用户驱动细化需求**（合入 a8bd4ca，未单独 commit）：
  1. **视频卡片视觉**：VodCard 名称加粗居中、单行省略、title tip；左上角详情/右上角播放图标按钮。
  2. **分类栏交互**：CategoryBar 去滚动条改左右拖动、加左右边距、首次默认选中第一个分类、点击切换刷新视频列表。
  3. **首页骨架屏**：首次加载与分类切换时显示 Skeleton（`VodGridSkeleton` + `CategoryBarSkeleton`）；上滑分页用 Toast loading 区分。
  4. **下拉刷新回收**：`VodList` 内部 `refreshing` 此前未在 props.loading 由 true→false 时复位，导致一直显示加载中。修复：新增 `watch(() => props.loading)`。
  5. **AppHeader 跳转修复**：`/favorite` / `/history` 按钮此前 useRouter.push 未生效（router 误为可选）。修复：补全调用。
  6. **NavBar 透传**：新增 `rightText` prop + `click-right` emit，使收藏/历史页清空按钮可调。
  7. **EmptyState 重构**：自建 emoji 占位改为 Vant `<van-empty>` 组件，并暴露 default slot 供调用方放置按钮。
  8. **详情页 HTML 剥除**：新增 `stripHtml()` 处理 `<p>`/`<br>` 与 HTML 实体（&nbsp; &amp; 等），剧情展示为纯文本。
  9. **图片预览增强**：`ImagePreview` 加 wheel 缩放 + 点击关闭 + 双指缩放。
  10. **收藏/历史 SwipeCell**：列表行改为 SwipeCell + Cell 组合；互斥关闭通过 `Map<id, SwipeCellInstance>` + document click 监听；点击主体跳转详情（历史页续播减 10s）。
  11. **清空确认**：清空按钮点击 → `showConfirmDialog` 二次确认（不再依赖命令式 Dialog 组件）。
  12. **清空按钮边框**：`NavBar` `rightText` 加 `:deep(.van-nav-bar__text)` 1px solid 边框 + padding 提升可点击性。
  13. **搜索模式重命名**：SearchBar 模式 `single` 文案改为 `当前源（${sourceName}）`；搜索页 `mode` 默认值改为 `single`。
  14. **设置页数据导入导出**：新增「数据管理」区块。导出用 Blob + URL.createObjectURL；导入用 FileReader + JSON.parse + storage.set(STORAGE_KEYS.sources/favorites/history)。格式 `hplayer-backup-YYYY-MM-DD.json`。
  15. **SourceForm 字段对调**：表单顺序由「名称 → 类型 → 接口地址 → …」改为「接口地址 → 名称 → 类型 → …」；提交校验顺序同步调整。
  16. **SourceForm 删除按钮**：仅编辑模式（`v-if="sourceId"`）显示红色「删除视频源」按钮，点击 → `showConfirmDialog` 二次确认 → `store.remove(id)` → Toast → 跳回 /settings。
  17. **桌面端 touch 适配**：`apps/hplayer_web/src/main.ts` 引入 `@vant/touch-emulator`，解决桌面浏览器 SwipeCell 不可拖动问题。
  18. **Vant CSS 引入**：`main.ts` 补 `import 'vant/lib/index.css'`。
- **2026-06-18 / P5 / 计划扩展**：
  1. **P5 task 数量由 4 扩展为 8**：原 4 task（adapter 集成 + sourceStore 集成 + 覆盖率 + commit）保留；新增 Task 5.5-5.7（设置页导入导出 / 详情页 stripHtml / SourceForm 删除流程数据层测试），与 Task 5.8 覆盖率复检 + Task 5.9 commit。理由：P4 之后用户驱动 12+ 细化需求中含数据层关键路径，原 4 task 不覆盖，覆盖率可能不达标。
  2. **stripHtml 抽离**：为可测试性，Task 5.6 计划将 detail/index.vue 的 `stripHtml` 抽离为 `@hplayer/core/utils/strip-html.ts`，组件直接 import。

---

## 维护规则

1. **每个 task 完成 → 立即更新本文件 + 当前 phase 文档的 `- [x]`**。
2. **派发并行 agent → 先创建 Agent 状态行**。
3. **阶段完成 → 更新阶段状态 + `current_phase` 指向下一阶段**。
4. **失败 task → 追加到「失败/阻塞任务」段，**不**勾选 `- [x]`**。
5. **主 agent 每次写完 STATE.md 后应同时输出简短摘要**给用户：「P2 任务 2.4 完成，commit=def5678；下一步：P2 任务 2.5」。

---

## 附录：阶段完成判定速查

| 阶段 | 标志 |
| --- | --- |
| P0 | `pnpm install` + `pnpm type-check` 通过 |
| P1 | `pnpm test` 至少 23 个测试通过 |
| P2 | T1JsonAdapter 字段映射测试通过 + `pnpm type-check` |
| P3 | `pnpm type-check` 通过；3 个并行 agent 各自提交 |
| P4 | `pnpm build` 通过；6 个并行 agent 各自提交 |
| P5 | `pnpm test` 覆盖率 ≥ 70% |
| P6 | `pnpm lint + format + type-check + build` 全绿 |
