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

# 2. 手动下载 Chromium build 1200（linux64）
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

# 3. 验证安装
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

### 2.3 关键注意事项

- 不要执行 `pnpm exec playwright install chromium`，默认会从海外 CDN 下载，速度极慢或超时。
- 不要升级 `@playwright/test` 或 `playwright` 到 1.58+，否则对应 Chromium build（如 1208/1217/1228）在 npmmirror 上可能没有 linux64 包。
- 如出现 `__dirlock` 锁错误，先执行 `rm -rf /root/.cache/ms-playwright/__dirlock` 再重试。
- 本项目的 E2E 验证使用 IDE 内置 **MCP Playwright**，不引入传统 Playwright test runner 与 spec 文件。
