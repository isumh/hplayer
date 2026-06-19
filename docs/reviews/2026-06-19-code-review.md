# HPlayer 代码评审报告

> 评审日期：2026-06-19
> 评审范围：整个 hplayer 项目源码（packages/、apps/、e2e/）
> 评审依据：code-review-and-quality 技能（五轴：正确性、可读性、架构、安全性、性能）
> 代码基线：commit `44ebbec` 之后的工作区（含 2026-06-19 代码简化重构）

---

## 1. 评审结论

| 维度 | 评级 | 说明 |
| --- | --- | --- |
| 正确性 | ⚠️ 需修复 | 发现 1 处 Critical 缺陷、2 处 Important 缺陷 |
| 可读性 | ✅ 良好 | 命名整体清晰，近期简化重构已消除多数重复与嵌套 |
| 架构 | ✅ 良好 | 包边界清晰，core/ui/views/router 分层合理 |
| 安全性 | ⚠️ 需关注 | 外部视频 URL 与备份导入缺少校验，存在潜在注入/崩溃风险 |
| 性能 | ✅ 良好 | 虚拟列表、缓存、分页机制合理，仅 1 处可优化 |

**综合 verdict：Request changes — 需修复 Critical 与 Important 项后方可合并/交付。**

---

## 2. Critical 缺陷（阻塞交付）

### 2.1 `ua-pool.reset()` 中 `size` 参数被忽略

- **文件**：[packages/core/src/api/ua-pool.ts](file:///workspace/hplayer/packages/core/src/api/ua-pool.ts#L34-L37)
- **代码**：
  ```ts
  reset(size?: number, device?: DeviceType): void {
    if (size !== undefined) this.size
    this.list = this.regenerate(size ?? this.size, device ?? this.device)
    this.idx = 0
  }
  ```
- **问题**：`if (size !== undefined) this.size` 是一条无效果的表达式语句，`size` 新值没有赋给 `this.size`，后续 `regenerate` 仍使用旧 size。
- **影响**：任何显式传入新 size 调用 `reset()` 的场景都会失败，导致 UA 池大小不可控。
- **修复**：
  ```ts
  if (size !== undefined) this.size = size
  ```

---

## 3. Important 缺陷（建议本次修复）

### 3.1 `SearchBar.vue` 防抖定时器未在组件卸载时清理

- **文件**：[packages/ui/src/business/SearchBar.vue](file:///workspace/hplayer/packages/ui/src/business/SearchBar.vue#L35-L39)
- **代码**：
  ```ts
  let timer: ReturnType<typeof setTimeout> | null = null
  function onInput(v: string) {
    local.value = v
    if (timer) clearTimeout(timer)
    timer = setTimeout(() => emit('search', v.trim()), 500)
  }
  ```
- **问题**：组件卸载后 `timer` 仍可能触发，向已销毁的实例 emit 事件；在 Vue Router 切换频繁时可能导致内存泄漏或异常回调。
- **修复**：在 `onBeforeUnmount` 中清理定时器。
  ```ts
  import { onBeforeUnmount } from 'vue'
  onBeforeUnmount(() => {
    if (timer) clearTimeout(timer)
  })
  ```

### 3.2 外部视频 URL 未做协议白名单校验

- **文件**：
  - [packages/core/src/utils/play-url.ts](file:///workspace/hplayer/packages/core/src/utils/play-url.ts#L3-L9)
  - [packages/views/src/player/index.vue](file:///workspace/hplayer/packages/views/src/player/index.vue#L67-L96)
  - [packages/views/src/detail/index.vue](file:///workspace/hplayer/packages/views/src/detail/index.vue)
- **问题**：`detectProtocol()` 仅通过字符串后缀判断协议，未拒绝 `javascript:`、`data:`、`blob:` 等危险 scheme；来自不可信 CMS 的播放 URL 可能触发 XSS 或异常行为。
- **影响**：中危。视频源通常由用户自行添加，但若用户被诱导添加恶意源，可能导致 WebView 执行任意代码。
- **修复建议**：
  - 在 `detectProtocol` 或 adapter 层增加 scheme 白名单校验：仅允许 `http(s):`、`ftp:`（可选）。
  - 播放器初始化前对 `url` 做 `new URL(url)` 校验并检查 `protocol`。

### 3.3 `backup.importBackup()` 对 favorites/history 数组元素缺少结构校验

- **文件**：[packages/core/src/utils/backup.ts](file:///workspace/hplayer/packages/core/src/utils/backup.ts#L42-L53)
- **代码**：
  ```ts
  if (Array.isArray(data.favorites)) storage.set(STORAGE_KEYS.favorites, data.favorites)
  if (Array.isArray(data.history)) storage.set(STORAGE_KEYS.history, data.history)
  ```
- **问题**：只校验了是否为数组，未校验元素是否包含 `vod.id`、`sourceId` 等必填字段。恶意/损坏的备份文件写入 localStorage 后，后续页面读取时可能抛出异常（如 `item.vod.id` 访问失败）。
- **修复建议**：引入最小结构校验，例如：
  ```ts
  const validFavorites = data.favorites.filter((i) => i?.vod?.id && i.sourceId)
  ```
  或定义 `isFavoriteItem()` / `isHistoryItem()` 类型守卫。

### 3.4 选集 URL 拆分未处理含 `$` 字符的 URL

- **文件**：
  - [packages/core/src/adapter/t0-xml.ts](file:///workspace/hplayer/packages/core/src/adapter/t0-xml.ts#L75-L79)
  - [packages/core/src/adapter/t1-json.ts](file:///workspace/hplayer/packages/core/src/adapter/t1-json.ts#L72-L75)
- **代码示例**（t0-xml）：
  ```ts
  const [n, u] = seg.split('$')
  return { name: (n ?? '').trim(), url: (u ?? '').trim() }
  ```
- **问题**：`split('$')` 默认只返回前两部分，但若 URL 本身包含 `$`（虽然不常见，但某些 CDN 签名或转码参数可能包含），会导致 URL 被截断。
- **修复建议**：使用 `split('$', 2)` 并取最后一段作为 URL，或限制只按第一个 `$` 拆分：
  ```ts
  const idx = seg.indexOf('$')
  const n = idx === -1 ? seg : seg.slice(0, idx)
  const u = idx === -1 ? '' : seg.slice(idx + 1)
  ```

### 3.5 `client.ts` URL 替换范围偏宽

- **文件**：[packages/core/src/api/client.ts](file:///workspace/hplayer/packages/core/src/api/client.ts)
- **代码**：
  ```ts
  config.url = config.url.replace(DYTT_PROXY_TARGET, '')
  ```
- **问题**：虽然前面已用 `startsWith` 判断，但 `String.replace()` 会替换所有匹配子串；若路径中巧合包含该域名字符串，会被误替换。
- **修复建议**：使用 `slice(DYTT_PROXY_TARGET.length)` 显式移除前缀。

---

## 4. Suggestion（可选改进）

### 4.1 `storage.get()` 静默吞掉 JSON 解析错误

- **文件**：[packages/core/src/utils/storage.ts](file:///workspace/hplayer/packages/core/src/utils/storage.ts#L7-L14)
- **建议**：在 dev 环境打印 warning，便于排查 localStorage 损坏；生产环境仍可静默回退 fallback。
  ```ts
  console.warn(`[storage] failed to parse ${key}`, err)
  ```

### 4.2 `App.vue` 滚轮缩放直接操作 DOM 且解析正则

- **文件**：[apps/hplayer_web/src/App.vue](file:///workspace/hplayer/apps/hplayer_web/src/App.vue#L12-L34)
- **建议**：使用 `requestAnimationFrame` 或 throttle 减少高频 wheel 事件下的 DOM 写操作；将 `translate3d(...)` / `scale(...)` 字符串提取为常量。

### 4.3 `search-history.ts` 未限制关键词长度

- **文件**：[packages/core/src/store/search-history.ts](file:///workspace/hplayer/packages/core/src/store/search-history.ts#L22-L34)
- **建议**：增加最大长度限制（如 100 字符）并截断，防止用户粘贴超长内容撑满 localStorage。

### 4.4 `favorite/index.vue` 与 `history/index.vue` 存在重复逻辑

- **文件**：
  - [packages/views/src/favorite/index.vue](file:///workspace/hplayer/packages/views/src/favorite/index.vue#L17-L45)
  - [packages/views/src/history/index.vue](file:///workspace/hplayer/packages/views/src/history/index.vue#L26-L54)
- **建议**：二者 SwipeCell 互斥关闭逻辑（`cells`、`bindRef`、`isInsideAnyCell`、`closeAllCells`、`onDocClick`）以及 `fmtTime` 完全相同。可考虑抽取为 `useSwipeCellGroup()` composable 和共享时间格式化函数。当前不影响功能，属于可读性/可维护性债务。

### 4.5 `e2e/mock-t0-server.mjs` 使用 `Access-Control-Allow-Origin: *`

- **文件**：[e2e/mock-t0-server.mjs](file:///workspace/hplayer/e2e/mock-t0-server.mjs)
- **建议**：仅测试使用，当前可接受；建议在文件顶部加注释明确 `// 仅本地 E2E mock，禁止用于生产`。

### 4.6 `t0-xml.ts` / `t1-json.ts` 分类字段校验可更严格

- **文件**：
  - [packages/core/src/adapter/t0-xml.ts](file:///workspace/hplayer/packages/core/src/adapter/t0-xml.ts#L143-L154)
  - [packages/core/src/adapter/t1-json.ts](file:///workspace/hplayer/packages/core/src/adapter/t1-json.ts#L98-L105)
- **建议**：当前已过滤空 id/name，但可进一步校验 id 非空字符串、name 长度合理，避免渲染出空白分类按钮。

---

## 5. 架构与 Android 2.0 适配评估

### 5.1 分层合理性

- `packages/core` 仅依赖 Vue/Pinia 与少量工具库，不依赖 UI，便于未来 Capacitor Android 项目复用。
- `packages/ui` 与 `packages/views` 仅通过 props/emit 交互，解耦良好。
- `storage.ts` 作为唯一持久化抽象，V2 迁移时替换成本低。

### 5.2 已知 V2 风险点

- `localStorage` 容量受限（约 5MB），大量历史/收藏记录时可能在 Android WebView 中触发 `QuotaExceededError`；`storage.set()` 虽已 try/catch，但无用户提示。
- `window.matchMedia` 在 Capacitor WebView 中表现一致，但 `document.documentElement.classList.toggle('dark')` 需确认与 Android 状态栏/导航栏主题同步。
- 当前代理逻辑仅服务于开发环境；Android 生产包需原生 HTTP 插件或服务器中转解决 CORS。

---

## 6. 验证状态

| 检查项 | 结果 |
| --- | --- |
| `pnpm lint` | ✅ 通过 |
| `pnpm type-check` | ✅ 5/5 packages 通过 |
| `pnpm test` | ✅ 135 个测试全部通过 |

**注意**：测试通过不代表上述 Critical/Important 项不存在，尤其是 UI 层面的内存泄漏与外部数据校验问题，现有测试未覆盖。

---

## 7. 修复优先级建议

| 优先级 | 项 | 预估工作量 |
| --- | --- | --- |
| P0 | 修复 `ua-pool.ts` reset size 无操作 | 1 行 |
| P1 | `SearchBar.vue` 组件卸载清理 timer | 5 行 |
| P1 | 视频 URL scheme 白名单校验 | ~20 行 |
| P1 | `importBackup()` 元素结构校验 | ~15 行 |
| P2 | 选集 URL `$` 拆分安全化 | ~8 行 ×2 |
| P2 | `client.ts` 使用 `slice` 替代 `replace` | 1 行 |
| P3 | 其余 Suggestion | 可选 |

---

## 8. 修复记录（2026-06-19）

以下 Critical / Important / Suggestion 项均已在同一次提交前完成修复并验证：

| 原编号 | 问题 | 修复文件 | 修复摘要 |
| --- | --- | --- | --- |
| 2.1 | `ua-pool.reset()` size 参数无效 | `packages/core/src/api/ua-pool.ts` | 改为 `this.size = size`；同时移除 `size` 字段的 `readonly` 修饰 |
| 3.1 | SearchBar timer 未清理 | `packages/ui/src/business/SearchBar.vue` | 导入 `onBeforeUnmount`，卸载时 `clearTimeout(timer)` |
| 3.2 | 外部视频 URL 无 scheme 校验 | `packages/core/src/utils/play-url.ts` | 新增 `isValidVideoUrl()`，仅允许 `http/https/ftp`；`detectProtocol` 先校验 |
| 3.2 | 适配器解析选集未过滤非法 URL | `packages/core/src/adapter/t0-xml.ts`、`t1-json.ts` | `parsePlayLists` 过滤后改用 `isValidVideoUrl(e.url)` |
| 3.2 | 播放器初始化前未校验 URL | `packages/views/src/player/index.vue` | `buildPlayer` 开头校验 URL，非法时设置 `error` |
| 3.3 | `importBackup()` 未校验元素结构 | `packages/core/src/utils/backup.ts` | 新增 `isValidFavorite` / `isValidHistory` 类型守卫并过滤 |
| 3.4 | 选集 URL 按 `$` 拆分不安全 | `packages/core/src/adapter/t0-xml.ts`、`t1-json.ts` | 改用 `indexOf('$')` 仅按第一个 `$` 拆分 |
| 3.5 | `client.ts` URL 替换范围偏宽 | `packages/core/src/api/client.ts` | `replace` 改为 `slice(DYTT_PROXY_TARGET.length)` |
| 4.1 | `storage.get()` 静默吞错误 | `packages/core/src/utils/storage.ts` | catch 块中 `console.warn` 解析失败信息 |
| 4.3 | 搜索历史无长度限制 | `packages/core/src/store/search-history.ts` | 新增 `MAX_KEYWORD_LENGTH = 100` 并截断 |
| 4.5 | mock server CORS 未标注 | `e2e/mock-t0-server.mjs` | 文件顶部添加「仅本地 E2E mock，禁止用于生产」注释 |
| — | 测试数据需配合 URL 校验 | `packages/core/src/adapter/t1-json.integration.test.ts` | mock URL 由 `url1` 改为 `https://x.com/url1` 等合法地址 |

### 修复后验证

| 检查项 | 结果 |
| --- | --- |
| `pnpm lint` | ✅ 通过（82 文件） |
| `pnpm type-check` | ✅ 5/5 packages 通过 |
| `pnpm test` | ✅ 23 个测试文件，135 个测试全部通过 |

---

## 9. Verdict

- [x] **Approve** — Critical / Important 项已修复，验证通过
- [ ] **Request changes** — 无需再改
