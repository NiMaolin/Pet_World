# 物资箱拖拽旋转测试

## 安装 Playwright

```bash
# 1. 安装 Node.js (如果没有)
# 下载地址: https://nodejs.org/

# 2. 安装 Playwright
npm install -D @playwright/test

# 3. 安装浏览器
npx playwright install chromium
```

## 运行测试

```bash
# 确保开发服务器正在运行
npm run dev

# 在另一个终端运行测试
npx playwright test

# 或带 UI 运行
npx playwright test --ui
```

## 测试覆盖

1. **R键旋转功能** - 物资箱物品
2. **R键旋转功能** - 背包物品  
3. **高亮预览测试** - 拖拽时显示正确的高亮区域
4. **放置逻辑测试** - 旋转后物品尺寸正确

## 调试日志

测试会输出以下控制台日志帮助调试：

```
[ItemCell] onDragStart called, item: xxx cellType: loot
[ItemCell] emitting dragstart-item
[LootUI] onLootDragStart: xxx
[LootUI] onDragKeyDown: r dragging: xxx
[LootUI] onRotateItem: xxx
```

如果日志停在某一步，说明该步骤没有正确执行。
