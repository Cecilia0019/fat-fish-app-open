# bin

`start-remote.ps1` 需要 `bin\cloudflared.exe`，但它约 55 MB，不放进 git。

下载（官方）：

```powershell
curl.exe --ssl-no-revoke -L --fail -o bin\cloudflared.exe `
  https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-windows-amd64.exe
```

国内 GitHub 慢/被解析到 127.0.0.1 时，用镜像：

```powershell
curl.exe --ssl-no-revoke -L --fail -o bin\cloudflared.exe `
  https://ghfast.top/https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-windows-amd64.exe
```

校验：

```powershell
.\bin\cloudflared.exe --version
```

> 只从 Cloudflare 官方或你信任的镜像下载。这个二进制只用来建 tunnel，不参与聊天逻辑。
