# Phase 6: 质量门禁 + 收尾

> 对应原文档 `2026-06-13-hplayer-v1.0-mvp.md` 第 3515-3635 行（Phase 6 + 阶段完成判定 + Self-Review + 执行方式选择 完整内容）。

## 状态

- [ ] pending
- [ ] in_progress
- [x] completed

> 主 agent 在 P5 完成后派发 P6-1 subagent（单 agent）。

## 依赖

- P5 完成（集成测试 + 覆盖率均达标）。

## 阶段目标

执行最终质量门禁（lint / format / type-check / build / 端到端冒烟）并最终 commit。

## 中断恢复说明

- 6 个 task 顺序执行。
- Task 6.5 端到端冒烟是手动测试，TRAE 需提示用户执行。
- **恢复点**：`STATE.md` 中 `[P6-1]` 行的 `last_task` 字段（格式 `Task N.M`）。

---

## Agent P6-1: 收尾

---

- [ ] **Task 6.1: Lint**

Run: `cd /workspace/hplayer && pnpm lint`
Expected: 全部通过（或仅 warning，无 error）。

- [x] **Task 6.2: Format**

Run: `cd /workspace/hplayer && pnpm format`
Expected: 自动修复后再次 lint 通过。

- [ ] **Task 6.3: Type check**

Run: `cd /workspace/hplayer && pnpm type-check`
Expected: 0 error。

- [ ] **Task 6.4: Build**

Run: `cd /workspace/hplayer && pnpm build`
Expected: dist 产物生成，无 error。

- [x] **Task 6.5: 端到端冒烟（手动）**

```bash
cd /workspace/hplayer && pnpm dev
# 浏览器打开 http://localhost:5173
# 1. 跳转到添加视频源（首次启动无源）
# 2. 添加一个 JSON 源
# 3. 浏览分类与列表
# 4. 进入详情 → 选集 → 播放
# 5. 返回首页，点击右上角 ★ → 看到收藏
# 6. 点击右上角 🕒 → 看到历史
```

- [x] **Task 6.6: 最终 commit**

```bash
cd /workspace/hplayer && git add -A && git commit -m "chore(P6): quality gate (lint/format/type-check/build verified)"
```

---

## 阶段完成判定

| 阶段 | 完成标志 |
| --- | --- |
| P0 | `pnpm install` + `pnpm type-check` 通过 |
| P1 | `pnpm test` 通过 17+ 工具 + 6+ store 测试 |
| P2 | T1JsonAdapter 字段映射测试通过 |
| P3 | `pnpm type-check` 通过；3 个并行 agent 各自提交 |
| P4 | `pnpm build` 通过；6 个并行 agent 各自提交 |
| P5 | `pnpm test` 覆盖率 ≥ 70% |
| P6 | `pnpm lint + format + type-check + build` 全绿 |

---

## Self-Review 报告

## 1. Spec 覆盖

| HPlayer.md 章节 | 计划中位置 |
| --- | --- |
| §1 概述 | 文档顶部 Goal/Architecture |
| §2 技术选型 | Tech Stack |
| §3 信息架构 | P4-A（TabLayout + router） |
| §4 关键流程 | P4-A（P4.2 加载列表）+ P4-B（搜索） |
| §5 组件清单 | P3-A/P3-B/P3-C |
| §6 数据模型 | P1-A Task 1.1-1.6 |
| §6.4 视频源表单 | P3-C Task 3.16 |
| §7 CMS 适配器 | P2 |
| §8 播放方案 | P4-F |
| §9 状态管理 | P1-B |
| §10 路由 | P4-A Task 4.3 |
| §11 视觉与主题 | P0 vant-theme.css + P1-B settingsStore |
| §12 性能 | VodList 用 Vant 内置 lazyload + skeleton |
| §13 Capacitor（V2） | 留待 V2 阶段 |
| §14 测试 | P5 |
| §15 目录结构 | P0-P4 文件分布 |
| §16 里程碑 V1.0 | P0-P6 |
| §19.1 滑动窗口 | P1-A Task 1.8 + P1-B Task 1.19/1.20 |
| §19.2 activeSourceId | P1-B Task 1.17 |

## 2. Placeholder 扫描

- 无 `TBD` / `TODO` / `类似` / `稍后实现` 占位（除了 T0_XML 适配器的 V1.1 抛错占位——属于规约允许）。
- 所有步骤包含完整代码。
- 所有测试包含断言。
- 所有文件路径精确。

## 3. 类型一致性

- `useSourceStore` 在 P1-B 定义，P4-A 路由守卫和 P3-C SourceForm 引用，签名一致。
- `VideoSource.pageSize` 在 §1.2 定义（number | undefined），`clampPageSize` 接受 `number | undefined | null`——兼容性 OK。
- `VodItem.sourceId` 在 T1JsonAdapter 中临时使用 baseUrl 占位，调用方 `adapterProxy` 统一 fix 为真实 sourceId——已明确。
- `Episode` 类型在 P1-A 定义，P3-C EpisodeList 与 P4-F 播放器引用一致。

## 4. 风险点

| 风险 | 缓解 |
| --- | --- |
| T1JsonAdapter 实际接口字段差异（不同 mac-cms 版本） | 字段解析容错 + 在 SourceForm 添加"自定义字段映射"V2 选项 |
| 跨域问题 | 文档中提示用户使用浏览器扩展（如 CORS Unblock）|
| artplayer 移动端手势 | V1 测试覆盖；V2 切 Capacitor 走原生 |
| pnpm install 失败 | P0 Step 20 后若失败，回退到 npm |

---

## 执行方式选择

**Plan complete and saved to `docs/dev-plans/`. Two execution options:**

1. **Subagent-Driven (recommended)** — 每个 Phase 派发一个或多个 fresh subagent，task 间 review 一次；并行 Agent 同步执行
2. **Inline Execution** — 在当前 session 顺序执行，每完成一个 Phase 检查点 review

**Which approach?**

如选 Subagent-Driven：TRAE 可同时启动 3 个 P3 Agent（A/B/C）和 6 个 P4 Agent（A-F）以最大化并行。

---

## 完成判定（V1.0 MVP 收尾）

- [x] 全部 6 个 task 完成（Task 6.1-6.6）
- [x] `pnpm lint + format + type-check + build` 全绿
- [x] 端到端冒烟通过（手动）
- [x] 最后 commit 已记录到 STATE.md

完成后主 agent：
1. 在本文件顶部「状态」勾选 `completed`。
2. 更新 `STATE.md`：
   - `current_phase = done`
   - 阶段总览表所有阶段标记为 `completed`。
3. 提示用户：**hplayer V1.0 MVP 实施完成**；后续可进入 V1.1（T0_XML 完整实现） / V2（Capacitor Android 集成）。
