# 开源清洗审计 · z0.1.0

本仓库是第四版的公开清洗快照，只保留可复用的客户端代码、界面、表情库、聊天记录、语音和 Android 壳。

## 从私有环境删除/替换的内容

- 个人角色封面、头像、启动图 → 通用鱼图标 `fish-cover.png` / `fish-avatar.png`；
- 个人固定 Tunnel 配置、域名、Tunnel 名称、证书路径和守护脚本 → 全部移除；只保留通用 Quick Tunnel 脚本；
- 个人绝对路径、用户目录、DSH 凭据路径、桥接令牌路径 → 改为环境变量/`data/bridge-token.txt`；
- 个人 DeepSeek 余额凭据路径 → 改为可选 `DEEPSEEK_GRANT_FILE`，不配置就不启用余额；
- 私有仓、私有 Release、私有版本页的链接 → 删除或改写为本仓库/通用说明；
- Android 包名中的个人标识 → `com.fatfish.app`；版本改为 `z0.1.0`；
- 个人昵称硬编码 → `FISH_NAME` 环境变量，默认“大肥鱼”。

## 二进制/文本检查

- 仓库不包含 `data/`、令牌、聊天账本、图片库、语音缓存或 APK 二进制；
- 不包含 API Key、Tunnel Token、桥接令牌、私钥；
- 不包含个人邮箱、QQ 号、域名、隧道 UUID；
- 所有图片为通用占位图或通用内置表情；
- 只从第四版快照新建 git 历史，不复制原仓库历史。

## 仍需用户自己配置

- `data/bridge-token.txt` 或 `BRIDGE_TOKEN`：桥接令牌；
- `BRIDGE_URL`：桥接地址；
- 可选 `DEEPSEEK_GRANT_FILE`：余额功能；
- 自己的角色/头像/背景/记忆都在用户自己的 DSH/SurfCore 里，不在本仓库。

## 验证

- `node --check server.mjs`、`node --check public/app.js`；
- `python scripts/check-dom.py`；
- 空数据目录启动后 `/api/health` 正常；
- 静态页、通用图标、登录/聊天壳体可打开；
- 文本扫描无个人路径/域名/账号/令牌。
