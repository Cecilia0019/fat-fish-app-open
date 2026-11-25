@echo off
chcp 65001 >nul
cd /d "%~dp0"
title 大肥鱼 · 启动网关和隧道
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0start-all.ps1"
echo.
echo 网关和隧道已启动；这个窗口可以关掉。
echo 如果手机还是连不上，重新打开这个脚本，会生成新的隧道地址。
pause
