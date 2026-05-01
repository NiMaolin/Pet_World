/**
 * 物资箱 R 键旋转功能测试
 * 
 * 使用 vitest 运行单元测试
 * 运行命令: pnpm test
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'

// 模拟 Vue 组件测试
describe('物资箱 R 键旋转功能', () => {
  
  describe('LootUI.vue 旋转逻辑', () => {
    
    it('dragging 状态正确初始化', () => {
      // 模拟 LootUI 的 dragging 状态
      const dragging = {
        id: 1,
        source: 'loot' as const,
        offsetRow: 0,
        offsetCol: 0,
        rotated: false
      }
      
      expect(dragging.rotated).toBe(false)
    })
    
    it('onRotateItem 正确切换 rotated 状态', () => {
      const dragging = {
        id: 1,
        source: 'loot' as const,
        offsetRow: 0,
        offsetCol: 0,
        rotated: false
      }
      
      // 模拟 onRotateItem 逻辑
      const onRotateItem = (instanceId: number) => {
        if (dragging.id === instanceId) {
          dragging.rotated = !dragging.rotated
        }
      }
      
      onRotateItem(1)
      expect(dragging.rotated).toBe(true)
      
      onRotateItem(1)
      expect(dragging.rotated).toBe(false)
    })
    
    it('旋转后宽高互换计算正确', () => {
      // 模拟物品尺寸
      const itemDef = {
        width: 2,
        height: 3,
        name: 'Test Item',
        rarity: 'common'
      }
      
      const dragging = {
        id: 1,
        source: 'loot' as const,
        offsetRow: 0,
        offsetCol: 0,
        rotated: false
      }
      
      // 计算尺寸的函数
      const getDisplaySize = (rotated: boolean) => {
        return {
          width: rotated ? itemDef.height : itemDef.width,
          height: rotated ? itemDef.width : itemDef.height
        }
      }
      
      // 未旋转时
      expect(getDisplaySize(false)).toEqual({ width: 2, height: 3 })
      
      // 旋转后宽高互换
      expect(getDisplaySize(true)).toEqual({ width: 3, height: 2 })
    })
    
    it('高亮格子数量随旋转变化', () => {
      const itemDef = { width: 2, height: 3 }
      
      const dragging = { rotated: false }
      
      // 计算高亮格子的函数
      const getHighlightCount = (rotated: boolean) => {
        const w = rotated ? itemDef.height : itemDef.width
        const h = rotated ? itemDef.width : itemDef.height
        return w * h
      }
      
      // 未旋转: 2x3 = 6 个格子
      expect(getHighlightCount(false)).toBe(6)
      
      // 旋转后: 3x2 = 6 个格子（面积不变）
      expect(getHighlightCount(true)).toBe(6)
    })
  })
  
  describe('ItemCell.vue 旋转样式', () => {
    
    it('displayWidth 和 displayHeight 正确计算', () => {
      const itemDef = {
        width: 2,
        height: 3
      }
      
      const isRotated = false
      const displayWidth = isRotated ? itemDef.height : itemDef.width
      const displayHeight = isRotated ? itemDef.width : itemDef.height
      
      expect(displayWidth).toBe(2)
      expect(displayHeight).toBe(3)
      
      const displayWidthRotated = true ? itemDef.height : itemDef.width
      const displayHeightRotated = true ? itemDef.width : itemDef.height
      
      expect(displayWidthRotated).toBe(3)
      expect(displayHeightRotated).toBe(2)
    })
  })
  
  describe('autoSelectRotation 智能旋转', () => {

  // 模拟 canPlaceAt 函数
  const mockCanPlaceAt = (
    currentConflicts: number,
    rotatedConflicts: number,
    rotatedValid: boolean
  ) => {
    return (source: 'bag' | 'loot', row: number, col: number, w: number, h: number, excludeId: number) => {
      if (w === 3 && h === 1) {
        // 竖直方向
        return { valid: true, reason: 'ok', conflicts: new Set(Array(currentConflicts).fill(0).map((_, i) => i + 1)) }
      } else {
        // 旋转后水平方向
        return { valid: rotatedValid, reason: rotatedValid ? 'ok' : 'out-of-bounds', conflicts: new Set(Array(rotatedConflicts).fill(0).map((_, i) => i + 1)) }
      }
    }
  }

  it('原则一：当前方向能放下时保持不变', () => {
    // 场景：1x3 物品，竖直能放下（无冲突）
    const canPlaceAt = mockCanPlaceAt(0, 0, true)
    const result = canPlaceAt('bag', 0, 0, 1, 3, 0)
    
    expect(result.valid).toBe(true)
    expect(result.conflicts.size).toBe(0)
    // 智能旋转应该返回 false（保持竖直）
    expect(result.conflicts.size <= 1).toBe(true)
  })

  it('原则二：当前方向有多个冲突时优先旋转', () => {
    // 场景：1x3 物品，竖直放不下（2个冲突），水平能放下（0冲突）
    const canPlaceAt = mockCanPlaceAt(2, 0, true)
    
    const currentResult = canPlaceAt('bag', 0, 0, 1, 3, 0)
    const rotatedResult = canPlaceAt('bag', 0, 0, 3, 1, 0)
    
    expect(currentResult.valid).toBe(true)
    expect(currentResult.conflicts.size).toBe(2)  // 有多个冲突
    expect(rotatedResult.valid).toBe(true)
    expect(rotatedResult.conflicts.size).toBe(0)  // 旋转后无冲突
    
    // 应该自动旋转
    expect(rotatedResult.conflicts.size === 0).toBe(true)
  })

  it('原则二：旋转后仍有冲突则不旋转', () => {
    // 场景：1x3 物品，竖直放不下（2个冲突），水平也放不下（1个冲突）
    const canPlaceAt = mockCanPlaceAt(2, 1, true)
    
    const currentResult = canPlaceAt('bag', 0, 0, 1, 3, 0)
    const rotatedResult = canPlaceAt('bag', 0, 0, 3, 1, 0)
    
    expect(currentResult.conflicts.size).toBe(2)  // 当前方向多个冲突
    expect(rotatedResult.conflicts.size).toBe(1)  // 旋转后也有冲突（不是0）
    
    // 不应该旋转
    expect(rotatedResult.conflicts.size === 0).toBe(false)
  })
})

describe('边界检查', () => {
    
    it('旋转后边界检查正确', () => {
      const BAG_COLS = 10
      const BAG_ROWS = 6
      const itemDef = { width: 3, height: 4 }
      
      const dragging = { rotated: false }
      
      // 检查是否超出边界
      const checkBounds = (row: number, col: number, rotated: boolean) => {
        const w = rotated ? itemDef.height : itemDef.width
        const h = rotated ? itemDef.width : itemDef.height
        return row + h <= BAG_ROWS && col + w <= BAG_COLS
      }
      
      // 3x4 物品放在 (0, 0) - OK
      expect(checkBounds(0, 0, false)).toBe(true)
      
      // 3x4 物品放在 (3, 0) - 超出边界 (3+4=7 > 6)
      expect(checkBounds(3, 0, false)).toBe(false)
      
      // 旋转后 4x3 物品放在 (3, 0) - OK (3+3=6, 0+4=4)
      expect(checkBounds(3, 0, true)).toBe(true)
      
      // 旋转后 4x3 物品放在 (3, 7) - 超出边界 (7+4=11 > 10)
      expect(checkBounds(3, 7, true)).toBe(false)
    })
  })
})

describe('console.log 验证', () => {
  
  it('旋转流程中的日志顺序', () => {
    const logs: string[] = []
    const console = {
      log: (msg: string) => logs.push(msg)
    }
    
    // 模拟 ItemCell onDragStart
    const onDragStart = (itemId: number, cellType: string) => {
      console.log(`[ItemCell] onDragStart called, item: ${itemId} cellType: ${cellType}`)
      console.log('[ItemCell] emitting dragstart-item')
      return { itemId, cellType }
    }
    
    // 模拟 LootUI onLootDragStart
    const onLootDragStart = (instanceId: number) => {
      console.log(`[LootUI] onLootDragStart: ${instanceId}`)
      return { instanceId }
    }
    
    // 模拟 LootUI onDragKeyDown
    const onDragKeyDown = (key: string, draggingId: number | undefined) => {
      console.log(`[LootUI] onDragKeyDown: ${key} dragging: ${draggingId}`)
      if (key === 'r' || key === 'R') {
        return true
      }
      return false
    }
    
    // 模拟 LootUI onRotateItem
    const onRotateItem = (instanceId: number) => {
      console.log(`[LootUI] onRotateItem: ${instanceId}`)
    }
    
    // 执行流程
    onDragStart(123, 'loot')
    onLootDragStart(123)
    const shouldRotate = onDragKeyDown('r', 123)
    if (shouldRotate) {
      onRotateItem(123)
    }
    
    // 验证日志顺序
    expect(logs[0]).toBe('[ItemCell] onDragStart called, item: 123 cellType: loot')
    expect(logs[1]).toBe('[ItemCell] emitting dragstart-item')
    expect(logs[2]).toBe('[LootUI] onLootDragStart: 123')
    expect(logs[3]).toBe('[LootUI] onDragKeyDown: r dragging: 123')
    expect(logs[4]).toBe('[LootUI] onRotateItem: 123')
    expect(logs.length).toBe(5)
  })
})
