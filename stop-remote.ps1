# 停止 Cloudflare Quick Tunnel
$root = Split-Path -Parent $MyInvocation.MyCommand.Path
$pidFile = Join-Path $root 'data\tunnel.pid'
$urlFile = Join-Path $root 'data\tunnel.url'

if (-not (Test-Path $pidFile)) {
  Write-Host '没有隧道 pid 文件；可能本来就没在跑。'
  exit 0
}

$raw = (Get-Content -Raw $pidFile).Trim()
if ($raw -match '^\d+$') {
  $process = Get-Process -Id ([int]$raw) -ErrorAction SilentlyContinue
  if ($process) {
    Stop-Process -Id $process.Id -Force
    Write-Host "已停止隧道 pid=$($process.Id)"
  } else {
    Write-Host "隧道进程 $raw 已经不在了"
  }
}

Remove-Item -LiteralPath $pidFile -Force -ErrorAction SilentlyContinue
Remove-Item -LiteralPath $urlFile -Force -ErrorAction SilentlyContinue
