# 启动跨网络入口：Cloudflare Quick Tunnel -> 本机 8787
# 免费、无需账号；URL 每次启动会变。长期稳定请用 Tailscale 或命名 Tunnel。
$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location -LiteralPath $root

$exe = Join-Path $root 'bin\cloudflared.exe'
if (-not (Test-Path $exe)) {
  Write-Host "缺少 bin\cloudflared.exe。"
  Write-Host "下载：https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-windows-amd64.exe"
  exit 1
}

$pidFile = Join-Path $root 'data\tunnel.pid'
$urlFile = Join-Path $root 'data\tunnel.url'
$out = Join-Path $root 'data\tunnel.out.log'
$err = Join-Path $root 'data\tunnel.err.log'

if (Test-Path $pidFile) {
  $old = (Get-Content -Raw $pidFile).Trim()
  if ($old -match '^\d+$' -and (Get-Process -Id ([int]$old) -ErrorAction SilentlyContinue)) {
    $url = if (Test-Path $urlFile) { (Get-Content -Raw $urlFile).Trim() } else { '' }
    Write-Host "隧道已经在跑，pid=$old"
    if ($url) { Write-Host "地址：$url" }
    exit 0
  }
}

try {
  $health = Invoke-RestMethod -Uri 'http://127.0.0.1:8787/api/health' -TimeoutSec 4
  if (-not $health.ok) { throw 'health not ok' }
} catch {
  Write-Host '本机网关没在跑。先运行 start-app.ps1。'
  exit 1
}

function Test-PublicHealth([string]$url) {
  for ($i = 0; $i -lt 6; $i++) {
    Start-Sleep -Seconds 3
    $code = (& curl.exe -s --ssl-no-revoke --max-time 10 -o NUL -w '%{http_code}' "$url/api/health").Trim()
    if ($code -eq '200') { return $true }
  }
  return $false
}

$publicUrl = ''
$process = $null
for ($attempt = 1; $attempt -le 3; $attempt++) {
  Remove-Item -LiteralPath $out, $err -Force -ErrorAction SilentlyContinue
  $process = Start-Process -FilePath $exe `
    -ArgumentList @('tunnel', '--url', 'http://127.0.0.1:8787', '--no-autoupdate') `
    -WorkingDirectory $root -WindowStyle Hidden -PassThru `
    -RedirectStandardOutput $out -RedirectStandardError $err

  $candidate = ''
  for ($i = 0; $i -lt 45; $i++) {
    Start-Sleep -Seconds 1
    if (Test-Path $err) {
      $text = Get-Content -Raw $err -ErrorAction SilentlyContinue
      $match = [regex]::Match($text, 'https://[a-z0-9-]+\.trycloudflare\.com')
      if ($match.Success) {
        $candidate = $match.Value
        break
      }
    }
    if (-not (Get-Process -Id $process.Id -ErrorAction SilentlyContinue)) { break }
  }

  if ($candidate -and (Test-PublicHealth $candidate)) {
    $publicUrl = $candidate
    break
  }

  Write-Host "第 $attempt 次隧道没有可用地址，重试…"
  if ($process -and (Get-Process -Id $process.Id -ErrorAction SilentlyContinue)) {
    Stop-Process -Id $process.Id -Force -ErrorAction SilentlyContinue
  }
  Start-Sleep -Seconds 2
}

if (-not $publicUrl) {
  Write-Host '三次都没拿到可用的公网地址。看日志：'
  if (Test-Path $err) { Get-Content -Tail 30 $err }
  exit 1
}

$process.Id | Set-Content -LiteralPath $pidFile -Encoding ascii
$token = (Get-Content -Raw (Join-Path $root 'data\token.txt')).Trim()
$full = "$publicUrl/?token=$token"
$full | Set-Content -LiteralPath $urlFile -Encoding utf8

Write-Host "跨网络地址：$full"
Write-Host "本机地址：http://127.0.0.1:8787/?token=$token"
Write-Host "隧道日志：$err"
Write-Host ''
Write-Host '注意：这是公网 HTTPS 地址，拿到链接的人也需要令牌；不要把链接发到公开群。'
