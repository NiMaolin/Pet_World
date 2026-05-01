@echo off
chcp 65001 >nul
set PATH=C:\Program Files\QClaw\resources\node;%PATH%
set PNPM_HOME=C:\Users\86134\AppData\Local\pnpm
set PATH=%PNPM_HOME%;%PATH%

cd /d D:\youxi-ts\pet
echo Node version:
node --version
echo.
echo Pnpm version:
pnpm --version
echo.
echo Installing Playwright browsers...
pnpm exec playwright install chromium