# Android 原生视频播放器 POC

> 创建日期：2026-06-20  
> 第二轮升级日期：2026-06-20  
> 基线 Git Commit：`c85d78c08098a2b498da882c7cc8d61f25864049`  
> 关联任务：升级到 Capacitor 8 后，重新评估在 Android 端使用 `@capgo/capacitor-video-player` 替代/增强 Web 播放器

---

## 1. 目的

验证 `@capgo/capacitor-video-player`（Android 端基于 ExoPlayer）在 HPlayer 工程中的实际可用性，Web 端保持现有 `Artplayer + hls.js` 方案不变。

由于当前沙箱环境无模拟器且无法本地打包 APK，所有验证必须通过 **GitHub Actions 构建 → 手动下载安装 APK** 完成。因此本 POC 将多个验证点集中到一次打包测试中。

---

## 2. 基线记录

| 项目 | 值 |
|---|---|
| 基线分支 | 当前工作分支 |
| 基线 Commit | `c85d78c08098a2b498da882c7cc8d61f25864049` |
| Capacitor 版本 | 8.x |
| 插件版本 | `@capgo/capacitor-video-player@8.1.20` |
| 当前播放器 | `Artplayer + hls.js`（WebView 内播放） |

### 回滚方式

若 POC 验证结果不理想或引发严重问题，可回滚到本轮升级前（Capacitor 7 + 已移除原生播放器入口）：

```bash
git reset --hard c85d78c08098a2b498da882c7cc8d61f25864049~1
```

> 注意：此命令会丢弃 POC 期间的所有代码变更。执行前请确认无需保留任何中间结果。

---

## 3. 验证点

| 编号 | 验证项 | 通过标准 |
|---|---|---|
| V1 | 原生全屏唤起 | 进入播放页后自动打开 Android 原生全屏播放器 |
| V2 | 格式兼容性 | 可播放当前视频源的真实 URL（MP4 / HLS m3u8） |
| V3 | 基础播放控制 | 原生控制器支持播放、暂停、拖动进度、音量调节 |
| V4 | 倍速播放 | 初始化倍速生效；退出后重进能恢复倍速 |
| V5 | 进度保存 | 退出原生播放器时，当前进度被保存并在 Web 页显示 |
| V6 | 横屏显示 | 原生播放器强制横屏，退出后页面可正常恢复 |
| V7 | 稳定性 | 反复进入/退出/切换集数不崩溃、不黑屏 |

---

## 4. 实现方案

### 4.1 依赖安装

```bash
# 原生平台依赖
pnpm --filter hplayer_android add @capgo/capacitor-video-player@^8.0.0

# Web 平台依赖（仅用于 TypeScript 类型）
pnpm --filter hplayer_web add @capgo/capacitor-video-player@^8.0.0

# views 包依赖（播放页集成）
pnpm --filter @hplayer/views add @capgo/capacitor-video-player@^8.0.0
```

### 4.2 代码改造

改造文件：[packages/views/src/player/index.vue](../../packages/views/src/player/index.vue)

- Android 平台：进入页面调用 `CapacitorVideoPlayer.initPlayer({ mode: 'fullscreen', displayMode: 'landscape', rate, url, title })`
- Web 平台：保持现有 `Artplayer` 逻辑不变
- 监听 `jeepCapVideoPlayerExit` / `jeepCapVideoPlayerEnded` 事件，调用现有 `historyStore.touch()` 保存进度
- 页面显示调试信息：状态、退出时间、已保存进度
- 保留"重新打开原生播放器"按钮，方便反复测试

### 4.3 原生工程同步

```bash
pnpm sync:android
```

### 4.4 APK 构建

通过 GitHub Actions 自动构建 release APK，流程复用现有 [`.github/workflows/build-apk.yml`](../../.github/workflows/build-apk.yml)。

---

## 5. 测试流程

1. 推送代码到 GitHub，触发 Actions 构建
2. 下载构建产物 `hplayer-release-apk`
3. 在 Android 真机上安装 APK
4. 进入任意视频播放页，按第 3 节验证点逐项测试
5. 记录每个验证点的通过/失败/异常结果

---

## 6. 风险与已知限制

- 原生播放器会完全覆盖 WebView，播放页下方的倍速条、标题栏在播放期间不可见
- 本轮升级到 Capacitor 8 以使用 `@capgo/capacitor-video-player` v8（actively maintained），涉及 Android SDK 36、Gradle 8.14.3、AGP 8.13.0 等原生工具链变更
- 原生 ExoPlayer 默认控制器未必直接暴露倍速按钮，可能需要通过 API 或额外菜单调整
- 切换剧集时原生播放器会关闭再重新打开，视觉上会有闪烁
- 若当前视频源 URL 无法访问，需使用内置公开测试视频作为 fallback

---

## 7. 测试结果（待填写）

| 编号 | 结果 | 备注 |
|---|---|---|
| V1 |  |  |
| V2 |  |  |
| V3 |  |  |
| V4 |  |  |
| V5 |  |  |
| V6 |  |  |
| V7 |  |  |

### 第一轮 POC 结论（Capacitor 7）

**POC 失败。** `@capgo/capacitor-video-player@7.0.0` 在 Capacitor 7.x + 测试真机环境下，调用 `initPlayer` 即触发原生层崩溃，无法完成基础播放验证。

### 第二轮 POC 状态（Capacitor 8）

**已升级到 Capacitor 8 + `@capgo/capacitor-video-player@8.1.20`，构建、同步、质量门禁均通过，待真机验证 `initPlayer` 是否仍崩溃。**

---

## 8. 后续建议

1. **本轮验证**：推送 GitHub Actions 打包 APK，在真机上点击播放页「测试原生播放器」按钮，确认是否仍闪退。
2. **若 v8 仍失败**：回滚到 Capacitor 7（或保持 Capacitor 8 但移除原生播放器入口），继续以 `Artplayer + hls.js` 作为 Android 播放方案。
3. **若 v8 成功**：进一步验证 V1–V7 验证点，并处理标题栏隐藏、倍速同步、进度续播等体验细节。
