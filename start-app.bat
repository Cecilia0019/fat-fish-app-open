@echo off
chcp 65001 >nul
cd /d "%~dp0"
title 大肥鱼 · 手机端
echo.
echo   大肥鱼 · 手机端 v0.1
echo   关闭这个窗口就会停止服务。
echo.
node server.mjs --lan
echo.
echo   服务已退出。
pause
