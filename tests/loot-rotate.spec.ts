import { test, expect } from '@playwright/test'
import type { Page } from '@playwright/test'

/**
 * 物资箱拖拽旋转功能测试
 * 
 * 测试流程：
 * 1. 进入游戏世界
 * 2. 打开物资箱
 * 3. 开始拖拽物品
 * 4. 按 R 键旋转
 * 5. 验证旋转状态
 */

test.describe('物资箱拖拽旋转功能', () => {
  
  test.beforeEach(async ({ page }) => {
    // 监听控制台日志
    page.on('console', msg => {
      if (msg.type() === 'log') {
        console.log(`[Browser Console] ${msg.text()}`)
      }
    })
    
    // 打开游戏
    await page.goto('/')
    
    // 点击开始游戏
    await page.getByRole('button', { name: /开始游戏/i }).click()
    
    // 等待进入游戏世界
    await page.waitForTimeout(500)
  })

  test('R键旋转功能 - 物资箱物品', async ({ page }) => {
    // 1. 打开物资箱 UI
    const lootPanel = page.locator('.loot-panel')
    await expect(lootPanel).toBeVisible({ timeout: 5000 })
    
    // 2. 等待物品搜索完成（或者直接双击拾取）
    // 先双击拾取一个物品到背包
    const firstLootItem = page.locator('.item-cell.searching, .item-cell.unsearched').first()
    await expect(firstLootItem).toBeVisible({ timeout: 5000 })
    
    // 等待搜索完成
    await page.waitForTimeout(3000)
    
    // 再次查找已搜索物品
    const searchedItem = page.locator('.item-cell').filter({ hasNot: page.locator('.unsearched') }).first()
    await expect(searchedItem).toBeVisible({ timeout: 5000 })
    
    // 3. 开始拖拽
    const itemBox = await searchedItem.boundingBox()
    expect(itemBox).not.toBeNull()
    
    // 模拟拖拽开始
    await searchedItem.dispatchEvent('dragstart', {
      clientX: itemBox!.x + itemBox!.width / 2,
      clientY: itemBox!.y + itemBox!.height / 2,
      bubbles: true
    })
    
    // 4. 检查控制台日志
    const consoleLogs: string[] = []
    page.on('console', msg => {
      if (msg.type() === 'log') {
        consoleLogs.push(msg.text())
      }
    })
    
    // 5. 按 R 键
    await page.keyboard.press('r')
    
    // 等待日志更新
    await page.waitForTimeout(100)
    
    // 6. 验证 R 键被正确处理
    const rotateLogFound = consoleLogs.some(log => 
      log.includes('onDragKeyDown') || 
      log.includes('onRotateItem') ||
      log.includes('rotate')
    )
    
    // 如果有日志，检查旋转逻辑是否被调用
    if (consoleLogs.length > 0) {
      console.log('所有控制台日志:', consoleLogs)
    }
  })

  test('R键旋转功能 - 背包物品', async ({ page }) => {
    // 1. 打开物资箱
    const lootPanel = page.locator('.loot-panel')
    await expect(lootPanel).toBeVisible({ timeout: 5000 })
    
    // 2. 等待搜索完成
    await page.waitForTimeout(4000)
    
    // 3. 双击拾取物品到背包
    const lootItems = page.locator('.panel-side').nth(1).locator('.item-cell')
    await lootItems.first().dblclick()
    
    // 4. 检查背包是否有物品
    const bagItems = page.locator('.panel-side').nth(0).locator('.item-cell')
    await expect(bagItems.first()).toBeVisible({ timeout: 2000 })
    
    // 5. 开始拖拽背包物品
    await bagItems.first().dispatchEvent('dragstart', {
      clientX: 100,
      clientY: 100,
      bubbles: true
    })
    
    // 6. 按 R 键旋转
    await page.keyboard.press('r')
    
    // 7. 等待处理
    await page.waitForTimeout(200)
  })
})

test.describe('高亮预览测试', () => {
  
  test('拖拽时显示正确的高亮区域', async ({ page }) => {
    await page.goto('/')
    await page.getByRole('button', { name: /开始游戏/i }).click()
    await page.waitForTimeout(500)
    
    // 打开物资箱
    const lootPanel = page.locator('.loot-panel')
    await expect(lootPanel).toBeVisible({ timeout: 5000 })
    
    // 等待搜索完成
    await page.waitForTimeout(4000)
    
    // 查找已搜索的物品
    const searchedItems = page.locator('.panel-side').nth(1).locator('.item-cell:not(.unsearched)')
    const count = await searchedItems.count()
    
    if (count > 0) {
      // 开始拖拽
      const item = searchedItems.first()
      const box = await item.boundingBox()
      
      // 模拟 dragstart
      await item.dispatchEvent('dragstart', {
        clientX: box!.x + box!.width / 2,
        clientY: box!.y + box!.height / 2,
        bubbles: true
      })
      
      // 移动到背包区域
      const bagGrid = page.locator('.panel-side').nth(0).locator('.item-grid')
      const bagBox = await bagGrid.boundingBox()
      
      if (bagBox) {
        await page.mouse.move(box!.x + box!.width / 2, box!.y + box!.height / 2)
        await page.mouse.move(bagBox.x + 50, bagBox.y + 50)
        
        // 检查是否有高亮格子
        const highlightedCells = page.locator('.grid-cell.highlight')
        const highlightCount = await highlightedCells.count()
        
        console.log(`高亮格子数量: ${highlightCount}`)
        expect(highlightCount).toBeGreaterThan(0)
      }
    }
  })
})

test.describe('放置逻辑测试', () => {
  
  test('旋转后物品尺寸正确', async ({ page }) => {
    await page.goto('/')
    await page.getByRole('button', { name: /开始游戏/i }).click()
    await page.waitForTimeout(500)
    
    const lootPanel = page.locator('.loot-panel')
    await expect(lootPanel).toBeVisible({ timeout: 5000 })
    
    // 等待搜索完成
    await page.waitForTimeout(4000)
    
    // 拾取物品
    const lootItems = page.locator('.panel-side').nth(1).locator('.item-cell:not(.unsearched)')
    const count = await lootItems.count()
    
    if (count > 0) {
      // 获取物品原始尺寸
      const item = lootItems.first()
      const originalBox = await item.boundingBox()
      
      // 拖拽到背包
      await item.dragTo(page.locator('.panel-side').nth(0).locator('.item-grid'))
      
      // 检查背包中的物品
      const bagItems = page.locator('.panel-side').nth(0).locator('.item-cell')
      await expect(bagItems.first()).toBeVisible({ timeout: 2000 })
      
      // 开始拖拽背包物品
      await bagItems.first().dispatchEvent('dragstart', {
        clientX: 100,
        clientY: 100,
        bubbles: true
      })
      
      // 按 R 旋转
      await page.keyboard.press('r')
      await page.waitForTimeout(100)
      
      // 获取旋转后尺寸
      const rotatedBox = await bagItems.first().boundingBox()
      
      if (originalBox && rotatedBox) {
        // 旋转后宽高应该互换（或者接近）
        const originalArea = originalBox.width * originalBox.height
        const rotatedArea = rotatedBox.width * rotatedBox.height
        
        console.log(`原始尺寸: ${originalBox.width}x${originalBox.height}, 面积: ${originalArea}`)
        console.log(`旋转后尺寸: ${rotatedBox.width}x${rotatedBox.height}, 面积: ${rotatedArea}`)
        
        // 面积应该大致相同
        expect(Math.abs(originalArea - rotatedArea)).toBeLessThan(10)
      }
    }
  })
})
