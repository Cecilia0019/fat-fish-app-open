# 停止后台运行的大肥鱼手机端
$root = Split-Path -Parent $MyInvocation.MyCommand.Path
$pidFile = Join-Path $root 'data\app.pid'
if (-not (Test-Path $pidFile)) {
  Write-Host '没有 pid 文件；可能本来就没在跑。'
  exit 0
}
$raw = (Get-Content -Raw $pidFile).Trim()
if ($raw -notmatch '^\d+$') {
  Write-Host "pid 文件内容不对：$raw"
  exit 1
}
$process = Get-Process -Id ([int]$raw) -ErrorAction SilentlyContinue
if ($process) {
  Stop-Process -Id $process.Id -Force
  Write-Host "已停止 pid=$($process.Id)"
} else {
  Write-Host "进程 $raw 已经不在了"
}
Remove-Item -LiteralPath $pidFile -Force -ErrorAction SilentlyContinue
