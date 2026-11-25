# 在后台启动大肥鱼手机端（不弹窗），日志写到 data\app.out.log
$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location -LiteralPath $root

$pidFile = Join-Path $root 'data\app.pid'
if (Test-Path $pidFile) {
  $old = (Get-Content -Raw $pidFile).Trim()
  if ($old -match '^\d+$' -and (Get-Process -Id ([int]$old) -ErrorAction SilentlyContinue)) {
    Write-Host "已经在跑，pid=$old"
    Write-Host "打开：http://127.0.0.1:8787/"
    exit 0
  }
}

$node = (Get-Command node -ErrorAction Stop).Source
$out = Join-Path $root 'data\app.out.log'
$err = Join-Path $root 'data\app.err.log'
$process = Start-Process -FilePath $node -ArgumentList @('server.mjs', '--lan') `
  -WorkingDirectory $root -WindowStyle Hidden -PassThru `
  -RedirectStandardOutput $out -RedirectStandardError $err

$process.Id | Set-Content -LiteralPath $pidFile -Encoding ascii

Start-Sleep -Seconds 2
$token = (Get-Content -Raw (Join-Path $root 'data\token.txt')).Trim()
$ips = Get-NetIPAddress -AddressFamily IPv4 -ErrorAction SilentlyContinue |
  Where-Object { $_.IPAddress -notlike '127.*' -and $_.IPAddress -notlike '169.254.*' } |
  Select-Object -ExpandProperty IPAddress -Unique

Write-Host "已启动，pid=$($process.Id)"
Write-Host "本机：http://127.0.0.1:8787/?token=$token"
foreach ($ip in $ips) { Write-Host "手机：http://$ip`:8787/?token=$token" }
Write-Host "日志：$out"
