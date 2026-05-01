// ===========================
// 游戏核心类型定义
// ===========================

// ── 枚举类型 ──────────────────────────────────────────────────

export type Rarity = 'common' | 'uncommon' | 'rare' | 'epic' | 'legendary'
export type TerrainType = 'floor' | 'wall' | 'building' | 'grass'
export type GameScene = 'main-menu' | 'prepare' | 'map-select' | 'game-world' | 'extract-success' | 'extract-fail'

// ── 坐标与尺寸类型 ───────────────────────────────────────────

/** 像素坐标 */
export interface PixelPos { x: number; y: number }
/** 网格坐标 */
export interface GridPos { row: number; col: number }
/** 网格尺寸 */
export interface GridSize { width: number; height: number }

// ── 物品系统 ─────────────────────────────────────────────────

export interface ItemDef {
  id: string
  name: string
  rarity: Rarity
  description?: string
  icon?: string
  // 多格系统：物品占用格子数 (width=列数, height=行数)
  // 统一为横向（width >= height），竖向物品用 initialRotated: true 标记
  // 1×1=普通小件, 2×1=横向长条, 3×1=横向长条, 2×2=方形...
  width: number   // 占列数 (1~4)
  height: number  // 占行数 (1~4)
  initialRotated?: boolean  // 初始状态是否为竖向（玩家可继续旋转）
}

/** 物品基类（背包和物资箱共用） */
export interface BaseItem {
  instanceId: number
  itemId: string
  row: number         // 物品左上角行
  col: number         // 物品左上角列
  rotated?: boolean   // 是否被旋转（宽高互换）
}

/** 背包中的物品实例 */
export interface BagItem extends BaseItem {}

/** 物资箱中的物品实例 */
export interface LootItem extends BaseItem {
  searched: boolean   // 是否已搜索揭示
}

// ── 网格系统 ─────────────────────────────────────────────────

/** 格子占用情况：[row][col] = instanceId | null */
export type GridMap = (number | null)[][]

// ── 实体系统 ─────────────────────────────────────────────────

/** 生命值实体基类 */
export interface BaseHealthEntity {
  hp: number
  maxHp: number
}

/** 玩家 */
export interface Player extends BaseHealthEntity {
  x: number; y: number
  speed: number
}

/** 敌人 */
export interface Enemy extends BaseHealthEntity {
  id: number
  x: number; y: number
  type: string
  attack: number
  alive: boolean
}

// ── 地图与物资箱 ─────────────────────────────────────────────

/** 地图格子 */
export interface MapCell {
  terrain: TerrainType
  lootBoxId?: number
}

/** 物资箱 */
export interface LootBox {
  id: number
  x: number; y: number   // 格子坐标
  cols: number          // 物资箱格子宽度（默认6）
  rows: number          // 物资箱格子高度（固定4）
  items: LootItem[]
  level: number
  opened: boolean
}

// ── 游戏状态 ─────────────────────────────────────────────────

/** 搜索状态 */
export interface SearchState {
  active: boolean
  itemIndex: number
  elapsed: number
  targetTime: number
}

/** 放置操作失败原因 */
export type PlaceError = 'none' | 'out-of-bounds' | 'bag-full' | 'loot-full' | 'multi-conflict'
