@echo off
chcp 65001 >nul
set PATH=C:\Program Files\QClaw\resources\node;%PATH%

cd /d D:\youxi-ts\pet

echo 安装依赖...
node node_installer\pnpmlink.js

echo.
echo 检查 pnpm:
pnpm --version

echo.
echo 开始安装依赖:
pnpm install

echo.
echo 安装 Playwright:
pnpm add -D @playwright/test playwright

echo.
echo 安装 Playwright 浏览器:
call install-browser.bat