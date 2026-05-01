// ===========================
// Pinia 游戏主 Store（多格物品系统）
// ===========================
import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import type { Player, BagItem, LootBox, Enemy, MapCell, GameScene, SearchState, LootItem, GridMap, PlaceError } from '../types'
import { generateMap, TILE_SIZE, MAP_COLS, MAP_ROWS, nextId } from '../utils/mapGen'
import { getItemDef, SEARCH_TIME } from '../data/items'
import { buildGrid, canPlace, findPlacement, findBestPlacement, getConflictIds, getEffectiveSize, getItemCellCount, calcWaste } from '../utils/gridUtils'

export const BAG_COLS = 6
export const BAG_ROWS = 4

// 重新导出 PlaceError 供外部使用
export { type PlaceError } from '../types'

// ─────────────────────────────────────────────────────────────
//  Store
// ─────────────────────────────────────────────────────────────

export const useGameStore = defineStore('game', () => {
  // ── 场景 ──────────────────────────────────────
  const scene = ref<GameScene>('main-menu')

  // ── 地图 ──────────────────────────────────────
  const mapCells = ref<MapCell[][]>([])
  const lootBoxes = ref<LootBox[]>([])
  const enemies = ref<Enemy[]>([])
  const extractX = ref(0)
  const extractY = ref(0)
  const playerStartX = ref(0)
  const playerStartY = ref(0)

  // ── 玩家 ──────────────────────────────────────
  const player = ref<Player>({ x: 128, y: 128, hp: 100, maxHp: 100, speed: 360 })

  // ── 背包 ──────────────────────────────────────
  const bagItems = ref<BagItem[]>([])

  // ── 物资箱 UI ─────────────────────────────────
  const lootUIOpen = ref(false)
  const currentBoxId = ref<number | null>(null)

  // ── 搜索状态 ──────────────────────────────────
  const searchState = ref<SearchState>({
    active: false,
    itemIndex: 0,
    elapsed: 0,
    targetTime: 0,
  })

  // ── 放置失败原因 ─────────────────────────────
  const lastPlaceError = ref<PlaceError>('none')

  // ── 旋转中的物品 ─────────────────────────────
  const rotatingItemId = ref<number | null>(null)

  // ── Computed ──────────────────────────────────
  const currentBox = computed<LootBox | null>(() =>
    currentBoxId.value != null
      ? lootBoxes.value.find(b => b.id === currentBoxId.value) ?? null
      : null
  )

  /** 背包占用图（响应式） */
  const bagGrid = computed<GridMap>(() =>
    buildGrid(bagItems.value, BAG_ROWS, BAG_COLS)
  )

  /** 当前物资箱占用图（响应式） */
  const lootGrid = computed<GridMap>(() => {
    const box = currentBox.value
    if (!box) return []
    return buildGrid(box.items, box.rows, box.cols)
  })

  const bagUsed = computed(() => {
    return bagItems.value.reduce((sum, item) => sum + getItemCellCount(item), 0)
  })
  const bagTotal = computed(() => BAG_ROWS * BAG_COLS)

  // ── Actions ───────────────────────────────────
  function startNewGame() {
    const result = generateMap()
    mapCells.value = result.cells
    lootBoxes.value = result.lootBoxes
    enemies.value = result.enemies
    extractX.value = result.extractX
    extractY.value = result.extractY
    playerStartX.value = result.playerStartX
    playerStartY.value = result.playerStartY

    player.value = {
      x: result.playerStartX,
      y: result.playerStartY,
      hp: 100,
      maxHp: 100,
      speed: 360,
    }
    bagItems.value = []
    lootUIOpen.value = false
    currentBoxId.value = null
    searchState.value = { active: false, itemIndex: 0, elapsed: 0, targetTime: 0 }
    scene.value = 'game-world'
  }

  function goScene(s: GameScene) {
    scene.value = s
  }

  // 打开物资箱
  function openLootBox(boxId: number) {
    const box = lootBoxes.value.find(b => b.id === boxId)
    if (!box) return
    box.opened = true
    currentBoxId.value = boxId
    lootUIOpen.value = true
    _setupSearch(box)
  }

  function closeLootUI() {
    lootUIOpen.value = false
    currentBoxId.value = null
    searchState.value = { active: false, itemIndex: 0, elapsed: 0, targetTime: 0 }
  }

  // 设置搜索状态
  function _setupSearch(box: LootBox) {
    const firstUnsearched = box.items.findIndex(i => !i.searched)
    if (firstUnsearched < 0) {
      searchState.value = { active: false, itemIndex: 0, elapsed: 0, targetTime: 0 }
      return
    }
    const item = box.items[firstUnsearched]
    const def = getItemDef(item.itemId)
    searchState.value = {
      active: true,
      itemIndex: firstUnsearched,
      elapsed: 0,
      targetTime: SEARCH_TIME[def.rarity],
    }
  }

  // 搜索 tick（每帧调用）
  function tickSearch(delta: number) {
    if (!searchState.value.active || !currentBox.value) return
    const s = searchState.value
    s.elapsed += delta
    if (s.elapsed >= s.targetTime) {
      const box = currentBox.value
      box.items[s.itemIndex].searched = true
      const next = box.items.findIndex((i, idx) => idx > s.itemIndex && !i.searched)
      if (next < 0) {
        s.active = false
      } else {
        const def = getItemDef(box.items[next].itemId)
        s.itemIndex = next
        s.elapsed = 0
        s.targetTime = SEARCH_TIME[def.rarity]
      }
    }
  }

  // ── 背包放置逻辑 ───────────────────────────────

  /**
   * 双击拾取：物资箱 → 背包，自动找空位（支持多格）
   * 智能逻辑：
   * 1. 尝试物品当前方向的尺寸
   * 2. 尝试翻转后的尺寸
   * 3. 都放不下则整理背包后重试
   */
  function pickItemToBag(instanceId: number): boolean {
    const box = currentBox.value
    if (!box) return false
    const idx = box.items.findIndex(i => i.instanceId === instanceId)
    if (idx < 0) return false
    const lootItem = box.items[idx]
    if (!lootItem.searched) return false

    const def = getItemDef(lootItem.itemId)
    
    // 物品当前的旋转状态
    const isCurrentlyRotated = lootItem.rotated
    
    // 尝试1：用物品当前方向的尺寸搜索
    const currentW = isCurrentlyRotated ? def.height : def.width
    const currentH = isCurrentlyRotated ? def.width : def.height
    let placement = findPlacement(bagGrid.value, currentW, currentH, BAG_ROWS, BAG_COLS)
    if (placement) {
      bagItems.value.push({
        instanceId: lootItem.instanceId,
        itemId: lootItem.itemId,
        row: placement.row,
        col: placement.col,
        rotated: isCurrentlyRotated,
      })
      box.items.splice(idx, 1)
      _fixSearchIndexAfterRemove(idx)
      return true
    }

    // 尝试2：尝试翻转后的尺寸（非正方形物品）
    if (def.width !== def.height) {
      const flippedW = isCurrentlyRotated ? def.width : def.height
      const flippedH = isCurrentlyRotated ? def.height : def.width
      placement = findPlacement(bagGrid.value, flippedW, flippedH, BAG_ROWS, BAG_COLS)
      if (placement) {
        bagItems.value.push({
          instanceId: lootItem.instanceId,
          itemId: lootItem.itemId,
          row: placement.row,
          col: placement.col,
          rotated: !isCurrentlyRotated,  // 切换旋转状态
        })
        box.items.splice(idx, 1)
        _fixSearchIndexAfterRemove(idx)
        return true
      }
    }

    // 尝试3：整理背包后重试
    if (_rearrangeBagForItem(def)) {
      // 重新构建网格后再次尝试放置（同样用当前方向）
      placement = findPlacement(bagGrid.value, currentW, currentH, BAG_ROWS, BAG_COLS)
      if (placement) {
        bagItems.value.push({
          instanceId: lootItem.instanceId,
          itemId: lootItem.itemId,
          row: placement.row,
          col: placement.col,
          rotated: isCurrentlyRotated,
        })
        box.items.splice(idx, 1)
        _fixSearchIndexAfterRemove(idx)
        return true
      }
      // 尝试翻转后放置
      if (def.width !== def.height) {
        const flippedW = isCurrentlyRotated ? def.width : def.height
        const flippedH = isCurrentlyRotated ? def.height : def.width
        placement = findPlacement(bagGrid.value, flippedW, flippedH, BAG_ROWS, BAG_COLS)
        if (placement) {
          bagItems.value.push({
            instanceId: lootItem.instanceId,
            itemId: lootItem.itemId,
            row: placement.row,
            col: placement.col,
            rotated: !isCurrentlyRotated,
          })
          box.items.splice(idx, 1)
          _fixSearchIndexAfterRemove(idx)
          return true
        }
      }
    }

    // 所有方法都失败，显示提示
    lastPlaceError.value = 'bag-full'
    return false
  }

  /**
   * 整理背包，尝试腾出空间容纳指定物品
   * 
   * 优化算法：Best Fit Decreasing
   * 1. 按面积降序排列物品（大物品优先放，更容易找到紧凑方案）
   * 2. 对每个物品使用 Best Fit（找放入后空间浪费最小的位置）
   * 3. 尝试多种排序策略，增加成功率
   * 4. 支持物品旋转（双向都尝试，选更优）
   */
  function _rearrangeBagForItem(itemDef: ReturnType<typeof getItemDef>): boolean {
    if (bagItems.value.length === 0) return false

    const needRotation = itemDef.width !== itemDef.height
    const targetW = itemDef.width
    const targetH = itemDef.height
    const targetArea = targetW * targetH

    // 生成多种排序策略，增加找到可行方案的概率
    const strategies = [
      // 策略1：按面积降序（大物品优先）
      (a: BagItem, b: BagItem) => {
        const areaA = getItemDef(a.itemId).width * getItemDef(a.itemId).height
        const areaB = getItemDef(b.itemId).width * getItemDef(b.itemId).height
        return areaB - areaA
      },
      // 策略2：按宽度降序
      (a: BagItem, b: BagItem) => {
        const wA = a.rotated ? getItemDef(a.itemId).height : getItemDef(a.itemId).width
        const wB = b.rotated ? getItemDef(b.itemId).height : getItemDef(b.itemId).width
        return wB - wA
      },
      // 策略3：按高度降序
      (a: BagItem, b: BagItem) => {
        const hA = a.rotated ? getItemDef(a.itemId).width : getItemDef(a.itemId).height
        const hB = b.rotated ? getItemDef(b.itemId).width : getItemDef(b.itemId).height
        return hB - hA
      },
      // 策略4：按面积升序（小物品优先，先填缝隙）
      (a: BagItem, b: BagItem) => {
        const areaA = getItemDef(a.itemId).width * getItemDef(a.itemId).height
        const areaB = getItemDef(b.itemId).width * getItemDef(b.itemId).height
        return areaA - areaB
      },
      // 策略5：随机打乱（原始策略的兜底）
      () => Math.random() > 0.5 ? 1 : -1,
    ]

    for (const sortFn of strategies) {
      const sorted = [...bagItems.value].sort(sortFn)
      if (tryPlaceAll(sorted)) {
        return true
      }
    }

    // 策略6：多次随机尝试（应对复杂布局）
    for (let attempt = 0; attempt < 50; attempt++) {
      const shuffled = [...bagItems.value]
      _shuffleArray(shuffled)
      if (tryPlaceAll(shuffled)) {
        return true
      }
    }

    return false

    /**
     * 尝试用给定顺序放置所有物品
     * 使用 Best Fit 算法：每个物品都找最合适的位置
     * 对每个物品尝试两种旋转状态，选更优的放置位置
     */
    function tryPlaceAll(items: BagItem[]): boolean {
      const placed: BagItem[] = []

      for (const item of items) {
        const def = getItemDef(item.itemId)
        const grid = buildGrid(placed, BAG_ROWS, BAG_COLS)

        // 尝试两种旋转状态，选最优位置
        let bestPos: { row: number; col: number } | null = null
        let bestRotated = false
        let bestWaste = Infinity

        // 尝试旋转状态 A：与物品当前旋转状态一致
        const rotatedA = item.rotated
        const wA = rotatedA ? def.height : def.width
        const hA = rotatedA ? def.width : def.height
        const posA = findBestPlacement(grid, wA, hA, BAG_ROWS, BAG_COLS)
        if (posA) {
          const wasteA = calcWaste(grid, posA.row, posA.col, wA, hA, BAG_ROWS, BAG_COLS)
          if (wasteA < bestWaste) {
            bestWaste = wasteA
            bestPos = posA
            bestRotated = rotatedA
          }
        }

        // 尝试旋转状态 B：翻转（仅非正方形物品）
        if (def.width !== def.height) {
          const rotatedB = !item.rotated
          const wB = rotatedB ? def.height : def.width
          const hB = rotatedB ? def.width : def.height
          const posB = findBestPlacement(grid, wB, hB, BAG_ROWS, BAG_COLS)
          if (posB) {
            const wasteB = calcWaste(grid, posB.row, posB.col, wB, hB, BAG_ROWS, BAG_COLS)
            if (wasteB < bestWaste) {
              bestWaste = wasteB
              bestPos = posB
              bestRotated = rotatedB
            }
          }
        }

        if (!bestPos) {
          // 两个方向都放不下，此排列失败
          return false
        }

        // 用最优位置放置
        placed.push({
          instanceId: item.instanceId,
          itemId: item.itemId,
          row: bestPos.row,
          col: bestPos.col,
          rotated: bestRotated
        })
      }

      // 所有物品都放好了，检查目标物品能否放入
      const afterGrid = buildGrid(placed, BAG_ROWS, BAG_COLS)

      // 尝试原方向
      if (findPlacement(afterGrid, targetW, targetH, BAG_ROWS, BAG_COLS)) {
        bagItems.value.splice(0, bagItems.value.length, ...placed)
        return true
      }

      // 尝试旋转后
      if (needRotation && findPlacement(afterGrid, targetH, targetW, BAG_ROWS, BAG_COLS)) {
        bagItems.value.splice(0, bagItems.value.length, ...placed)
        return true
      }

      // 目标物品放不下，此排列失败
      return false
    }
  }

  /** 随机打乱数组（Fisher-Yates 算法） */
  function _shuffleArray<T>(array: T[]): void {
    for (let i = array.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1))
      ;[array[i], array[j]] = [array[j], array[i]]
    }
  }

  /**
   * 拖拽放置：物资箱 → 背包指定格（支持多格，支持单个物品换位）
   * 三角洲规则：目标区域只有一件物品 → 换位；多件物品 → 拒绝
   */
  function placeItemInBag(instanceId: number, row: number, col: number, rotated = false): boolean {
    const box = currentBox.value
    if (!box) return false
    const idx = box.items.findIndex(i => i.instanceId === instanceId)
    if (idx < 0) return false
    const lootItem = box.items[idx]
    if (!lootItem.searched) return false

    const def = getItemDef(lootItem.itemId)
    const { width: w, height: h } = getEffectiveSize(def, rotated)

    // 检查边界（含下限）
    if (row < 0 || col < 0 || row + h > BAG_ROWS || col + w > BAG_COLS) {
      lastPlaceError.value = 'out-of-bounds'
      return false
    }

    // 收集冲突物品
    const conflicts = getConflictIds(bagGrid.value, row, col, w, h)

    if (conflicts.size > 1) {
      lastPlaceError.value = 'multi-conflict'
      return false
    }

    if (conflicts.size === 1) {
      // 单件冲突 → 把那件物品放回物资箱
      const conflictId = [...conflicts][0]
      const returnOk = _returnBagItemToBox(conflictId, box)
      if (!returnOk) return false
    }

    // 放置（保存旋转状态）
    bagItems.value.push({ instanceId, itemId: lootItem.itemId, row, col, rotated })
    const freshIdx = box.items.findIndex(i => i.instanceId === instanceId)
    if (freshIdx >= 0) box.items.splice(freshIdx, 1)
    _fixSearchIndexAfterRemove(freshIdx >= 0 ? freshIdx : idx)
    return true
  }

  /**
   * 背包内移动：支持多格，支持单件换位
   * 三角洲规则：目标区域只有一件其他物品 → 两者换位；多件冲突 → 拒绝
   */
  function moveBagItem(instanceId: number, toRow: number, toCol: number, rotated = false): boolean {
    const item = bagItems.value.find(i => i.instanceId === instanceId)
    if (!item) return false

    const def = getItemDef(item.itemId)
    const isRotated = rotated !== undefined ? rotated : item.rotated
    const { width: w, height: h } = getEffectiveSize(def, isRotated)

    // 同位置同旋转 → 无需操作
    if (item.row === toRow && item.col === toCol && item.rotated === isRotated) return true

    // 检查边界（含下限）
    if (toRow < 0 || toCol < 0 || toRow + h > BAG_ROWS || toCol + w > BAG_COLS) {
      lastPlaceError.value = 'out-of-bounds'
      return false
    }

    // 收集冲突（排除自身）
    const conflicts = getConflictIds(bagGrid.value, toRow, toCol, w, h, instanceId)

    if (conflicts.size > 1) {
      lastPlaceError.value = 'multi-conflict'
      return false
    }

    if (conflicts.size === 1) {
      // 单件换位：A → 目标位置，B → A 的原位
      const conflictId = [...conflicts][0]
      const conflictItem = bagItems.value.find(i => i.instanceId === conflictId)
      if (conflictItem) {
        const conflictDef = getItemDef(conflictItem.itemId)
        const { width: conflictW, height: conflictH } = getEffectiveSize(conflictDef, conflictItem.rotated)

        // 边界检查：A 放目标位置，B 放 A 的原位，都必须完全在网格内
        const aInBounds = toRow >= 0 && toCol >= 0 && toRow + h <= BAG_ROWS && toCol + w <= BAG_COLS
        const bInBounds = item.row >= 0 && item.col >= 0 && item.row + conflictH <= BAG_ROWS && item.col + conflictW <= BAG_COLS
        if (!aInBounds || !bInBounds) {
          lastPlaceError.value = 'out-of-bounds'
          return false
        }

        // 构建排除 A 和 B 后的临时网格
        const tempItems = bagItems.value.filter(i => i.instanceId !== instanceId && i.instanceId !== conflictId)
        const tempGrid = buildGrid(tempItems, BAG_ROWS, BAG_COLS)

        // 用各自实际尺寸检查：A(w×h) 能否放在目标位置，B(conflictW×conflictH) 能否放在 A 的原位
        const aOk = canPlace(tempGrid, toRow, toCol, w, h, BAG_ROWS, BAG_COLS)
        const bOk = canPlace(tempGrid, item.row, item.col, conflictW, conflictH, BAG_ROWS, BAG_COLS)

        if (!aOk || !bOk) {
          lastPlaceError.value = 'multi-conflict'
          return false
        }

        // 额外检查：A 的新位置 与 B 的新位置（A 的原位）是否互相重叠
        // 换位后 A 在 (toRow,toCol) 尺寸(w×h)，B 在 (item.row,item.col) 尺寸(conflictW×conflictH)
        const aRight = toCol + w, aBottom = toRow + h
        const bRight = item.col + conflictW, bBottom = item.row + conflictH
        const swapOverlap = toRow < bBottom && aBottom > item.row && toCol < bRight && aRight > item.col
        if (swapOverlap) {
          lastPlaceError.value = 'multi-conflict'
          return false
        }

        // 执行换位：同时更新 A 的旋转状态
        const oldRow = item.row
        const oldCol = item.col
        item.row = toRow
        item.col = toCol
        item.rotated = isRotated  // ← 必须更新，否则物品尺寸与位置不匹配
        conflictItem.row = oldRow
        conflictItem.col = oldCol
        // conflictItem.rotated 保持不变
        return true
      }
    }

    // 无冲突 → 直接移动
    item.row = toRow
    item.col = toCol
    item.rotated = isRotated
    return true
  }

  /**
   * 双击放回：背包 → 物资箱，自动找空位（支持多格）
   */
  function returnItemToBox(instanceId: number): boolean {
    const box = currentBox.value
    if (!box) return false
    return _returnBagItemToBox(instanceId, box)
  }

  /** 内部方法：把背包物品放回指定物资箱（固定格子，找空位） */
  function _returnBagItemToBox(instanceId: number, box: LootBox): boolean {
    const bagIdx = bagItems.value.findIndex(i => i.instanceId === instanceId)
    if (bagIdx < 0) return false
    const bagItem = bagItems.value[bagIdx]
    const def = getItemDef(bagItem.itemId)

    // 物品当前的旋转状态
    const isCurrentlyRotated = bagItem.rotated

    // 尝试1：用物品当前方向的尺寸搜索
    const currentW = isCurrentlyRotated ? def.height : def.width
    const currentH = isCurrentlyRotated ? def.width : def.height
    let grid = buildGrid(box.items, box.rows, box.cols)
    let placement = findPlacement(grid, currentW, currentH, box.rows, box.cols)
    if (placement) {
      box.items.push({
        instanceId,
        itemId: bagItem.itemId,
        searched: true,
        row: placement.row,
        col: placement.col,
        rotated: isCurrentlyRotated,
      })
      bagItems.value.splice(bagIdx, 1)
      return true
    }

    // 尝试2：尝试翻转后的尺寸（非正方形物品）
    if (def.width !== def.height) {
      const flippedW = isCurrentlyRotated ? def.width : def.height
      const flippedH = isCurrentlyRotated ? def.height : def.width
      grid = buildGrid(box.items, box.rows, box.cols)
      placement = findPlacement(grid, flippedW, flippedH, box.rows, box.cols)
      if (placement) {
        box.items.push({
          instanceId,
          itemId: bagItem.itemId,
          searched: true,
          row: placement.row,
          col: placement.col,
          rotated: !isCurrentlyRotated,
        })
        bagItems.value.splice(bagIdx, 1)
        return true
      }
    }

    // 尝试3：整理物资箱后重试
    if (_rearrangeLootForItem(box, def)) {
      grid = buildGrid(box.items, box.rows, box.cols)
      placement = findPlacement(grid, currentW, currentH, box.rows, box.cols)
      if (placement) {
        box.items.push({
          instanceId,
          itemId: bagItem.itemId,
          searched: true,
          row: placement.row,
          col: placement.col,
          rotated: isCurrentlyRotated,
        })
        bagItems.value.splice(bagIdx, 1)
        return true
      }
      // 尝试翻转后放置
      if (def.width !== def.height) {
        const flippedW = isCurrentlyRotated ? def.width : def.height
        const flippedH = isCurrentlyRotated ? def.height : def.width
        placement = findPlacement(grid, flippedW, flippedH, box.rows, box.cols)
        if (placement) {
          box.items.push({
            instanceId,
            itemId: bagItem.itemId,
            searched: true,
            row: placement.row,
            col: placement.col,
            rotated: !isCurrentlyRotated,
          })
          bagItems.value.splice(bagIdx, 1)
          return true
        }
      }
    }

    lastPlaceError.value = 'loot-full'
    return false
  }

  /**
   * 整理物资箱，尝试腾出空间容纳指定物品
   * 使用与背包相同的 Best Fit Decreasing 算法
   */
  function _rearrangeLootForItem(box: LootBox, itemDef: ReturnType<typeof getItemDef>): boolean {
    if (box.items.length === 0) return false

    const needRotation = itemDef.width !== itemDef.height
    const targetW = itemDef.width
    const targetH = itemDef.height

    // 生成多种排序策略
    const strategies = [
      (a: LootItem, b: LootItem) => {
        const areaA = getItemDef(a.itemId).width * getItemDef(a.itemId).height
        const areaB = getItemDef(b.itemId).width * getItemDef(b.itemId).height
        return areaB - areaA
      },
      (a: LootItem, b: LootItem) => {
        const wA = a.rotated ? getItemDef(a.itemId).height : getItemDef(a.itemId).width
        const wB = b.rotated ? getItemDef(b.itemId).height : getItemDef(b.itemId).width
        return wB - wA
      },
      (a: LootItem, b: LootItem) => {
        const areaA = getItemDef(a.itemId).width * getItemDef(a.itemId).height
        const areaB = getItemDef(b.itemId).width * getItemDef(b.itemId).height
        return areaA - areaB
      },
      () => Math.random() > 0.5 ? 1 : -1,
    ]

    for (const sortFn of strategies) {
      const sorted = [...box.items].sort(sortFn)
      if (tryPlaceAllLoot(sorted)) {
        return true
      }
    }

    // 多次随机尝试
    for (let attempt = 0; attempt < 50; attempt++) {
      const shuffled = [...box.items]
      _shuffleArray(shuffled)
      if (tryPlaceAllLoot(shuffled)) {
        return true
      }
    }

    return false

    function tryPlaceAllLoot(items: LootItem[]): boolean {
      const placed: typeof box.items = []

      for (const item of items) {
        const def = getItemDef(item.itemId)
        const grid = buildGrid(placed as any, box.rows, box.cols)

        const currentRotated = item.rotated
        const currentW = currentRotated ? def.height : def.width
        const currentH = currentRotated ? def.width : def.height

        // 使用 Best Fit
        let pos = findBestPlacement(grid, currentW, currentH, box.rows, box.cols)

        if (pos) {
          placed.push({
            instanceId: item.instanceId,
            itemId: item.itemId,
            searched: item.searched,
            row: pos.row,
            col: pos.col,
            rotated: currentRotated
          })
          continue
        }

        // 尝试翻转
        if (def.width !== def.height) {
          const flippedRotated = !currentRotated
          const flippedW = flippedRotated ? def.height : def.width
          const flippedH = flippedRotated ? def.width : def.height

          pos = findBestPlacement(grid, flippedW, flippedH, box.rows, box.cols)

          if (pos) {
            placed.push({
              instanceId: item.instanceId,
              itemId: item.itemId,
              searched: item.searched,
              row: pos.row,
              col: pos.col,
              rotated: flippedRotated
            })
            continue
          }
        }

        return false
      }

      const afterGrid = buildGrid(placed as any, box.rows, box.cols)

      if (findPlacement(afterGrid, targetW, targetH, box.rows, box.cols)) {
        box.items.splice(0, box.items.length, ...placed)
        return true
      }

      if (needRotation && findPlacement(afterGrid, targetH, targetW, box.rows, box.cols)) {
        box.items.splice(0, box.items.length, ...placed)
        return true
      }

      return false
    }
  }

  /**
   * 拖拽放回物资箱指定格（背包 → 物资箱，支持多格，支持单件换位）
   */
  function placeItemInLoot(instanceId: number, row: number, col: number, rotated = false): boolean {
    const box = currentBox.value
    if (!box) return false
    const bagIdx = bagItems.value.findIndex(i => i.instanceId === instanceId)
    if (bagIdx < 0) return false
    const bagItem = bagItems.value[bagIdx]
    const def = getItemDef(bagItem.itemId)
    // 如果没传旋转参数，使用背包中存储的旋转状态
    const isRotated = rotated !== undefined ? rotated : bagItem.rotated
    const { width: w, height: h } = getEffectiveSize(def, isRotated)

    // 检查边界（含下限）
    if (row < 0 || col < 0 || row + h > box.rows || col + w > box.cols) {
      lastPlaceError.value = 'out-of-bounds'
      return false
    }

    // 收集冲突
    const grid = buildGrid(box.items, box.rows, box.cols)
    const conflicts = getConflictIds(grid, row, col, w, h)

    if (conflicts.size > 1) {
      lastPlaceError.value = 'multi-conflict'
      return false
    }

    if (conflicts.size === 1) {
      // 把物资箱那件物品移到背包空位
      const conflictId = [...conflicts][0]
      const conflictLootItem = box.items.find(i => i.instanceId === conflictId)
      if (conflictLootItem) {
        const conflictDef = getItemDef(conflictLootItem.itemId)
        const bagPlacement = findPlacement(bagGrid.value, conflictDef.width, conflictDef.height, BAG_ROWS, BAG_COLS)
        if (!bagPlacement) {
          lastPlaceError.value = 'bag-full'
          return false
        }

        bagItems.value.push({
          instanceId: conflictId,
          itemId: conflictLootItem.itemId,
          row: bagPlacement.row,
          col: bagPlacement.col,
          rotated: conflictLootItem.rotated,
        })
        const lootConflictIdx = box.items.findIndex(i => i.instanceId === conflictId)
        if (lootConflictIdx >= 0) box.items.splice(lootConflictIdx, 1)
      }
    }

    box.items.push({ instanceId, itemId: bagItem.itemId, searched: true, row, col, rotated: isRotated })
    bagItems.value.splice(bagIdx, 1)
    return true
  }

  /**
   * 物资箱内部移动：支持多格，支持单件换位
   */
  function moveLootItem(instanceId: number, toRow: number, toCol: number, rotated = false): boolean {
    const box = currentBox.value
    if (!box) return false
    const item = box.items.find(i => i.instanceId === instanceId)
    if (!item) return false

    const def = getItemDef(item.itemId)
    const isRotated = rotated !== undefined ? rotated : item.rotated
    const { width: w, height: h } = getEffectiveSize(def, isRotated)

    // 同位置同旋转 → 无需操作
    if (item.row === toRow && item.col === toCol && item.rotated === isRotated) return true

    // 检查边界（含下限）
    if (toRow < 0 || toCol < 0 || toRow + h > box.rows || toCol + w > box.cols) {
      lastPlaceError.value = 'out-of-bounds'
      return false
    }

    // 收集冲突（排除自身）
    const grid = buildGrid(box.items, box.rows, box.cols)
    const conflicts = getConflictIds(grid, toRow, toCol, w, h, instanceId)

    if (conflicts.size > 1) {
      lastPlaceError.value = 'multi-conflict'
      return false
    }

    if (conflicts.size === 1) {
      // 单件换位：A → 目标位置，B → A 的原位
      const conflictId = [...conflicts][0]
      const conflictItem = box.items.find(i => i.instanceId === conflictId)
      if (conflictItem) {
        const conflictDef = getItemDef(conflictItem.itemId)
        const { width: conflictW, height: conflictH } = getEffectiveSize(conflictDef, conflictItem.rotated)

        // 边界检查：A 放目标位置，B 放 A 的原位，都必须完全在网格内
        const aInBounds = toRow >= 0 && toCol >= 0 && toRow + h <= box.rows && toCol + w <= box.cols
        const bInBounds = item.row >= 0 && item.col >= 0 && item.row + conflictH <= box.rows && item.col + conflictW <= box.cols
        if (!aInBounds || !bInBounds) {
          lastPlaceError.value = 'out-of-bounds'
          return false
        }

        // 构建排除 A 和 B 后的临时网格
        const tempItems = box.items.filter(i => i.instanceId !== instanceId && i.instanceId !== conflictId)
        const tempGrid = buildGrid(tempItems, box.rows, box.cols)

        // 用各自实际尺寸检查：A(w×h) 能否放在目标位置，B(conflictW×conflictH) 能否放在 A 的原位
        const aOk = canPlace(tempGrid, toRow, toCol, w, h, box.rows, box.cols)
        const bOk = canPlace(tempGrid, item.row, item.col, conflictW, conflictH, box.rows, box.cols)

        if (!aOk || !bOk) {
          lastPlaceError.value = 'multi-conflict'
          return false
        }

        // 额外检查：A 的新位置 与 B 的新位置（A 的原位）是否互相重叠
        // 换位后 A 在 (toRow,toCol) 尺寸(w×h)，B 在 (item.row,item.col) 尺寸(conflictW×conflictH)
        const aRight = toCol + w, aBottom = toRow + h
        const bRight = item.col + conflictW, bBottom = item.row + conflictH
        const swapOverlap = toRow < bBottom && aBottom > item.row && toCol < bRight && aRight > item.col
        if (swapOverlap) {
          lastPlaceError.value = 'multi-conflict'
          return false
        }

        // 执行换位：同时更新 A 的旋转状态
        const oldRow = item.row
        const oldCol = item.col
        item.row = toRow
        item.col = toCol
        item.rotated = isRotated  // ← 必须更新，否则物品尺寸与位置不匹配
        conflictItem.row = oldRow
        conflictItem.col = oldCol
        // conflictItem.rotated 保持不变
        return true
      }
    }

    // 无冲突 → 直接移动
    item.row = toRow
    item.col = toCol
    item.rotated = isRotated
    return true
  }

  /** 修正 searchState.itemIndex（物资箱中某个物品被移除后） */
  function _fixSearchIndexAfterRemove(removedIdx: number) {
    if (searchState.value.active && searchState.value.itemIndex > removedIdx) {
      searchState.value.itemIndex--
    }
  }

  // ── 玩家移动 ──────────────────────────────────
  function movePlayer(dx: number, dy: number, delta: number) {
    const speed = player.value.speed * delta
    let nx = player.value.x + dx * speed
    let ny = player.value.y + dy * speed

    const radius = 12
    const cols = [
      Math.floor((nx - radius) / TILE_SIZE),
      Math.floor((nx + radius) / TILE_SIZE),
    ]
    const rows = [
      Math.floor((ny - radius) / TILE_SIZE),
      Math.floor((ny + radius) / TILE_SIZE),
    ]
    const isBlocked = (r: number, c: number) => {
      if (r < 0 || r >= MAP_ROWS || c < 0 || c >= MAP_COLS) return true
      const t = mapCells.value[r]?.[c]?.terrain
      return t === 'wall' || t === 'building'
    }
    if (cols.some(c => rows.some(r => isBlocked(r, c)))) {
      const testCols = [
        Math.floor((nx - radius) / TILE_SIZE),
        Math.floor((nx + radius) / TILE_SIZE),
      ]
      const curRows = [
        Math.floor((player.value.y - radius) / TILE_SIZE),
        Math.floor((player.value.y + radius) / TILE_SIZE),
      ]
      if (testCols.some(c => curRows.some(r => isBlocked(r, c)))) nx = player.value.x

      const curCols = [
        Math.floor((player.value.x - radius) / TILE_SIZE),
        Math.floor((player.value.x + radius) / TILE_SIZE),
      ]
      const testRows = [
        Math.floor((ny - radius) / TILE_SIZE),
        Math.floor((ny + radius) / TILE_SIZE),
      ]
      if (curCols.some(c => testRows.some(r => isBlocked(r, c)))) ny = player.value.y
    }

    player.value.x = nx
    player.value.y = ny
  }

  // 检测附近物资箱
  function getNearbyBox(): LootBox | null {
    const px = player.value.x
    const py = player.value.y
    for (const box of lootBoxes.value) {
      const bx = box.x * TILE_SIZE + TILE_SIZE / 2
      const by = box.y * TILE_SIZE + TILE_SIZE / 2
      const dist = Math.sqrt((px - bx) ** 2 + (py - by) ** 2)
      if (dist < TILE_SIZE * 1.2) return box
    }
    return null
  }

  // 检测是否到达撤离点
  function checkExtract(): boolean {
    const px = player.value.x
    const py = player.value.y
    const dist = Math.sqrt((px - extractX.value) ** 2 + (py - extractY.value) ** 2)
    return dist < TILE_SIZE
  }

  // 找背包空位（兼容接口，供外部使用）
  function findBagPlacement(width = 1, height = 1): { row: number; col: number } | null {
    return findPlacement(bagGrid.value, width, height, BAG_ROWS, BAG_COLS)
  }

  // 攻击逻辑
  function attackNearbyEnemy(): boolean {
    const px = player.value.x
    const py = player.value.y
    for (const e of enemies.value) {
      if (!e.alive) continue
      const dist = Math.sqrt((px - e.x) ** 2 + (py - e.y) ** 2)
      if (dist < TILE_SIZE * 1.5) {
        e.hp -= 9999
        if (e.hp <= 0) {
          e.alive = false
          const col = Math.floor(e.x / TILE_SIZE)
          const row = Math.floor(e.y / TILE_SIZE)
          const dropBox: LootBox = {
            id: nextId(),
            x: col, y: row,
            cols: 6,
            rows: 2,
            items: Array.from({ length: 2 }, (_, i) => ({
              instanceId: nextId(),
              itemId: 'ancient_bone',
              searched: false,
              row: 0, col: i,
            })),
            level: 1,
            opened: false,
          }
          mapCells.value[row][col].lootBoxId = dropBox.id
          lootBoxes.value.push(dropBox)
        }
        return true
      }
    }
    return false
  }

  return {
    // state
    scene, mapCells, lootBoxes, enemies, extractX, extractY,
    player, bagItems, lootUIOpen, currentBoxId, searchState,
    playerStartX, playerStartY, lastPlaceError, rotatingItemId,
    // computed
    currentBox, bagGrid, lootGrid, bagUsed, bagTotal,
    // actions
    startNewGame, goScene, openLootBox, closeLootUI,
    tickSearch, pickItemToBag, placeItemInBag, moveBagItem,
    returnItemToBox, placeItemInLoot, moveLootItem,
    movePlayer, getNearbyBox, checkExtract,
    findBagPlacement, attackNearbyEnemy,
    BAG_COLS, BAG_ROWS,
  }
})
