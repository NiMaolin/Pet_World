import { describe, it, expect, beforeEach } from 'vitest'
import { buildGrid, canPlace, findPlacement, getConflictIds } from '../stores/gameStore'
import type { BagItem, LootItem } from '../types'
import { BAG_COLS, BAG_ROWS } from '../stores/gameStore'

function makeBagItem(id: number, itemId: string, row: number, col: number): BagItem {
  return { instanceId: id, itemId, row, col }
}

describe('多格碰撞检测工具函数', () => {
  describe('buildGrid', () => {
    it('空列表返回全 null 网格', () => {
      const grid = buildGrid([], BAG_ROWS, BAG_COLS)
      expect(grid.length).toBe(BAG_ROWS)
      expect(grid[0].length).toBe(BAG_COLS)
      expect(grid.every(row => row.every(cell => cell === null))).toBe(true)
    })

    it('1×1 物品占用一格', () => {
      const items = [makeBagItem(1, 'herb_green', 0, 0)]
      const grid = buildGrid(items, BAG_ROWS, BAG_COLS)
      expect(grid[0][0]).toBe(1)
      expect(grid[0][1]).toBe(null)
    })

    it('2×1 物品占用横向两格', () => {
      const items = [makeBagItem(2, 'iron_ore', 0, 1)]
      const grid = buildGrid(items, BAG_ROWS, BAG_COLS)
      expect(grid[0][1]).toBe(2)
      expect(grid[0][2]).toBe(2)
      expect(grid[0][0]).toBe(null)
    })

    it('3×2 物品占 6 格', () => {
      const items = [makeBagItem(3, 'dragon_crystal', 1, 2)]
      const grid = buildGrid(items, BAG_ROWS, BAG_COLS)
      for (let r = 0; r < 2; r++) {
        for (let c = 0; c < 3; c++) {
          expect(grid[1 + r][2 + c]).toBe(3)
        }
      }
      expect(grid[0][2]).toBe(null)
    })

    it('越界部分不写入网格', () => {
      // 尝试把一个 2×2 物品放在边界（row=5, col=9），
      // BAG_COLS=10, BAG_ROWS=6，右下角刚好越界
      const items = [makeBagItem(5, 'magic_scroll', 5, 9)]
      const grid = buildGrid(items, BAG_ROWS, BAG_COLS)
      // 有效部分
      expect(grid[5][9]).toBe(5)
      // 越界不写入（如果 grid 不够大会直接被跳过）
      expect(grid[5][10]).toBeUndefined() // 越界
    })
  })

  describe('canPlace', () => {
    it('空网格任何位置可放置', () => {
      const grid = buildGrid([], BAG_ROWS, BAG_COLS)
      expect(canPlace(grid, 0, 0, 1, 1, BAG_ROWS, BAG_COLS)).toBe(true)
      expect(canPlace(grid, 0, 0, 2, 2, BAG_ROWS, BAG_COLS)).toBe(true)
    })

    it('有物品时目标格冲突返回 false', () => {
      const grid = buildGrid([makeBagItem(1, 'herb_green', 1, 1)], BAG_ROWS, BAG_COLS)
      // 1×1 物品放在 (1,1) 冲突
      expect(canPlace(grid, 1, 1, 1, 1, BAG_ROWS, BAG_COLS)).toBe(false)
      // 放在 (1,2) 不冲突
      expect(canPlace(grid, 1, 2, 1, 1, BAG_ROWS, BAG_COLS)).toBe(true)
    })

    it('2×1 物品碰到另一 1×1 物品返回 false', () => {
      const grid = buildGrid([makeBagItem(1, 'herb_green', 0, 1)], BAG_ROWS, BAG_COLS)
      // 横向 2 格，会碰到 (0,1) 的物品
      expect(canPlace(grid, 0, 0, 2, 1, BAG_ROWS, BAG_COLS)).toBe(false)
      // 从 (0,2) 开始则不冲突
      expect(canPlace(grid, 0, 2, 2, 1, BAG_ROWS, BAG_COLS)).toBe(true)
    })

    it('越界返回 false', () => {
      const grid = buildGrid([], BAG_ROWS, BAG_COLS)
      expect(canPlace(grid, -1, 0, 1, 1, BAG_ROWS, BAG_COLS)).toBe(false)
      expect(canPlace(grid, 0, -1, 1, 1, BAG_ROWS, BAG_COLS)).toBe(false)
      expect(canPlace(grid, BAG_ROWS, 0, 1, 1, BAG_ROWS, BAG_COLS)).toBe(false)
      expect(canPlace(grid, 0, BAG_COLS, 1, 1, BAG_ROWS, BAG_COLS)).toBe(false)
    })

    it('excludeId 排除自身检测', () => {
      const grid = buildGrid([makeBagItem(1, 'herb_green', 0, 0)], BAG_ROWS, BAG_COLS)
      // 不排除自身 -> 冲突
      expect(canPlace(grid, 0, 0, 1, 1, BAG_ROWS, BAG_COLS)).toBe(false)
      // 排除自身 -> 可以"放置"在原位（用于原地刷新）
      expect(canPlace(grid, 0, 0, 1, 1, BAG_ROWS, BAG_COLS, 1)).toBe(true)
    })
  })

  describe('findPlacement', () => {
    it('空网格返回左上角 (0,0)', () => {
      const grid = buildGrid([], BAG_ROWS, BAG_COLS)
      const result = findPlacement(grid, 1, 1, BAG_ROWS, BAG_COLS)
      expect(result).toEqual({ row: 0, col: 0 })
    })

    it('1×1 被占，2×2 找到下一个可用位', () => {
      const grid = buildGrid([makeBagItem(1, 'herb_green', 0, 0)], BAG_ROWS, BAG_COLS)
      const result = findPlacement(grid, 2, 2, BAG_ROWS, BAG_COLS)
      // 2×2 从 (0,1) 开始
      expect(result).toEqual({ row: 0, col: 1 })
    })

    it('网格填满时找不到空间返回 null', () => {
      // 用 1×1 物品填满整个 10×6=60 格背包（最后一行 row=5 可放 2×2 因为 5+2=7>6 越界，
      // 所以只需填满 row 0-3，然后找一个 2×2 试试）
      // 但更可靠的做法是：测"2×2 放不进狭缝"
      // 改用 10 列全填（每格1个 1×1），行 0-4 = 50 个
      const items: BagItem[] = []
      for (let r = 0; r < 5; r++) {
        for (let c = 0; c < 10; c++) {
          items.push(makeBagItem(r * 10 + c, 'herb_green', r, c))
        }
      }
      const grid = buildGrid(items, BAG_ROWS, BAG_COLS)
      // row 4 完全空（没有 item），所以 findPlacement 会找到 (4,0)
      // 要真正让 findPlacement 返回 null：把 row 4 也填到 col=9-1=8（第9列作为2×2的右边界会越界）
      // 用 1×1 填满 row=5 的 col 0-8（共9个）
      for (let c = 0; c < 9; c++) {
        items.push(makeBagItem(50 + c, 'herb_green', 5, c))
      }
      const fullGrid = buildGrid(items, BAG_ROWS, BAG_COLS)
      // 现在 row 5 只剩 col=9，而 2×2 需要 col 0-1，所以无处可放
      const result = findPlacement(fullGrid, 2, 2, BAG_ROWS, BAG_COLS)
      expect(result).toBe(null)
    })
  })

  describe('getConflictIds', () => {
    it('空区域返回空 Set', () => {
      const grid = buildGrid([], BAG_ROWS, BAG_COLS)
      const ids = getConflictIds(grid, 0, 0, 1, 1)
      expect(ids.size).toBe(0)
    })

    it('单一物品返回其 id（Set）', () => {
      const grid = buildGrid([makeBagItem(7, 'herb_green', 1, 2)], BAG_ROWS, BAG_COLS)
      const ids = getConflictIds(grid, 1, 2, 1, 1)
      expect(ids.has(7)).toBe(true)
      expect(ids.size).toBe(1)
    })

    it('2×2 区域与部分重叠物品', () => {
      const grid = buildGrid([makeBagItem(9, 'magic_scroll', 1, 1)], BAG_ROWS, BAG_COLS)
      const ids = getConflictIds(grid, 0, 0, 2, 2)
      expect(ids.has(9)).toBe(true)
    })

    it('excludeId 排除自身', () => {
      const grid = buildGrid([makeBagItem(3, 'herb_green', 0, 0)], BAG_ROWS, BAG_COLS)
      const ids = getConflictIds(grid, 0, 0, 1, 1, 3)
      expect(ids.size).toBe(0)
    })

    it('多物品冲突返回多个 id（Set 去重）', () => {
      // 理解：getConflictIds(row, col, width, height)
      // width 控制列方向（列 col ~ col+width-1）
      // height 控制行方向（行 row ~ row+height-1）
      const grid = buildGrid([
        makeBagItem(1, 'ancient_bone', 0, 0),  // row0, col0
        makeBagItem(2, 'ancient_bone', 0, 1),  // row0, col1
        makeBagItem(3, 'ancient_bone', 0, 4),  // row0, col4
      ], BAG_ROWS, BAG_COLS)
      // 查询 row=0, col=0, width=2, height=1 → row0, cols 0-1
      // → 覆盖 item1(col0) 和 item2(col1)
      const ids = getConflictIds(grid, 0, 0, 2, 1)
      expect(ids.has(1)).toBe(true)
      expect(ids.has(2)).toBe(true)
      expect(ids.has(3)).toBe(false) // col4 不在查询范围
      expect(ids.size).toBe(2)
    })
  })
})

describe('多格物品换位规则', () => {
  // 换位规则的测试：基于 getConflictIds 的结果判断
  // 1 件冲突 -> 可换位；≥2 件冲突 -> 不可换位

  it('冲突 1 件 = 可换位，≥2 件 = 不可换位', () => {
    const grid = buildGrid([
      makeBagItem(1, 'herb_green', 0, 0),
      makeBagItem(2, 'iron_ore',   0, 1),
      makeBagItem(3, 'fossil',     0, 2),
    ], BAG_ROWS, BAG_COLS)

    // 1×1 目标区域只与 1 号冲突
    const oneConflict = getConflictIds(grid, 0, 0, 1, 1)
    expect(oneConflict.size).toBe(1) // 1 件冲突 -> 可换位

    // 2×2 区域(0,0)范围 rows=0-1, cols=0-1，不包含列2的物品3
    const twoConflicts = getConflictIds(grid, 0, 0, 2, 2)
    expect(twoConflicts.size).toBe(2) // 2 件冲突 -> 不可换位
  })
})