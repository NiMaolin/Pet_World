// ===========================
// 地图生成工具（多格物品支持）
// ===========================
import type { MapCell, LootBox, Enemy } from '../types'
import { randomItemId, getItemDef } from '../data/items'
import { buildGrid, findPlacement } from './gridUtils'

export const TILE_SIZE = 64
export const MAP_COLS = 20
export const MAP_ROWS = 15

let _instanceId = 1
export function nextId() { return _instanceId++ }

// 物资箱固定列数
const BOX_COLS = 6
const BOX_ROWS = 4  // 固定行数

/** 随机生成物资箱物品（固定格子数，超出部分丢弃） */
function generateBoxItems(count: number): { items: import('../types').LootItem[]; rows: number } {
  const items: import('../types').LootItem[] = []
  const rows = BOX_ROWS

  for (let i = 0; i < count; i++) {
    const itemId = randomItemId()
    const def = getItemDef(itemId)
    const needRotate = !!def.initialRotated
    // 考虑旋转后的尺寸来放置
    const placeW = needRotate ? def.height : def.width
    const placeH = needRotate ? def.width : def.height
    
    const grid = buildGrid(items as any, rows, BOX_COLS)
    const placement = findPlacement(grid, placeW, placeH, rows, BOX_COLS)
    if (!placement) continue  // 格子满了就跳过

    items.push({
      instanceId: nextId(),
      itemId,
      searched: false,
      row: placement.row,
      col: placement.col,
      rotated: needRotate,
    })
  }

  return { items, rows }
}

// 生成地图
export function generateMap(): {
  cells: MapCell[][]
  lootBoxes: LootBox[]
  enemies: Enemy[]
  extractX: number
  extractY: number
  playerStartX: number
  playerStartY: number
} {
  const cells: MapCell[][] = []

  // 初始化全 floor
  for (let r = 0; r < MAP_ROWS; r++) {
    cells[r] = []
    for (let c = 0; c < MAP_COLS; c++) {
      cells[r][c] = { terrain: 'floor' }
    }
  }

  // 边界为 wall
  for (let c = 0; c < MAP_COLS; c++) {
    cells[0][c].terrain = 'wall'
    cells[MAP_ROWS - 1][c].terrain = 'wall'
  }
  for (let r = 0; r < MAP_ROWS; r++) {
    cells[r][0].terrain = 'wall'
    cells[r][MAP_COLS - 1].terrain = 'wall'
  }

  // 随机散布 wall 块
  for (let i = 0; i < 20; i++) {
    const r = 2 + Math.floor(Math.random() * (MAP_ROWS - 4))
    const c = 2 + Math.floor(Math.random() * (MAP_COLS - 4))
    cells[r][c].terrain = 'wall'
  }

  // 随机 building 块（2×2）
  for (let i = 0; i < 4; i++) {
    const r = 2 + Math.floor(Math.random() * (MAP_ROWS - 5))
    const c = 2 + Math.floor(Math.random() * (MAP_COLS - 5))
    if (cells[r][c].terrain === 'floor') {
      cells[r][c].terrain = 'building'
      cells[r + 1]?.[c] && (cells[r + 1][c].terrain = 'building')
      cells[r]?.[c + 1] && (cells[r][c + 1].terrain = 'building')
      cells[r + 1]?.[c + 1] && (cells[r + 1][c + 1].terrain = 'building')
    }
  }

  // 玩家起始
  const playerStartX = 2 * TILE_SIZE
  const playerStartY = 2 * TILE_SIZE
  cells[2][2].terrain = 'floor'
  cells[2][3].terrain = 'floor'
  cells[3][2].terrain = 'floor'

  // 撤离点
  const extractX = (MAP_COLS - 3) * TILE_SIZE
  const extractY = (MAP_ROWS - 3) * TILE_SIZE
  cells[MAP_ROWS - 3][MAP_COLS - 3].terrain = 'floor'

  // 生成物资箱（5个）
  const lootBoxes: LootBox[] = []
  const lootPositions = randomFloorPositions(cells, 5, 3)
  for (const pos of lootPositions) {
    const count = 2 + Math.floor(Math.random() * 4)  // 2~5件物品
    const { items, rows } = generateBoxItems(count)

    const box: LootBox = {
      id: nextId(),
      x: pos.c,
      y: pos.r,
      cols: BOX_COLS,
      rows: BOX_ROWS,
      items,
      level: 1 + Math.floor(Math.random() * 3),
      opened: false,
    }
    cells[pos.r][pos.c].lootBoxId = box.id
    lootBoxes.push(box)
  }

  // 生成敌人（3个）
  const enemyTypes = [
    { type: '迅猛龙', hp: 80,  attack: 25 },
    { type: '翼龙',   hp: 60,  attack: 30 },
    { type: '剑齿虎', hp: 100, attack: 35 },
  ]
  const enemies: Enemy[] = []
  const enemyPositions = randomFloorPositions(cells, 3, 4)
  for (let i = 0; i < enemyPositions.length; i++) {
    const pos = enemyPositions[i]
    const t = enemyTypes[i % enemyTypes.length]
    enemies.push({
      id: nextId(),
      x: pos.c * TILE_SIZE + TILE_SIZE / 2,
      y: pos.r * TILE_SIZE + TILE_SIZE / 2,
      ...t,
      maxHp: t.hp,
      alive: true,
    })
  }

  return { cells, lootBoxes, enemies, extractX, extractY, playerStartX, playerStartY }
}

function randomFloorPositions(cells: MapCell[][], count: number, minDist: number) {
  const result: { r: number; c: number }[] = []
  let tries = 0
  while (result.length < count && tries < 500) {
    tries++
    const r = 3 + Math.floor(Math.random() * (MAP_ROWS - 6))
    const c = 3 + Math.floor(Math.random() * (MAP_COLS - 6))
    if (cells[r][c].terrain !== 'floor' || cells[r][c].lootBoxId) continue
    if (r < 5 && c < 5) continue
    const tooClose = result.some(p => Math.abs(p.r - r) < minDist && Math.abs(p.c - c) < minDist)
    if (!tooClose) result.push({ r, c })
  }
  return result
}

export function isWalkable(cells: MapCell[][], r: number, c: number): boolean {
  if (r < 0 || r >= MAP_ROWS || c < 0 || c >= MAP_COLS) return false
  const t = cells[r][c].terrain
  return t === 'floor' || t === 'grass'
}
