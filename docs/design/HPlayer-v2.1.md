# HPlayer v2.1 — Android 体验优化设计文档

> 文档版本：v2.1-design
> 编写日期：2026-06-20
> 前置参考：[HPlayer-v2.md](./HPlayer-v2.md)
> 状态：in_progress

---

## 0. 文档定位

本文件是 HPlayer **v2.1 Android 体验优化**的设计文档。V2.1 在 V2.0 已完成 Capacitor Android 封装的基础上，针对真机使用反馈进行定向优化，不引入新的平台或大型架构改动。

本文档明确：

- V2.1 目标与范围
- 四个优化方向的具体技术方案
- 任务拆分与验收标准
- 风险与对冲

---

## 1. 目标

1. **横竖屏自动切换**：Android 原生播放器默认横屏，但能根据视频比例自动识别竖屏短视频并切换，同时保留手动切换入口。
2. **修复海报图片不显示**：针对部分源返回 `http://` 图片但实际需要 `https://` 的问题，提供按源配置的协议强制替换能力。
3. **图片列表性能优化**：长列表页面引入虚拟滚动，降低大量图片 DOM 的渲染压力；统一图片错误降级占位。
4. **原生播放器增强**：提升稳定性、支持画面比例（填充/适应）切换、播放时防止屏幕自动熄灭。
5. **兼容无分类视频源**：部分 Apple CMS 源不返回 `class` 分类字段，首页应隐藏分类栏，使用默认 `categoryId = 0` 直接加载全部视频列表并支持滚动分页。

---

## 2. 范围

### 2.1 包含

| # | 功能 | 落点 |
| --- | --- | --- |
| 1 | 原生播放器横竖屏自动切换 + 手动按钮 | `packages/views/src/player/index.vue` |
| 2 | 视频源图片协议配置（http → https） | `packages/core/src/types/source.ts`、`SourceForm.vue`、图片组件 |
| 3 | 图片 URL 规范化工具 | `packages/core/src/utils/image-url.ts` |
| 4 | 长列表虚拟滚动 | `packages/ui/src/business/VodList.vue`、相关页面 |
| 5 | 图片加载错误占位 | `packages/ui/src/business/VodCard.vue`、`detail/index.vue` 等 |
| 6 | 原生播放器稳定化 | `packages/views/src/player/index.vue` |
| 7 | 原生播放器画面比例切换 | `packages/views/src/player/index.vue` |
| 8 | 播放时防止息屏 | `packages/views/src/player/index.vue`、`@capacitor-community/keep-awake` |
| 9 | 无分类视频源兼容 | `packages/views/src/home/index.vue` |

### 2.2 不包含

- **后台播放**：V2.1 不实现后台音频播放与系统通知栏控制。
- **锁屏媒体控制**：不集成 MediaSession。
- **图片磁盘缓存**：V2.1 只做内存/列表层优化，不做文件系统图片缓存。
- **自定义 ExoPlayer 插件**：继续使用 `@capgo/capacitor-video-player`，不替换播放器内核。
- **iOS / TV / 桌面端**：范围仍限于 Android。

---

## 3. 技术方案

### 3.1 横竖屏自动切换（原生播放器）

#### 背景

V2.0 中 Android 原生播放器进入播放页后强制横屏。部分视频源包含短视频（竖屏内容），强制横屏会导致画面被压缩或两侧黑边过大。

#### 方案

1. **默认横屏启动**：进入播放页时先以 `displayMode: 'landscape'` 初始化 `@capgo/capacitor-video-player`。
2. **自动检测视频比例**：
   - 优先通过插件事件获取视频实际宽高（需验证 `@capgo` 是否暴露相关事件/返回值）。
   - 若插件未暴露，则在 JS 层用 `<video>` 元素预加载当前集 URL 的元数据（`preload="metadata"`），读取 `videoWidth` / `videoHeight` 后判断方向。
3. **自动切换**：若检测到视频高度 > 宽度，停止当前播放器，重新 `initPlayer({ displayMode: 'portrait', ... })`，并调用 `ScreenOrientation.lock('portrait')`。
4. **手动切换按钮**：在原生播放器启动后的调试/状态区域（或插件支持的控件区域）增加横/竖屏切换按钮，用户可随时覆盖自动决策。
5. **退出恢复**：`onBeforeUnmount` 中统一恢复竖屏。

#### 关键代码结构

```ts
// 方向状态
const orientation = ref<'landscape' | 'portrait'>('landscape')

// 根据视频宽高判断方向
function resolveOrientation(width: number, height: number): 'landscape' | 'portrait' {
  return height > width ? 'portrait' : 'landscape'
}

// 切换方向时重新初始化原生播放器
async function switchNativePlayerOrientation(next: 'landscape' | 'portrait') {
  if (orientation.value === next) return
  orientation.value = next
  await cleanupNativePlayer()
  await ScreenOrientation.lock({ orientation: next })
  await initNativePlayer(currentUrl, currentStartAt)
}
```

> **待验证**：`@capgo/capacitor-video-player` 是否支持运行时切换 `displayMode` 而不重新 `initPlayer`；如不支持，采用上述重新初始化方案。

---

### 3.2 海报图片在 Android 不显示

#### 背景

真机测试发现部分视频源返回的海报 URL 为 `http://*.com/*.jpg`，而实际资源只支持 `https://`，导致 Android WebView 中图片加载失败。

#### 方案

1. **按源配置协议替换**：
   - 在 `VideoSource` 类型中新增 `forceHttpsImage?: boolean` 字段。
   - 在 `SourceForm.vue` 添加对应开关，默认关闭，由用户针对问题源开启。
2. **统一图片 URL 规范化工具**：
   - 新增 `packages/core/src/utils/image-url.ts`：
     ```ts
     export function normalizeImageUrl(url: string, forceHttps = false): string {
       if (!url) return url
       if (forceHttps && url.startsWith('http://')) {
         return url.replace(/^http:\/\//, 'https://')
       }
       return url
     }
     ```
3. **应用位置**：
   - `VodCard.vue` 的封面图。
   - `detail/index.vue` 的海报图。
   - 全局 `ImagePreview` 预览图。
4. **错误降级**：所有图片组件增加 `@error` 处理，加载失败时显示统一占位图，并打印日志便于排查。

#### 界面影响

- 设置页「添加/编辑视频源」表单新增一行：「图片强制 HTTPS」开关 + 说明文字。
- 图片加载失败不再显示裂图，而是显示本地占位图。

---

### 3.3 图片列表性能优化

#### 背景

首页、搜索、历史、收藏等页面同时渲染大量 `VodCard`，每个卡片包含一张远程图片。低端设备上滚动卡顿，且大量并发图片请求可能触发源站限流。

#### 方案

1. **虚拟滚动**：
   - 在 `VodList.vue` 中引入虚拟滚动，只渲染可视区 + 缓冲区的卡片。
   - 保持现有 `VodCard` 组件不变，将列表容器替换为虚拟滚动容器。
   - 选择实现方式：
     - 方案 A：引入 `vue-virtual-scroller`（需评估包体积与 Vue 3 兼容性）。
     - 方案 B：自研基于 `IntersectionObserver` 的简易虚拟滚动（可控性高、无额外依赖）。
   - **V2.1 推荐方案 B**：自研轻量虚拟滚动，避免引入第三方库。
2. **图片懒加载**：保留现有 `<img loading="lazy">`。
3. **图片错误降级**：同 3.2，加载失败显示占位图，避免反复重试。
4. **首屏优化**：虚拟滚动初始化时预留与容器等高的占位区域，避免滚动条跳动。

#### 验收标准

- 首页 200+ 条目滚动帧率稳定，无明细卡顿。
- 列表切换分类/搜索时，DOM 节点数不随总条目线性增长。

---

### 3.4 原生播放器增强

#### 3.4.1 稳定化

- 对 `@capgo/capacitor-video-player.initPlayer` 增加 `try/catch`。
- 启动失败时显示明确错误信息（如「播放器启动失败，请尝试切换视频源」）。
- 监听器注册也增加错误捕获，避免未处理的 native 事件异常导致应用闪退。
- 退出播放页时确保调用 `stopAllPlayers()` 和 `removeAllListeners()`，释放资源。

#### 3.4.2 画面比例切换

- 在原生播放器启动后的状态层增加比例切换按钮（如「适应 / 填充 / 拉伸」）。
- 实现方式取决于 `@capgo` 插件能力：
  - 若插件暴露 `aspectRatio` 或 `resizeMode` 参数，直接传入切换。
  - 若插件不暴露，通过 `ScreenOrientation` + 容器/视频比例间接实现；或在 V2.1 中仅提供「横屏适应 / 横屏填充」两种模式。
- **V2.1 初步方案**：先调研插件 API；若不支持精细比例控制，则提供「适应屏幕」与「填充屏幕」两个档位，通过重新 `initPlayer` 并调整 `displayMode` 与容器 CSS 实现。

#### 3.4.3 防止息屏

- 播放页进入时调用 `@capacitor-community/keep-awake` 的 `keepAwake()`。
- 播放页退出时调用 `allowSleep()` 恢复系统默认息屏行为。
- 若该插件不可用，则使用 Capacitor 原生桥接实现 WakeLock（作为 fallback）。

#### 新增依赖

```json
{
  "@capacitor-community/keep-awake": "^8.0.0"
}
```

---

### 3.5 兼容无分类视频源

#### 背景

部分 Apple CMS 视频源（尤其是较老的 XML/JSON 源）不返回 `class` 分类字段，导致 `getCategories()` 返回空数组。当前首页逻辑要求必须先选中分类才能加载视频列表，因此这类源会一直显示骨架屏，无法展示任何内容。

#### 方案

1. **适配器行为不变**：`T1JsonAdapter.getCategories()` / `T0XmlAdapter.getCategories()` 继续按现有逻辑解析 `class` 字段，缺省时返回空数组。
2. **首页逻辑调整**：
   - `home/index.vue` 的 `loadCategories()` 在获取到空数组时，不再报错，而是进入「无分类模式」。
   - 设置一个默认分类对象：
     ```ts
     const DEFAULT_CATEGORY: Category = { id: 0, name: '全部', sourceId: '' }
     ```
   - 将 `activeCategory` 设为默认分类，并立即调用 `loadList(true)` 加载全部视频。
3. **UI 表现**：
   - 分类栏不渲染（`categories.length === 0`）。
   - `AppHeader` 的 `category-name` 显示为「全部」。
   - 视频列表区域正常显示并支持滚动分页。
4. **分页与刷新**：无分类模式下的分页逻辑与有分类模式完全一致，仅 `categoryId` 固定为 `0`。

#### 关键代码结构

```ts
async function loadCategories() {
  if (!sourceStore.activeSource) {
    error.value = null
    return
  }
  error.value = null
  try {
    const list = await adapterProxy.getCategories(sourceStore.activeSource)
    categories.value = list
    if (list.length) {
      // 有分类：按原逻辑处理
      if (activeCategoryId.value == null) {
        const first = list[0]
        if (first) {
          activeCategoryId.value = first.id
          activeCategory.value = first
          await loadList(true)
        }
      } else {
        const found = list.find((c) => c.id === activeCategoryId.value)
        if (found) activeCategory.value = found
      }
    } else {
      // 无分类：使用默认 categoryId = 0 加载全部
      activeCategory.value = { id: 0, name: '全部', sourceId: sourceStore.activeSource.id }
      activeCategoryId.value = 0
      await loadList(true)
    }
  } catch (err) {
    console.error(err)
    error.value = '加载分类失败'
    showToast('加载失败，请检查网络或视频源')
  }
}
```

---

## 4. 工程结构变化

```text
hplayer/
├── packages/
│   ├── core/
│   │   └── src/
│   │       ├── types/source.ts        # 新增 forceHttpsImage 字段
│   │       └── utils/
│   │           └── image-url.ts       # 新增：图片 URL 规范化
│   ├── ui/
│   │   └── src/
│   │       └── business/
│   │           ├── VodList.vue        # 修改：引入虚拟滚动
│   │           ├── VodCard.vue        # 修改：使用 normalizeImageUrl + 错误占位
│   │           └── SourceForm.vue     # 修改：新增 forceHttpsImage 开关
│   └── views/
│       └── src/
│           ├── player/index.vue       # 修改：横竖屏、比例、息屏
│           ├── detail/index.vue       # 修改：海报 normalize + 错误占位
│           ├── home/index.vue         # 修改：接入虚拟滚动 VodList、无分类源兼容
│           ├── search/index.vue       # 修改：接入虚拟滚动 VodList
│           ├── favorite/index.vue     # 修改：接入虚拟滚动 VodList
│           └── history/index.vue      # 修改：接入虚拟滚动 VodList
├── apps/hplayer_android/
│   └── android/app/src/main/AndroidManifest.xml  # 修改：如需新增权限
└── docs/design/HPlayer-v2.1.md        # 本文档
```

---

## 5. 任务拆分

### Phase 9.5：无分类视频源兼容

- [ ] **Task 5.1**：确认 `T1JsonAdapter` / `T0XmlAdapter` 在缺 `class` 时均返回空数组（当前行为已符合）。
- [ ] **Task 5.2**：修改 `home/index.vue`：`categories` 为空时设置默认 `{ id: 0, name: '全部' }` 并调用 `loadList(true)`。
- [ ] **Task 5.3**：验证有分类源和无分类源的首页行为。
- [ ] **Task 5.4**：commit。

### Phase 9.1：图片 URL 规范化与按源配置

- [ ] **Task 1.1**：`VideoSource` 类型新增 `forceHttpsImage?: boolean`。
- [ ] **Task 1.2**：新增 `packages/core/src/utils/image-url.ts` 及单元测试。
- [ ] **Task 1.3**：`SourceForm.vue` 新增「图片强制 HTTPS」开关。
- [ ] **Task 1.4**：`VodCard.vue`、`detail/index.vue` 等应用 `normalizeImageUrl` 并加错误占位。
- [ ] **Task 1.5**：commit。

### Phase 9.3：原生播放器横竖屏与比例

- [ ] **Task 3.1**：调研 `@capgo/capacitor-video-player` 是否暴露视频宽高/比例 API。
- [ ] **Task 3.2**：实现视频比例自动检测与方向切换逻辑。
- [ ] **Task 3.3**：添加手动横竖屏切换按钮。
- [ ] **Task 3.4**：实现画面比例切换（适应 / 填充）。
- [ ] **Task 3.5**：commit。

### Phase 9.4：原生播放器稳定化与息屏

- [ ] **Task 4.1**：`initPlayer` 与监听器加 `try/catch` 和错误提示。
- [ ] **Task 4.2**：引入 `@capacitor-community/keep-awake`，播放页保持屏幕常亮。
- [ ] **Task 4.3**：真机验证稳定性、比例、息屏。
- [ ] **Task 4.4**：commit。

### Phase 9.2：图片列表虚拟滚动

- [ ] **Task 2.1**：自研基于 `IntersectionObserver` 的虚拟滚动容器组件。
- [ ] **Task 2.2**：`VodList.vue` 接入虚拟滚动，保持 `VodCard` 复用。
- [ ] **Task 2.3**：首页/搜索/收藏/历史页面验证虚拟滚动效果。
- [ ] **Task 2.4**：commit。

### Phase 9.6：文档与回归

- [ ] **Task 6.1**：更新 `STATE.md` 与 `README.md`。
- [ ] **Task 6.2**：全量质量门禁。
- [ ] **Task 6.3**：本地真机回归。
- [ ] **Task 6.4**：commit。

---

## 6. 测试策略

### 6.1 单元测试

- `image-url.test.ts`：覆盖 http → https、已 https 不变、空值等场景。
- `VodList` 虚拟滚动逻辑测试（如适用）。

### 6.2 真机测试

| 场景 | 验证点 |
| --- | --- |
| 横屏视频播放 | 默认横屏，画面比例切换正常 |
| 竖屏短视频播放 | 自动识别并切换为竖屏，或手动切换成功 |
| http 图片源 | 开启「图片强制 HTTPS」后海报正常显示 |
| 长列表滚动 | 首页/搜索大量条目滚动流畅，无卡顿 |
| 播放不息屏 | 播放页超过系统息屏时间仍保持亮屏 |
| 退出播放页 | 恢复竖屏、恢复系统默认息屏行为 |
| 无分类源首页 | 不显示分类栏，直接加载全部视频列表并支持滚动分页 |
| 有分类源首页 | 分类栏正常显示，切换分类加载对应列表 |

---

## 7. 风险与对冲

| 风险 | 对冲 |
| --- | --- |
| `@capgo` 插件不支持运行时切换 displayMode | 采用停止 + 重新 `initPlayer` 的方案；若仍不可行，改为仅提供手动切换按钮 |
| `@capgo` 插件不暴露视频宽高 | 用 `<video>` 预加载元数据获取比例；若 CORS 限制，则改为按源配置默认方向 |
| 虚拟滚动导致列表项高度不一致 | 强制 `VodCard` 封面使用固定宽高比，列表项高度可预估 |
| 图片 https 替换后仍失败 | 增加错误占位图，并在日志中记录原始 URL 便于后续分析 |
| keep-awake 插件与某些 ROM 不兼容 | 播放页退出时务必调用 `allowSleep()`，避免全局影响 |
| 无分类源 `categoryId = 0` 不被源站识别 | 若某源站 `t=0` 返回空，可后续增加「默认分类 ID」按源配置项作为 fallback |

---

## 8. 变更记录

| 版本 | 日期 | 变更 |
| --- | --- | --- |
| v1.0 | 2026-06-20 | 初始 V2.1 Android 体验优化设计文档 |
| v1.1 | 2026-06-20 | 新增「兼容无分类视频源」需求：首页无分类时隐藏分类栏，使用 categoryId = 0 直接加载全部视频列表 |
