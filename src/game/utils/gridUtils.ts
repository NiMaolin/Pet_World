// ===========================
// 网格工具函数（纯函数，不依赖 store）
// ===========================
import type { GridMap, BagItem, LootItem, ItemDef } from '../types'
import { getItemDef } from '../data/items'

// ─────────────────────────────────────────────────────────────
//  尺寸工具
// ─────────────────────────────────────────────────────────────

/**
 * 根据旋转状态获取物品的有效尺寸
 */
export function getEffectiveSize(
  def: ItemDef,
  rotated?: boolean
): { width: number; height: number } {
  if (rotated) {
    return { width: def.height, height: def.width }
  }
  return { width: def.width, height: def.height }
}

/**
 * 计算物品占用的格子数
 */
export function getItemCellCount(item: { itemId: string; rotated?: boolean }): number {
  const def = getItemDef(item.itemId)
  return def.width * def.height
}

// ─────────────────────────────────────────────────────────────
//  网格碰撞检测
// ─────────────────────────────────────────────────────────────

/**
 * 构建格子占用图：[row][col] = instanceId | null
 * 自动识别 BagItem 和 LootItem，BagItem 考虑旋转状态
 */
export function buildGrid(
  items: BagItem[] | LootItem[],
  gridRows: number,
  gridCols: number
): GridMap {
  const grid: GridMap = Array.from({ length: gridRows }, () => Array(gridCols).fill(null))

  for (const item of items) {
    const def = getItemDef(item.itemId)
    // 背包物品可能有旋转状态
    const isRotated = 'rotated' in item ? (item as BagItem).rotated : false
    const { width, height } = getEffectiveSize(def, isRotated)

    // 严格边界检查：物品必须完全在网格内
    if (item.row < 0 || item.col < 0 || item.row + height > gridRows || item.col + width > gridCols) {
      console.warn(`[buildGrid] 物品 ${item.instanceId} (${def.name}) 超出边界: row=${item.row}, col=${item.col}, size=${width}x${height}, grid=${gridCols}x${gridRows}`)
      continue  // 跳过越界物品
    }

    for (let dr = 0; dr < height; dr++) {
      for (let dc = 0; dc < width; dc++) {
        const r = item.row + dr
        const c = item.col + dc
        if (r >= 0 && r < gridRows && c >= 0 && c < gridCols) {
          grid[r][c] = item.instanceId
        }
      }
    }
  }
  return grid
}

/**
 * 检测物品放置是否合法（不越界、不与其他物品冲突）
 * @param excludeId 排除某个物品自身（用于移动时）
 */
export function canPlace(
  grid: GridMap,
  row: number,
  col: number,
  width: number,
  height: number,
  gridRows: number,
  gridCols: number,
  excludeId: number | null = null
): boolean {
  // 严格边界检查：物品必须完全在网格内
  if (row < 0 || col < 0 || row + height > gridRows || col + width > gridCols) {
    return false
  }

  for (let dr = 0; dr < height; dr++) {
    for (let dc = 0; dc < width; dc++) {
      const occupant = grid[row + dr][col + dc]
      if (occupant !== null && occupant !== excludeId) return false
    }
  }
  return true
}

/**
 * 自动查找能放下指定尺寸物品的第一个空位
 * 扫描顺序：从左到右，从上到下
 */
export function findPlacement(
  grid: GridMap,
  width: number,
  height: number,
  gridRows: number,
  gridCols: number,
  excludeId: number | null = null
): { row: number; col: number } | null {
  for (let r = 0; r <= gridRows - height; r++) {
    for (let c = 0; c <= gridCols - width; c++) {
      if (canPlace(grid, r, c, width, height, gridRows, gridCols, excludeId)) {
        return { row: r, col: c }
      }
    }
  }
  return null
}

/**
 * 查找所有能放下物品的有效位置
 * 扫描顺序：从左到右，从上到下
 */
export function findAllPlacements(
  grid: GridMap,
  width: number,
  height: number,
  gridRows: number,
  gridCols: number,
  excludeId: number | null = null
): { row: number; col: number }[] {
  const placements: { row: number; col: number }[] = []
  for (let r = 0; r <= gridRows - height; r++) {
    for (let c = 0; c <= gridCols - width; c++) {
      if (canPlace(grid, r, c, width, height, gridRows, gridCols, excludeId)) {
        placements.push({ row: r, col: c })
      }
    }
  }
  return placements
}

/**
 * 计算把物品放到某位置后的空间浪费程度
 * 浪费 = 位置右边的剩余空间 + 下方的剩余空间
 * 越小越好（更紧凑）
 */
export function calcWaste(
  grid: GridMap,
  row: number,
  col: number,
  width: number,
  height: number,
  gridRows: number,
  gridCols: number
): number {
  let waste = 0
  // 右侧浪费：这一行从 col+width 到 gridCols-1 的空格
  for (let r = row; r < row + height; r++) {
    for (let c = col + width; c < gridCols; c++) {
      if (grid[r][c] === null) waste++
    }
  }
  // 下方浪费：这一列从 row+height 到 gridRows-1 的空格
  for (let r = row + height; r < gridRows; r++) {
    for (let c = col; c < col + width; c++) {
      if (grid[r][c] === null) waste++
    }
  }
  return waste
}

/**
 * 找最优放置位置（Best Fit）
 * 在所有有效位置中，选择放入后空间浪费最小的那个
 */
export function findBestPlacement(
  grid: GridMap,
  width: number,
  height: number,
  gridRows: number,
  gridCols: number,
  excludeId: number | null = null
): { row: number; col: number } | null {
  const placements = findAllPlacements(grid, width, height, gridRows, gridCols, excludeId)
  if (placements.length === 0) return null

  let best: { row: number; col: number } | null = null
  let bestWaste = Infinity

  for (const pos of placements) {
    const waste = calcWaste(grid, pos.row, pos.col, width, height, gridRows, gridCols)
    if (waste < bestWaste) {
      bestWaste = waste
      best = pos
    }
  }
  return best
}

/**
 * 收集目标区域内所有冲突物品的 instanceId（排除自身）
 */
export function getConflictIds(
  grid: GridMap,
  row: number,
  col: number,
  width: number,
  height: number,
  excludeId: number | null = null
): Set<number> {
  const conflicts = new Set<number>()
  for (let dr = 0; dr < height; dr++) {
    for (let dc = 0; dc < width; dc++) {
      const occupant = grid[row + dr][col + dc]
      if (occupant !== null && occupant !== excludeId) {
        conflicts.add(occupant)
      }
    }
  }
  return conflicts
}
