// 安装依赖脚本
const { execSync, spawn } = require('child_process');
const path = require('path');
const fs = require('fs');

// 设置路径
const NODE_PATH = 'C:\\Program Files\\QClaw\\resources\\node\\node.exe';
const PROJECT_DIR = 'D:\\youxi-ts\\pet';

// 切换到项目目录
process.chdir(PROJECT_DIR);

// 更新 PATH
process.env.PATH = NODE_PATH + ';' + process.env.PATH;

console.log('=== 安装依赖 ===\n');

// 1. 检查 Node.js
console.log('Node.js 版本:');
try {
  const nodeVersion = execSync(`${NODE_PATH} --version`, { encoding: 'utf8' });
  console.log(nodeVersion);
} catch (e) {
  console.error('Node.js 未找到');
  process.exit(1);
}

// 2. 检查 npm
console.log('\nnpm 版本:');
try {
  const npmVersion = execSync(`${NODE_PATH} -e "console.log(require('npm/package.json').version)"`, { encoding: 'utf8' });
  console.log(npmVersion);
} catch (e) {
  console.log('npm 未内置于 Node.js');
  console.log('使用 pnpm...\n');
  
  // 3. 使用 pnpm 安装
  const pnpmPath = 'C:\\Users\\86134\\AppData\\Local\\pnpm\\.tools\\pnpm-exe\\10.33.2\\pnpm.exe';
  
  console.log('pnpm 版本:');
  try {
    const pnpmVersion = execSync(`"${pnpmPath}" --version`, { encoding: 'utf8' });
    console.log(pnpmVersion);
  } catch (e) {
    console.error('pnpm 未找到');
    process.exit(1);
  }
  
  console.log('\n正在安装依赖...');
  try {
    execSync(`"${pnpmPath}" install`, { 
      stdio: 'inherit',
      env: process.env
    });
  } catch (e) {
    console.error('安装失败');
    process.exit(1);
  }
  
  console.log('\n正在安装 Playwright...');
  try {
    execSync(`"${pnpmPath}" add -D @playwright/test playwright`, { 
      stdio: 'inherit',
      env: process.env
    });
  } catch (e) {
    console.error('Playwright 安装失败');
  }
  
  // 4. 安装 Playwright 浏览器
  console.log('\n正在安装 Playwright Chromium 浏览器...');
  const playwrightPath = 'D:\\youxi-ts\\pet\\node_modules\\.pnpm\\playwright-core@1.59.1\\node_modules\\playwright-core\\cli.js';
  if (fs.existsSync(playwrightPath)) {
    try {
      execSync(`"${NODE_PATH}" "${playwrightPath}" install chromium`, { 
        stdio: 'inherit',
        env: process.env
      });
    } catch (e) {
      console.error('浏览器安装失败');
    }
  } else {
    console.log('Playwright 未正确安装，跳过浏览器安装');
  }
}

console.log('\n=== 安装完成 ===\n');

// 5. 启动开发服务器
console.log('启动开发服务器...');
const devProcess = spawn(NODE_PATH, ['-e', `
  const {spawn} = require('child_process');
  const pnpmPath = 'C:\\\\Users\\\\86134\\\\AppData\\\\Local\\\\pnpm\\\\.tools\\\\pnpm-exe\\\\10.33.2\\\\pnpm.exe';
  const dev = spawn(pnpmPath, ['run', 'dev'], {cwd: 'D:\\\\youxi-ts\\\\pet', stdio: 'inherit'});
`], { 
  stdio: 'inherit',
  detached: true,
  env: process.env
});

// 等待服务器启动
console.log('等待服务器启动...');
setTimeout(() => {
  console.log('\n=== 运行测试 ===\n');
  
  // 6. 运行 Playwright 测试
  const testScript = `
    const {spawn} = require('child_process');
    const pnpmPath = 'C:\\\\Users\\\\86134\\\\AppData\\\\Local\\\\pnpm\\\\.tools\\\\pnpm-exe\\\\10.33.2\\\\pnpm.exe';
    const test = spawn(pnpmPath, ['exec', 'playwright', 'test', 'tests/loot-rotate.spec.ts', '--reporter=list'], {
      cwd: 'D:\\\\youxi-ts\\\\pet',
      stdio: 'inherit'
    });
  `;
  
  try {
    execSync(`${NODE_PATH} -e "${testScript.replace(/"/g, '\\"').replace(/\n/g, ' ')}"`, {
      stdio: 'inherit',
      env: process.env
    });
  } catch (e) {
    console.error('测试运行失败');
  }
}, 5000);
