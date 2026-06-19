# GitHub Actions 自动打包 APK 完整指南

本指南介绍如何在不安装 Android Studio 的情况下，使用 GitHub Actions 自动构建 hplayer 的 release APK。

---

## 目录

1. [流程概览](#流程概览)
2. [生成 GitHub Personal Access Token](#生成-github-personal-access-token)
3. [本地生成签名文件](#本地生成签名文件)
4. [配置 GitHub Secrets](#配置-github-secrets)
5. [触发构建](#触发构建)
6. [下载 APK](#下载-apk)
7. [常见问题](#常见问题)

---

## 流程概览

```text
本地生成 release.keystore
        ↓
base64 编码后复制内容
        ↓
在 GitHub 仓库添加 4 个 Repository Secrets
        ↓
push 代码或手动触发 Actions
        ↓
在 Actions 运行详情页下载 hplayer-release-apk Artifact
        ↓
解压得到 app-release.apk
```

---

## 生成 GitHub Personal Access Token

GitHub Actions 工作流本身不需要你的 PAT 来运行，但如果你需要从本地推送 `.github/workflows` 目录下的工作流文件到仓库，则 PAT 必须具备 `workflow` 权限。

### 方式一：Fine-grained personal access tokens（推荐）

1. 打开 [GitHub Settings → Developer settings → Personal access tokens → Fine-grained tokens](https://github.com/settings/personal-access-tokens)
2. 点击 **Generate new token**
3. **Token name**：例如 `hplayer-actions-token`
4. **Expiration**：按需设置，建议 90 天或更久
5. **Resource owner**：选择你的账号 `isumh`
6. **Repository access**：选择 **Only select repositories**，勾选 `isumh/hplayer`
7. **Permissions → Repository permissions**：

| 权限 | 级别 | 说明 |
| --- | --- | --- |
| **Contents** | Read and write | 读写仓库代码 |
| **Metadata** | Read | 读取仓库元数据（默认必须） |
| **Actions** | Read and write | 允许手动触发工作流 |
| **Workflows** | Read and write | 允许修改 `.github/workflows` 文件 |

8. 点击 **Generate token**，复制生成的 token 并妥善保存。

### 方式二：Classic personal access tokens

1. 打开 [GitHub Settings → Developer settings → Personal access tokens → Tokens (classic)](https://github.com/settings/tokens)
2. 点击 **Generate new token (classic)**
3. **Note**：例如 `hplayer-actions-token`
4. **Expiration**：按需设置
5. **Select scopes**：勾选
   - `repo` — 完全控制私有仓库
   - `workflow` — 更新 GitHub Actions 工作流
6. 点击 **Generate token**，复制并保存。

### 使用 Token 推送代码

如果你本地 push 时遇到权限问题，可以用 token 作为一次性 URL：

```bash
git push https://<YOUR_TOKEN>@github.com/isumh/hplayer.git feat/hplayer-v1.0-mvp
```

---

## 本地生成签名文件

Android release APK 必须使用同一个签名文件进行签名，否则后续升级会失败。请妥善保管签名文件。

### 1. 进入目录

```bash
cd apps/hplayer_android/android/app
```

### 2. 生成 keystore

示例密码为 `public`，别名为 `hplayer`，有效期 100,000 天：

```bash
keytool -genkey -v \
  -keystore release.keystore \
  -alias hplayer \
  -keyalg RSA \
  -keysize 2048 \
  -validity 100000 \
  -storepass public \
  -keypass public \
  -dname "CN=hplayer"
```

执行后会生成：`apps/hplayer_android/android/app/release.keystore`

### 3. 转为 base64

GitHub Secrets 不能直接上传二进制文件，需要将 keystore 转为 base64 字符串。

```bash
# macOS / Linux
base64 -i release.keystore -o release.keystore.b64

# 查看内容
open release.keystore.b64
```

或者直接在终端输出：

```bash
base64 release.keystore | tr -d '\n'
```

复制输出的全部内容（通常很长，几百到几千字符）。

### 4. 保存本地备份

```bash
# 建议把 release.keystore 备份到安全位置，例如密码管理器或加密 U 盘
# 不要把它提交到 Git
```

> 警告：`release.keystore` 是你的应用签名私钥，泄露后他人可以用你的签名发布伪装应用。丢失后你无法再用同一签名升级 APK。

---

## 配置 GitHub Secrets

本项目的 Actions 工作流没有指定 `environment`，因此使用 **Repository secrets**（仓库级 Secrets）。

### 进入 Secrets 页面

打开：

```text
https://github.com/isumh/hplayer/settings/secrets/actions
```

点击 **New repository secret**。

### 添加 4 个 Secrets

| Secret name | Value |
| --- | --- |
| `RELEASE_KEYSTORE` | 上一步 base64 编码后的完整字符串 |
| `RELEASE_STORE_PASSWORD` | 你的密钥库密码，例如 `public` |
| `RELEASE_KEY_ALIAS` | 你的别名，例如 `hplayer` |
| `RELEASE_KEY_PASSWORD` | 你的别名密码，例如 `public` |

添加完成后，Secrets 列表应类似：

```text
RELEASE_KEYSTORE          Updated now
RELEASE_STORE_PASSWORD    Updated now
RELEASE_KEY_ALIAS         Updated now
RELEASE_KEY_PASSWORD      Updated now
```

---

## 触发构建

配置完 Secrets 后，可以通过以下任意方式触发构建：

### 方式一：push 代码自动触发

向 `main`、`master` 或 `feat/**` 分支推送任意提交：

```bash
git add .
git commit -m "ci: trigger apk build"
git push origin feat/hplayer-v1.0-mvp
```

### 方式二：手动触发

1. 打开 [Actions 页面](https://github.com/isumh/hplayer/actions/workflows/build-apk.yml)
2. 选择 **Build Android APK**
3. 点击右侧 **Run workflow**
4. 选择分支，点击 **Run workflow**

---

## 下载 APK

### 从运行详情页下载

1. 打开 [Actions 页面](https://github.com/isumh/hplayer/actions/workflows/build-apk.yml)
2. 点击最近一次成功的运行记录
3. 滚动到页面底部 **Artifacts**
4. 点击 **`hplayer-release-apk`** 下载

### 下载后使用

下载得到的是一个 zip 文件，解压后得到：

```text
app-release.apk
```

直接安装到 Android 手机即可。

---

## 常见问题

### 1. 报错 `Keystore file ... not found`

通常是 `RELEASE_STORE_FILE` 路径配置错误。本工作流中已固定为 `release.keystore`，keystore 解码后位于：

```text
apps/hplayer_android/android/app/release.keystore
```

请确保没有手动修改工作流中的路径。

### 2. 报错 `refusing to allow a Personal Access Token to create or update workflow`

说明 PAT 缺少 `workflow` 权限。请按上文重新生成 Fine-grained 或 Classic PAT，并勾选 Workflows / `workflow`。

### 3. 报错 `Permission denied` 或 `403`

- 检查 PAT 是否过期
- 检查 PAT 是否对 `isumh/hplayer` 仓库有写入权限
- 检查是否配置的是 Repository secrets 而非 Environment secrets

### 4. 日志里有 Node 20 deprecation 警告

GitHub 正在逐步弃用 Node 20，runner 会自动使用 Node 24。这些警告不影响 APK 构建和上传，可以忽略。

---

## 相关文件

- 工作流定义：[`.github/workflows/build-apk.yml`](../.github/workflows/build-apk.yml)
- Android 构建配置：[`apps/hplayer_android/android/app/build.gradle`](../apps/hplayer_android/android/app/build.gradle)
