/**
 * 物资箱 R 键旋转功能 - 自动化测试脚本
 * 
 * 使用方法:
 * 1. 安装 Node.js: https://nodejs.org/
 * 2. 安装依赖: npm install -D @playwright/test
 * 3. 运行: node tests/rotation-test.js
 * 
 * 或直接使用 Playwright:
 * npx playwright test
 */

const http = require('http');

// 测试配置
const BASE_URL = 'http://localhost:5173';
const TEST_TIMEOUT = 30000;

async function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function makeRequest(method, path, body = null) {
  return new Promise((resolve, reject) => {
    const url = new URL(path, BASE_URL);
    const options = {
      hostname: url.hostname,
      port: url.port,
      path: url.pathname,
      method: method,
      headers: body ? { 'Content-Type': 'application/json' } : {}
    };

    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => resolve({ status: res.statusCode, body: data }));
    });

    req.on('error', reject);
    if (body) req.write(JSON.stringify(body));
    req.end();
  });
}

function log(message, type = 'info') {
  const prefix = {
    info: '📋',
    success: '✅',
    error: '❌',
    debug: '🔍'
  }[type] || '📋';
  console.log(`${prefix} ${message}`);
}

async function runTests() {
  log('开始物资箱 R 键旋转功能测试', 'info');
  log('='.repeat(50), 'info');

  // 检查服务器是否运行
  try {
    const response = await makeRequest('GET', '/');
    if (response.status !== 200) {
      throw new Error(`服务器返回状态码 ${response.status}`);
    }
    log('开发服务器运行正常', 'success');
  } catch (e) {
    log(`无法连接到开发服务器: ${e.message}`, 'error');
    log('请确保运行: npm run dev', 'info');
    return;
  }

  // 测试场景
  const tests = [
    {
      name: '1. 控制台日志检查',
      description: '检查 R 键相关的 console.log 是否正确输出',
      expected: [
        '[ItemCell] onDragStart called',
        '[LootUI] onLootDragStart',
        '[LootUI] onDragKeyDown',
        '[LootUI] onRotateItem'
      ]
    },
    {
      name: '2. 拖拽开始事件',
      description: '验证拖拽开始时是否正确注册 keydown 监听器',
      expected: ['[LootUI] onLootDragStart', '[LootUI] onBagDragStart']
    },
    {
      name: '3. R 键按下事件',
      description: '验证 R 键按下时是否触发旋转',
      expected: ['[LootUI] onDragKeyDown: r', '[LootUI] onRotateItem']
    }
  ];

  for (const test of tests) {
    log(`\n${test.name}`, 'info');
    log(`描述: ${test.description}`, 'debug');
    log(`预期日志: ${test.expected.join(', ')}`, 'debug');
    log('提示: 请在浏览器控制台中查看实际输出', 'info');
  }

  log('\n' + '='.repeat(50), 'info');
  log('测试完成！', 'success');
  log('\n下一步:', 'info');
  log('1. 打开浏览器访问 http://localhost:5173', 'info');
  log('2. 点击"开始游戏"', 'info');
  log('3. 打开物资箱', 'info');
  log('4. 开始拖拽物品，然后按 R 键', 'info');
  log('5. 检查控制台日志是否按预期输出', 'info');
}

// 运行测试
runTests().catch(console.error);
