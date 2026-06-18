# hplayer V1.0 MVP — 分阶段开发计划（拆分版）

> 本目录由 `2026-06-13-hplayer-v1.0-mvp.md`（3635 行）拆分而来，按 Phase 拆分为独立 md 文档，便于 TRAE subagent 单独加载并支持**中断后从断点继续执行**。
>
> **For agentic workers:** 每个子文档顶部都带有「状态」与「恢复说明」段。每个 Task 用 `- [ ]` 复选框追踪；TRAE 重新启动会话时，可通过 `STATE.md` + 当前 phase 文档顶部的「已完成任务」段继续。

---

## 1. 文档清单

| # | 文件 | 内容 | Agent 数 | 依赖 | 可并行 |
| --- | --- | --- | --- | --- | --- |
| 00 | [00-INDEX.md](file:///workspace/docs/dev-plans/00-INDEX.md) | 索引 + 中断恢复协议 | — | — | — |
| — | [STATE.md](file:///workspace/docs/dev-plans/STATE.md) | 当前进度与任务状态跟踪 | — | — | — |
| 01 | [01-phase-0-scaffolding.md](file:///workspace/docs/dev-plans/01-phase-0-scaffolding.md) | 工作区 + 构建脚手架 | 1 | 无 | ❌ 基线 |
| 02 | [02-phase-1-core-stores.md](file:///workspace/docs/dev-plans/02-phase-1-core-stores.md) | Core 工具 + Pinia Store | 2 | P0 | ✅ A 类型/工具 ↔ B Store |
| 03 | [03-phase-2-adapter.md](file:///workspace/docs/dev-plans/03-phase-2-adapter.md) | CMS Adapter | 1 | P1 | ❌ |
| 04 | [04-phase-3-ui-components.md](file:///workspace/docs/dev-plans/04-phase-3-ui-components.md) | 共享 UI 组件 | 3 | P2 | ✅ A 布局 / B 视频 / C 业务 |
| 05 | [05-phase-4-pages-and-router.md](file:///workspace/docs/dev-plans/05-phase-4-pages-and-router.md) | 页面 + 路由 | 6 | P3 | ✅ A-F |
| 06 | [06-phase-5-tests.md](file:///workspace/docs/dev-plans/06-phase-5-tests.md) | 集成 + 单元测试 | 1 | P4 | ❌ |
| 07 | [07-phase-6-quality-gate.md](file:///workspace/docs/dev-plans/07-phase-6-quality-gate.md) | 质量门禁 + 收尾 | 1 | P5 | ❌ |
| 08 | [08-phase-7-v1.1.md](file:///workspace/docs/dev-plans/08-phase-7-v1.1.md) | V1.1 增强 | 2 | P6 | ❌ 批次 1 → 批次 2 |

**总 Agent 数：17**（P0×1, P1×2, P2×1, P3×3, P4×6, P5×1, P6×1, P7×2）

---

## 2. 总体目标

**Goal:** 实现 hplayer V1.0 MVP——一个 Web Mobile 形态的极简影视浏览/搜索/播放应用，基于 Capacitor 后续可打包为 Android。

**Architecture:** pnpm workspace + Monorepo（apps + packages）。Web Mobile 端使用 Vite + Vue 3 + Vant 4 + Tailwind 4。状态管理用 Pinia + persistedstate。无后端，浏览器直连第三方 CMS。数据存 localStorage（V1）。

**Tech Stack:**
- Vue 3.5 + `<script setup>` + TypeScript 5.6（严格模式）
- Vite 7
- Vant 4.9 + Tailwind CSS 4
- Pinia 2.2 + pinia-plugin-persistedstate
- vue-router 4（hash 模式）
- Axios 1.7
- hls.js 1.5 + artplayer 5.1
- Biome 2.4.5（替代 ESLint + Prettier）
- Vitest 2.1 + @vue/test-utils
- pnpm 9 workspace

**Spec Reference:** [docs/design/HPlayer.md](file:///workspace/docs/design/HPlayer.md)
**Code Wiki Reference:** [docs/CodeWiki.md](file:///workspace/docs/CodeWiki.md)

---

## 3. 并行矩阵图

```text
P0 ──▶ P1-A (types/utils) ──┐
     └─▶ P1-B (stores) ─────┴─▶ P2 ──▶ P3-A (layout)   ──┐
                                    P3-B (video)   ──┤
                                    P3-C (business) ──┴─▶ P4-A (home)    ──┐
                                                       P4-B (search)  ──┤
                                                       P4-C (settings) ──┤
                                                       P4-D (detail)  ──┤
                                                       P4-E (fav/hist) ──┤
                                                       P4-F (player)   ──┴─▶ P5 ──▶ P6
```

---

## 4. Agent 编排规则（TRAE Subagent 工作约定）

1. **每个 subagent 只读 + 只写自己**的 Own Files 表格中列出的文件。
2. **跨阶段依赖**：子 agent 不得修改前一阶段 agent 拥有的文件；如发现需要修改，**通过任务记录**反馈到主 agent 协调。
3. **验证**：
   - 每个 task 完成后运行 `pnpm type-check`（在仓库根）。
   - P3/P4 完成后运行 `pnpm build`。
   - P5/P6 完成后运行 `pnpm test` + `biome check`。
4. **Commit 策略**：每完成一个 task 即提交，提交信息格式：`feat(P<phase>): <task name>`。
5. **冲突处理**：并行 agent 若发现冲突，立即停止并向主 agent 报告（不进行猜测性合并）。

---

## 5. 中断恢复协议（TRAE 必读）

### 5.1 状态文件约定

- **`STATE.md`**：主 agent 维护的全局进度表。
  - 字段：`current_phase`（01/02/03/04/05/06/07）、`last_completed_task`、`last_commit_hash`、`failed_tasks`、`next_action`。
  - 每次 task 完成后，主 agent 更新 STATE.md。

- **每个 phase 文档**（`01-phase-0-scaffolding.md` 等）：
  - 顶部带 `## 状态` 段（pending / in_progress / completed）。
  - 顶部带 `## 中断恢复说明` 段：明确说明本阶段从哪个 task 之后可安全恢复。
  - 任务列表中每完成一个 task 即把 `- [ ]` 改为 `- [x]`。

### 5.2 恢复流程（TRAE 在新会话中执行）

1. **读取 `STATE.md`**：确认 `current_phase` 与 `last_completed_task`。
2. **加载当前 phase 文档**（如 `02-phase-1-core-stores.md`）。
3. **比对任务清单**：从 `last_completed_task` 之后第一个 `- [ ]` 开始执行。
4. **执行完一个 task**：
   - 跑对应的 `pnpm type-check` / `pnpm test`。
   - 提交：`git commit -m "feat(P<phase>): <task name>"`，记录 commit hash。
   - 更新当前 phase 文档中的 `- [x]` 标记。
   - 更新 `STATE.md` 的 `last_completed_task` 与 `last_commit_hash`。
5. **当所有 task 完成**：
   - 更新 phase 文档顶部 `## 状态` 为 `completed`。
   - 更新 `STATE.md` 的 `current_phase` 指向下一阶段。
   - 若下一阶段有多个并行 agent，主 agent 派发多个 subagent。

### 5.3 并行恢复注意

- 并行 agent 各自维护本地任务清单；主 agent 在 STATE.md 中以 `phase-N-letter-taskId` 形式分别记录。
- 派发并行 agent 时，主 agent 先在 STATE.md 中为每个 agent 创建一个状态行。

### 5.4 失败 / 阻塞处理

- 若 task 失败：在 STATE.md 的 `failed_tasks` 中追加 `phase:task_id - <error summary>`，**不**勾选 `- [x]`。
- 修复后从失败 task 继续。
- 若需调整计划（如新增 task / 拆分 task）：在当前 phase 文档「变更记录」段追加说明，并同步到 STATE.md。

---

## 6. 阶段完成判定

| 阶段 | 完成标志 |
| --- | --- |
| P0 | `pnpm install` + `pnpm type-check` 通过 |
| P1 | `pnpm test` 通过 17+ 工具 + 6+ store 测试 |
| P2 | T1JsonAdapter 字段映射测试通过 |
| P3 | `pnpm type-check` 通过；3 个并行 agent 各自提交 |
| P4 | `pnpm build` 通过；6 个并行 agent 各自提交 |
| P5 | `pnpm test` 覆盖率 ≥ 70% |
| P6 | `pnpm lint + format + type-check + build` 全绿 |

完整 Self-Review 报告（Spec 覆盖 / Placeholder 扫描 / 类型一致性 / 风险点）见 [07-phase-6-quality-gate.md](file:///workspace/docs/dev-plans/07-phase-6-quality-gate.md) 末尾。

---

## 7. 执行方式选择

**Plan complete and saved to `docs/dev-plans/`. Two execution options:**

1. **Subagent-Driven (recommended)** — 每个 Phase 派发一个或多个 fresh subagent，task 间 review 一次；并行 Agent 同步执行。
2. **Inline Execution** — 在当前 session 顺序执行，每完成一个 Phase 检查点 review。

TRAE 默认采用 **Subagent-Driven**：
- P1 可同时启动 A、B 两个 subagent
- P3 可同时启动 A、B、C 三个 subagent
- P4 可同时启动 A-F 六个 subagent

启动并行 subagent 前，主 agent 必须先在 `STATE.md` 中为每个 agent 分配独立的状态行。
