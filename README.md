# 大肥鱼 App · z0.1.0（开源版）

> 一个 QQ 风格的手机聊天前端。它只负责“门”：把你手机上的话送进你自己的 AIS（DeepSeek Harness / SurfCore / 其他兼容桥接），再把她的回复带回来。
>
> 这个仓库不包含任何人的账号、令牌、域名、聊天记录、记忆或角色图。角色、人格、记忆都留在你自己的服务器上。

这是 **第四版的公开清洗快照**，重新命名为 **z0.1.0**。

## 它是什么

- 手机网页 / PWA / Android WebView App；
- QQ 风格聊天页：左右气泡、头像、长按菜单、图片、表情；
- 表情与图片库（独立存储，支持上传/收藏/联网收集）；
- 聊天记录搜索与回跳；
- 语音朗读（Windows 中文 TTS）+ 浏览器/Android 原生语音输入；
- 「她的主页」可显示可选的 DeepSeek 余额和每日花费；
- 「我的主页」换头像、昵称、自定义表情。

它 **不包含** 模型、人格、记忆、QQ 协议或任何 API Key。

## 前置条件

- Windows 10/11（当前实现使用 Windows 语音与 PowerShell）；
- Node.js **>= 22**；
- 一个可用的 **SurfCore / DSH 桥接**，提供 `POST /api/app/ask`；
- 可选：`ffmpeg`（语音合成）；`cloudflared`（跨网络 Quick Tunnel）。

## 快速开始

```powershell
# 1. 进入项目目录
cd fat-fish-app-open

# 2. 准备桥接令牌（二选一）
#    a) 写入文件
#       data\bridge-token.txt  <- 你的 SurfCore state/console-token 内容
#    b) 或设置环境变量
$env:BRIDGE_TOKEN = "你的桥接令牌"
$env:BRIDGE_URL   = "http://127.0.0.1:3100"

# 3. 启动
powershell -ExecutionPolicy Bypass -File .\start-app.ps1
```

启动日志会打印本机地址和自动生成的 App 访问令牌：

```text
http://127.0.0.1:8787/?token=...
```

手机在同一 Wi-Fi 下用日志里的局域网地址打开（需要 `--lan`；`start-app.ps1` 已经带）。

## 桥接：`/api/app/ask`

这个 App 的网关只调用一个接口：

```http
POST http://127.0.0.1:3100/api/app/ask
x-console-token: <你的桥接令牌>
content-type: application/json

{ "text": "你好", "image": { "mimeType": "image/jpeg", "data": "<base64>" } }
```

返回：

```json
{ "ok": true, "reply": "她的话", "sentByTool": false }
```

`patches/` 里有针对某一版 SurfCore 的参考补丁，用于把 `/api/app/ask` 加进桥接：

- `surfcore-app-endpoint.patch`
- `surfcore-app-v2-image.patch`

> 补丁是参考实现，不是对所有 SurfCore 版本都保证能直接 apply。请先看 diff、在自己的 SurfCore 分支上手动合，或按上面的契约实现自己的桥接适配层。App 本身不绑定某个人的桥接源码。

## 可选：DeepSeek 余额 / 每日花费

第四版「她的主页」支持读取 DeepSeek 平台余额。这个功能需要你本机的平台凭据，不在仓库里：

```powershell
$env:DEEPSEEK_GRANT_FILE = "C:\path\to\your\credentials.yaml"
```

不配置也能正常聊天，主页会显示“未配置余额”。

## 跨网络

项目只带 **Cloudflare Quick Tunnel** 脚本（免费、无需账号，但每次重启 URL 会变）：

```powershell
# 把 cloudflared.exe 放到 bin\cloudflared.exe
powershell -ExecutionPolicy Bypass -File .\start-remote.ps1
```

它会生成一个 `https://<随机>.trycloudflare.com/?token=...` 地址。长期固定入口请用自己的命名 Tunnel / Tailscale / 反向代理；本项目不提供任何固定域名。

## Android App

`mobile/android` 是一个轻量 WebView 壳（包名 `com.fatfish.app`，无第三方依赖）。

- 已发布 Release 里的 `fat-fish-app-open-z0.1.0-debug.apk` 可直接安装；
- 第一次打开填你的地址（含 `?token=`）；
- 设置 → 更换服务器地址可重新配置；
- 自己构建：Android Studio 打开 `mobile/android`，或使用 `.github/workflows/android.yml`。

App 不内置任何人的服务器地址或令牌。

## 目录

```text
server.mjs              本地网关：静态页 + API + SSE + 历史
public/                 聊天页、头像、背景、内置表情
  stickers/             12 张通用内置表情
mobile/android/         Android WebView 壳
patches/                SurfCore 参考补丁（可选）
scripts/                启动、测试、截图、TTS 辅助脚本
data/                   运行时生成：令牌、账本、图片、语音（不提交）
```

运行后生成：

```text
data/token.txt          App 访问令牌
data/messages.jsonl     聊天账本
data/media/             聊天图片
data/library/           表情与图片库
data/voice/             语音缓存
```

## 安全与隐私

- App 访问令牌在 `data/token.txt`，等价于“以你的身份聊天”，不要发到公开群；
- 桥接令牌（`data/bridge-token.txt` / `BRIDGE_TOKEN`）也不要提交；
- `data/` 已在 `.gitignore`；
- 这个仓库**没有遥测、没有分析、没有云端账号**；
- 公网入口需要自己负责鉴权、TLS 和访问控制；
- 不要用这个项目冒充他人或绕过平台规则。

## 已知边界

- 这是第四版快照，不包含第五版的 QQ 同款 voxd 语音、App 内更新和自主定时收集；这些是私有环境的后续改动，开源版没有。
- 语音输入依赖浏览器的 Web Speech 或 Android 系统识别；部分 WebView 不支持。
- 「她的主页」余额功能需要自备 DeepSeek 平台凭据；没有配置就显示不可用。
- SurfCore 补丁只针对一种版本结构；不同版本需要自己适配。
- 没有内置任何角色素材；请使用自己的角色/头像/背景。

## License

MIT。见 [LICENSE](LICENSE)。
