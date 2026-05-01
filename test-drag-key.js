// test-drag-key.js - 测试拖拽期间 R 键是否能触发
const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({ headless: false });
  const page = await browser.newPage();

  // 打开游戏
  await page.goto('http://localhost:5173');
  await page.waitForTimeout(1000);

  // 监听控制台消息
  page.on('console', msg => {
    console.log(`[Browser Console] ${msg.type()}: ${msg.text()}`);
  });

  // 打开物资箱
  console.log('=== Step 1: Open loot box ===');
  await page.keyboard.press('f');
  await page.waitForTimeout(500);

  // 截图看当前状态
  await page.screenshot({ path: 'test-step1-loot-open.png' });

  // 找到可拖拽的物品格子
  console.log('=== Step 2: Find draggable items ===');
  const itemCell = await page.$('.item-cell[draggable="true"]');
  if (!itemCell) {
    console.log('No draggable item found!');
    await page.screenshot({ path: 'test-no-items.png' });
    await browser.close();
    return;
  }

  const box = await itemCell.boundingBox();
  console.log('Item found at:', box);

  // 开始拖拽
  console.log('=== Step 3: Start drag ===');
  await page.mouse.move(box.x + box.width/2, box.y + box.height/2);
  await page.mouse.down();
  await page.waitForTimeout(100);

  // 拖拽到背包区域
  const bagArea = await page.$('.item-grid');
  if (bagArea) {
    const bagBox = await bagArea.boundingBox();
    console.log('Bag area found at:', bagBox);
    await page.mouse.move(bagBox.x + 100, bagBox.y + 100, { steps: 5 });
    await page.waitForTimeout(100);
  }

  // 尝试按 R 键
  console.log('=== Step 4: Press R key during drag ===');
  await page.keyboard.press('r');
  await page.waitForTimeout(200);

  // 释放
  await page.mouse.up();
  await page.waitForTimeout(500);

  // 截图最终状态
  await page.screenshot({ path: 'test-final.png' });
  console.log('=== Test complete ===');

  await browser.close();
})();
