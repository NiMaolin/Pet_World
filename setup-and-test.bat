@echo off
chcp 65001 >nul
set PATH=C:\Program Files\QClaw\resources\node;%PATH%

cd /d D:\youxi-ts\pet

echo ========== 步骤 1: 安装依赖 ==========
call pnpm install
if %errorlevel% neq 0 (
    echo [失败] pnpm install 失败
    goto :end
)

echo.
echo ========== 步骤 2: 安装 Playwright ==========
call pnpm add -D @playwright/test playwright
if %errorlevel% neq 0 (
    echo [失败] Playwright 安装失败
    goto :end
)

echo.
echo ========== 步骤 3: 安装 Chromium ==========
call install-browser.bat
if %errorlevel% neq 0 (
    echo [失败] Chromium 安装失败
    goto :end
)

echo.
echo ========== 步骤 4: 启动开发服务器 ==========
start /B pnpm run dev

echo 等待 5 秒让服务器启动...
timeout /t 5 /nobreak >nul

echo.
echo ========== 步骤 5: 运行测试 ==========
call pnpm exec playwright test tests/loot-rotate.spec.ts --reporter=list

:end
echo.
echo 完成！
pause