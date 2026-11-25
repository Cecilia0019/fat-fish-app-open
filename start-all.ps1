# 一次启动本机网关 + Cloudflare Quick Tunnel
$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location -LiteralPath $root

& (Join-Path $root 'start-app.ps1')
Write-Host ''
& (Join-Path $root 'start-remote.ps1')
