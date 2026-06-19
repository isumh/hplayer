# HPlayer 项目规则记忆

## 1. 代码任务完成后的检查顺序

每次完成代码修改后，必须按以下顺序执行检查：

```bash
pnpm type-check
pnpm format
pnpm lint
```

### 说明

1. `pnpm type-check`：先跑 TypeScript 类型检查，确保无类型错误。
2. `pnpm format`：使用 Biome 自动格式化代码。
3. `pnpm lint`：使用 Biome 做 lint 检查；允许保留已有 warnings，但不得新增 errors。

> 当前项目 `package.json` 中未定义 `pnpm check`，因此使用 `pnpm type-check` 替代。

---

## 2. Playwright 安装配置（本机环境）

本机为 **x86_64 Linux**。Playwright 官方默认版本所需 Chromium build 在国内镜像站（npmmirror）上往往只有 arm64，无法快速安装。项目已固定使用 **Playwright 1.57.0**，对应 Chromium build **1200**，可在国内镜像站找到完整 linux64 包。

### 2.1 安装命令

```bash
# 1. 安装指定版本（必须精确到 1.57.0）
pnpm add -D -w @playwright/test@1.57.0 playwright@1.57.0

# 2. 清理旧缓存（防止 __dirlock 或损坏目录导致识别失败）
rm -rf /root/.cache/ms-playwright/__dirlock
rm -rf /root/.cache/ms-playwright/chromium-1200
rm -rf /root/.cache/ms-playwright/chromium_headless_shell-1200

# 3. 手动下载 Chromium build 1200（linux64）
mkdir -p ~/.cache/ms-playwright/chromium-1200
mkdir -p ~/.cache/ms-playwright/chromium_headless_shell-1200

cd ~/.cache/ms-playwright/chromium-1200
curl -L -o chromium-linux.zip \
  "https://registry.npmmirror.com/-/binary/playwright/builds/chromium/1200/chromium-linux.zip"
unzip -q chromium-linux.zip

cd ~/.cache/ms-playwright/chromium_headless_shell-1200
curl -L -o chromium-headless-shell-linux.zip \
  "https://registry.npmmirror.com/-/binary/playwright/builds/chromium/1200/chromium-headless-shell-linux.zip"
unzip -q chromium-headless-shell-linux.zip

# 4. 安装 Chromium 系统依赖（若启动报 libatk-1.0.so.0 等库缺失）
npx playwright install-deps chromium

# 5. 验证安装（必须在项目根目录执行，否则 require('playwright') 可能解析错误）
cd /workspace/hplayer
node -e "const { chromium } = require('playwright'); chromium.launch({ headless: true }).then(b => { console.log('ok'); b.close(); })"
```

### 2.2 目录结构要求

解压后必须保持以下命名，Playwright 1.57.0 才会识别：

```text
~/.cache/ms-playwright/
├── chromium-1200/
│   └── chrome-linux64/
│       └── chrome
└── chromium_headless_shell-1200/
    └── chrome-headless-shell-linux64/
        └── chrome-headless-shell
```

### 2.3 MCP Playwright 使用建议

IDE 内置的 MCP Playwright 默认 `waitUntil: 'networkidle'` 且 `headless: false`，在沙箱环境中容易超时。推荐首次导航时显式指定 `headless: true` 与 `waitUntil: 'load'` 或更短的 `'domcontentloaded'`，例如：

```json
{
  "url": "http://localhost:5173/",
  "timeout": 60000,
  "waitUntil": "load",
  "headless": true
}
```

如果仍然超时，可进一步缩短等待条件：

```json
{
  "url": "http://localhost:5173/",
  "timeout": 60000,
  "waitUntil": "domcontentloaded",
  "headless": true
}
```

页面加载完成后再通过 `playwright_console_logs`、`playwright_get_visible_text` 等工具检查状态，不要依赖导航调用等待所有网络请求结束。

### 2.4 关键注意事项

- 不要执行 `pnpm exec playwright install chromium`，默认会从海外 CDN 下载，速度极慢或超时。
- 不要升级 `@playwright/test` 或 `playwright` 到 1.58+，否则对应 Chromium build（如 1208/1217/1228）在 npmmirror 上可能没有 linux64 包。
- 如出现 `__dirlock` 锁错误，先执行 `rm -rf /root/.cache/ms-playwright/__dirlock` 再重试。
- 本项目的 E2E 验证使用 IDE 内置 **MCP Playwright**，不引入传统 Playwright test runner 与 spec 文件。

## 3. 开发环境代理配置

### 3.1 Vite dev server 代理外网视频源

沙箱环境通常无法直连 `caiji.dyttzyapi.com` 等外部源，但会提供 `http_proxy` / `HTTP_PROXY` 环境变量。Vite 的 `server.proxy` 默认不会自动使用环境代理，因此需要在 `apps/hplayer_web/vite.config.ts` 中为代理目标显式指定 `agent`：

```ts
import { HttpProxyAgent } from 'http-proxy-agent'

const devProxy = process.env.http_proxy || process.env.HTTP_PROXY
const proxyAgent = devProxy ? new HttpProxyAgent(devProxy) : undefined

export default defineConfig({
  server: {
    proxy: {
      '/api.php/provide/vod': {
        target: 'http://caiji.dyttzyapi.com',
        changeOrigin: true,
        agent: proxyAgent,
      },
    },
  },
})
```

同时，`packages/core/src/api/client.ts` 中的 Axios 拦截器需在开发环境下把绝对 URL 重写为相对路径，让请求命中 Vite 代理：

```ts
http.interceptors.request.use((config) => {
  if (
    import.meta.env.DEV &&
    config.url?.startsWith('http://caiji.dyttzyapi.com/api.php/provide/vod')
  ) {
    config.url = config.url.replace('http://caiji.dyttzyapi.com', '')
  }
  return config
})
```

### 3.2 常见排查信号

- `AxiosError: Network Error` + CORS 报错 → 请求未走 Vite 代理，检查 `import.meta.env.DEV` 是否生效、URL 是否被重写。
- `AxiosError: timeout` + 控制台无代理响应日志 → Vite 代理可能直连目标失败，检查是否需要 `HttpProxyAgent`。
- `Refused to set unsafe header "User-Agent"` → 浏览器安全限制，无法自定义 UA，不影响代理正确性。
