@echo off
chcp 65001 >nul
set PATH=C:\Program Files\QClaw\resources\node;%PATH%

cd /d D:\youxi-ts\pet

echo Node version:
node --version
echo.

echo 正在安装 Playwright Chromium 浏览器...
node node_modules/@playwright/test/node_modules/playwright-core/cli.js install chromium