@echo off
chcp 65001 >nul
echo ========================================
echo  Playwright 测试环境检查
echo ========================================

echo.
echo 检查 Node.js...
node --version >nul 2>&1
if %errorlevel% neq 0 (
    echo [错误] 未找到 Node.js
    echo 请先安装 Node.js: https://nodejs.org/
    pause
    exit /b 1
)
echo [OK] Node.js 已安装

echo.
echo 检查 npm...
npm --version >nul 2>&1
if %errorlevel% neq 0 (
    echo [错误] 未找到 npm
    echo 请重新安装 Node.js
    pause
    exit /b 1
)
echo [OK] npm 已安装

echo.
echo 检查 Playwright...
npm list @playwright/test >nul 2>&1
if %errorlevel% neq 0 (
    echo [提示] 正在安装 Playwright...
    npm install -D @playwright/test
)

echo.
echo ========================================
echo 环境检查完成！
echo ========================================
echo.
echo 运行测试:
echo   1. 确保 Vite 开发服务器正在运行: npm run dev
echo   2. 运行测试: npx playwright test
echo.
pause
