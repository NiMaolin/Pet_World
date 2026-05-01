// Playwright 安装脚本
const { execSync } = require('child_process');
const path = require('path');

const NODE_PATH = 'C:\\Program Files\\QClaw\\resources\\node\\node.exe';
const PROJECT_DIR = 'D:\\youxi-ts\\pet';

console.log('安装 Playwright 浏览器...');

// 使用 node 直接运行 playwright 的安装
try {
  const result = execSync(
    `"${NODE_PATH}" "${path.join(PROJECT_DIR, 'node_modules', '@playwright', 'test', 'node_modules', 'playwright', 'index.js')}" install chromium`,
    { 
      cwd: PROJECT_DIR,
      env: { ...process.env, PATH: 'C:\\Program Files\\QClaw\\resources\\node;' + process.env.PATH },
      stdio: 'inherit'
    }
  );
  console.log('安装完成');
} catch (e) {
  console.error('安装失败:', e.message);
}
