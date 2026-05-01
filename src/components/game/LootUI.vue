<template>
  <div class="loot-overlay" @mousedown.self="store.closeLootUI()">
    <div class="loot-panel">

      <!-- 标题栏 -->
      <div class="title-row">
        <span class="title-icon">🎁</span>
        <span>搜索物资箱</span>
        <button class="close-btn" @click="store.closeLootUI()">✕</button>
      </div>

      <!-- 失败提示 -->
      <Transition name="toast">
        <div v-if="toastMsg" class="toast">{{ toastMsg }}</div>
      </Transition>

      <!-- 搜索进度条 -->
      <!-- <div class="search-bar-wrap">
        <div class="search-label">
          {{ searchDone ? '搜索完成' : `搜索中... ${Math.round(searchProgress * 100)}%` }}
        </div>
        <div class="search-bar-bg">
          <div class="search-bar-fill" :style="{ width: (searchProgress * 100) + '%' }" />
        </div>
      </div> -->

      <!-- 两列面板 -->
      <div class="columns">

        <!-- ── 背包 ─────────────────────────────────── -->
        <div class="panel-side">
          <div class="side-title">
            🎒 我的背包 ({{ store.BAG_COLS }}×{{ store.BAG_ROWS }})
          </div>
          <div
            ref="bagGridRef"
            class="item-grid"
            :style="bagGridStyle"
            tabindex="0"
            @drop.prevent="onBagGridDrop"
            @dragover.prevent="onBagGridDragOver"
            @dragleave="clearHighlight"
          >
            <!-- 背景格子（BAG_ROWS × BAG_COLS 个，用索引推算 row/col） -->
            <div
              v-for="idx in store.BAG_ROWS * store.BAG_COLS"
              :key="`bag-cell-${idx}`"
              class="grid-cell"
              :class="{ highlight: isBagHighlight(Math.floor((idx-1) / store.BAG_COLS), (idx-1) % store.BAG_COLS) }"
            />
            <!-- 物品层（绝对定位） -->
            <ItemCell
              v-for="item in store.bagItems"
              :key="item.instanceId"
              :item="item"
              cell-type="bag"
              :is-rotated="getEffectiveRotated(item)"
              @dragstart-item="(id, oRow, oCol, isDrag) => onBagDragStart(id, oRow, oCol, isDrag)"
              @dblclick-item="onBagDblClick"
              @rotate-item="onRotateItem"
            />
          </div>
        </div>

        <!-- ── 物资箱 ───────────────────────────────── -->
        <div class="panel-side">
          <div class="side-title">
            物资箱 
          </div>
          <div
            ref="lootGridRef"
            class="item-grid"
            :style="lootGridStyle"
            tabindex="0"
            @drop.prevent="onLootGridDrop"
            @dragover.prevent="onLootGridDragOver"
            @dragleave="clearHighlight"
          >
            <!-- 背景格子 -->
            <template v-for="r in lootGridRows" :key="`loot-row-${r}`">
              <div
                v-for="c in LOOT_COLS"
                :key="`loot-${r}-${c}`"
                class="grid-cell"
                :class="{ highlight: isLootHighlight(r-1, c-1) }"
              />
            </template>
            <!-- 物品层（绝对定位） -->
            <ItemCell
              v-for="item in lootItems"
              :key="item.instanceId"
              :item="item"
              cell-type="loot"
              :is-searching="isSearchingThis(item)"
              :is-rotated="getEffectiveRotated(item)"
              @dragstart-item="(id, oRow, oCol) => onLootDragStart(id, oRow, oCol)"
              @dblclick-item="onLootDblClick"
              @rotate-item="onRotateItem"
            />
          </div>
        </div>

      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useGameStore } from '../../game/stores/gameStore'
import { getItemDef } from '../../game/data/items'
import type { LootItem } from '../../game/types'
import ItemCell from './ItemCell.vue'

const store = useGameStore()

const CELL_SIZE = 40  // px per grid cell
const GAP = 1         // grid gap
const LOOT_COLS = 6
const LOOT_ROWS = 4    // 固定行数，与 mapGen.ts BOX_ROWS 保持一致

// ── 计算属性 ──────────────────────────────────────────────

const box = computed(() => store.currentBox)
const lootItems = computed(() => box.value?.items ?? [])

const lootGridRows = computed(() => LOOT_ROWS)

// grid 容器样式（用 CSS grid 铺背景格子，物品绝对定位于其上）
const bagGridStyle = computed(() => ({
  position: 'relative' as const,
  display: 'grid',
  gridTemplateColumns: `repeat(${store.BAG_COLS}, ${CELL_SIZE}px)`,
  gridTemplateRows: `repeat(${store.BAG_ROWS}, ${CELL_SIZE}px)`,
  gap: `${GAP}px`,
  width: store.BAG_COLS * (CELL_SIZE + GAP) - GAP + 'px',
  height: store.BAG_ROWS * (CELL_SIZE + GAP) - GAP + 'px',
}))

const lootGridStyle = computed(() => ({
  position: 'relative' as const,
  display: 'grid',
  gridTemplateColumns: `repeat(${LOOT_COLS}, ${CELL_SIZE}px)`,
  gridTemplateRows: `repeat(${lootGridRows.value}, ${CELL_SIZE}px)`,
  gap: `${GAP}px`,
  width: LOOT_COLS * (CELL_SIZE + GAP) - GAP + 'px',
  height: lootGridRows.value * (CELL_SIZE + GAP) - GAP + 'px',
}))

// ── 搜索进度 ──────────────────────────────────────────────

// const searchProgress = computed(() => {
//   const s = store.searchState
//   if (!s.active) return box.value?.items.every(i => i.searched) ? 1 : 0
//   return Math.min(s.elapsed / s.targetTime, 1)
// })
// const searchDone = computed(() =>
//   !store.searchState.active && (box.value?.items.every(i => i.searched) ?? false)
// )

function isSearchingThis(item: LootItem): boolean {
  return store.searchState.active &&
    store.searchState.itemIndex === box.value?.items.indexOf(item)
}

// ── 拖拽状态 ──────────────────────────────────────────────

interface DragState {
  id: number
  source: 'loot' | 'bag'
  offsetRow: number  // 鼠标在物品内的行偏移（格子索引）
  offsetCol: number  // 鼠标在物品内的列偏移（格子索引）
  rotated: boolean   // 预览旋转状态（自动计算）
}
const dragging = ref<DragState | null>(null)

// 保存物品的原始旋转状态（用于在拖拽时保持原位置不变）
const originalRotations = ref<Map<number, boolean>>(new Map())

// 高亮预览区域（[row, col][]）
const bagHighlightCells = ref<Set<string>>(new Set())
const lootHighlightCells = ref<Set<string>>(new Set())

function isBagHighlight(r: number, c: number) {
  return bagHighlightCells.value.has(`${r},${c}`)
}
function isLootHighlight(r: number, c: number) {
  return lootHighlightCells.value.has(`${r},${c}`)
}
function clearHighlight() {
  bagHighlightCells.value = new Set()
  lootHighlightCells.value = new Set()
}

/**
 * 判断物品是否正在被拖拽
 */
function isBeingDragged(instanceId: number): boolean {
  return dragging.value?.id === instanceId
}

/**
 * 获取物品的正确旋转状态
 * - 如果物品正在被拖拽：使用原始旋转状态（保持原位不变）
 * - 如果物品不在拖拽中：使用物品自身的旋转状态
 */
function getEffectiveRotated(item: BagItem | LootItem): boolean {
  if (isBeingDragged(item.instanceId)) {
    return originalRotations.value.get(item.instanceId) ?? item.rotated
  }
  return item.rotated
}

/** 根据鼠标在 grid 容器内的位置计算放置的左上角格子坐标 */
function getDropCell(e: DragEvent, containerEl: Element): { row: number; col: number } {
  const rect = containerEl.getBoundingClientRect()
  const localX = e.clientX - rect.left
  const localY = e.clientY - rect.top
  const cellW = CELL_SIZE + GAP
  const col = Math.floor(localX / cellW) - (dragging.value?.offsetCol ?? 0)
  const row = Math.floor(localY / cellW) - (dragging.value?.offsetRow ?? 0)
  return { row, col }
}

/** 获取拖拽中物品的尺寸（考虑旋转） */
function getDragItemDef() {
  if (!dragging.value) return null
  const id = dragging.value.id
  return getItemDef(
    dragging.value.source === 'loot'
      ? (box.value?.items.find(i => i.instanceId === id)?.itemId ?? '')
      : (store.bagItems.find(i => i.instanceId === id)?.itemId ?? '')
  )
}

/**
 * 检测物品在指定位置、指定方向是否能放下（严格边界 + 碰撞检测）
 * @param source 'bag' 或 'loot'
 * @param row 目标左上角行
 * @param col 目标左上角列
 * @param width 物品宽度
 * @param height 物品高度
 * @param excludeId 排除的物品ID（自身）
 */
function canPlaceAt(source: 'bag' | 'loot', row: number, col: number, width: number, height: number, excludeId: number): { valid: boolean; reason: string; conflicts: Set<number> } {
  const maxCols = source === 'bag' ? store.BAG_COLS : LOOT_COLS
  const maxRows = source === 'bag' ? store.BAG_ROWS : LOOT_ROWS
  
  // 1. 严格边界检测：任何超出都算失败
  if (row < 0 || col < 0 || row + height > maxRows || col + width > maxCols) {
    console.log('[LootUI] canPlaceAt: out-of-bounds', { row, col, width, height, maxRows, maxCols })
    return { valid: false, reason: 'out-of-bounds', conflicts: new Set() }
  }
  
  // 2. 收集冲突物品（与 store 中的 getConflictIds 逻辑完全一致）
  const targetItems = source === 'bag' ? store.bagItems : (box.value?.items ?? [])
  const conflicts = new Set<number>()
  
  // 遍历物品占用的每个格子
  for (const item of targetItems) {
    if (item.instanceId === excludeId) continue
    const def = getItemDef(item.itemId)
    const iw = item.rotated ? def.height : def.width
    const ih = item.rotated ? def.width : def.height
    
    // 检测物品边界是否与目标区域重叠
    const itemTop = item.row, itemLeft = item.col
    const itemBottom = item.row + ih, itemRight = item.col + iw
    const targetBottom = row + height, targetRight = col + width
    
    // 矩形重叠检测
    if (itemTop < targetBottom && itemBottom > row && itemLeft < targetRight && itemRight > col) {
      conflicts.add(item.instanceId)
    }
  }
  
  return { valid: true, reason: 'ok', conflicts }
}

/**
 * 智能自动旋转
 *
 * 核心原则（优先级从高到低）：
 * 1. 当前方向 0 冲突 → 完美，直接放入
 * 2. 当前方向 1 冲突 → 优先判断旋转能否变 0 冲突（填空隙）
 *    - 旋转后 0 冲突 → 自动旋转（玩家第一想法是填空，不是换位）
 *    - 旋转后仍有冲突 → 保持不变，让 store 执行换位
 * 3. 当前方向 ≥2 冲突或越界 → 尝试翻转
 *    - 翻转后 0 冲突 → 自动旋转（填空隙！）
 *    - 翻转后仍放不下 → 保持当前方向（让用户看到无法放置）
 *
 * 设计目标：
 * - 玩家拖到有空隙的地方 → 自动旋转填进去（最省心的体验）
 * - 拖到换位场景 → 不强制旋转，让 store 正常执行换位
 */
function autoSelectRotation(source: 'bag' | 'loot', baseRow: number, baseCol: number, def: ReturnType<typeof getItemDef>): boolean {
  if (!def || !dragging.value) return false

  const { id } = dragging.value
  const w = def.width
  const h = def.height

  // 正方形物品不需要旋转
  if (w === h) return dragging.value.rotated

  // 当前旋转状态 → 实际尺寸
  const isCurrentlyRotated = dragging.value.rotated
  const currentW = isCurrentlyRotated ? h : w
  const currentH = isCurrentlyRotated ? w : h

  // ── 当前方向 ──────────────────────────
  const currentResult = canPlaceAt(source, baseRow, baseCol, currentW, currentH, id)

  // 情况1：当前方向 0 冲突 → 完美，保持不变
  if (currentResult.valid && currentResult.conflicts.size === 0) {
    return dragging.value.rotated
  }

  // 情况2：当前方向 1 冲突 → 先看旋转能否变 0 冲突
  if (currentResult.valid && currentResult.conflicts.size === 1) {
    const flipped = !dragging.value.rotated
    const flippedW = flipped ? h : w
    const flippedH = flipped ? w : h
    const flippedResult = canPlaceAt(source, baseRow, baseCol, flippedW, flippedH, id)

    // 旋转后能 0 冲突 → 自动旋转填空隙（玩家第一想法是填空，不是换位）
    if (flippedResult.valid && flippedResult.conflicts.size === 0) {
      return flipped
    }

    // 旋转后仍有冲突 → 保持不变，让 store 执行换位
    return dragging.value.rotated
  }

  // 当前方向放不下（越界 ≥2 冲突）→ 尝试翻转
  // ── 翻转方向 ──────────────────────────
  const flipped = !dragging.value.rotated
  const flippedW = flipped ? h : w
  const flippedH = flipped ? w : h
  const flippedResult = canPlaceAt(source, baseRow, baseCol, flippedW, flippedH, id)

  // 翻转后 0 冲突 → 自动旋转（填空隙！）
  if (flippedResult.valid && flippedResult.conflicts.size === 0) {
    return flipped
  }

  // 两个方向都放不下 → 保持当前方向（让用户看到无法放置）
  return dragging.value.rotated
}

/** 统一的高亮刷新函数 */
function refreshHighlight(e: DragEvent, containerEl: Element) {
  if (!dragging.value) return
  const def = getDragItemDef()
  if (!def) return
  const { row, col } = getDropCell(e, containerEl)
  // 旋转：宽高互换
  const w = dragging.value.rotated ? def.height : def.width
  const h = dragging.value.rotated ? def.width  : def.height
  const cells = getItemCells(row, col, w, h)
  if (dragging.value.source === 'bag') {
    bagHighlightCells.value = new Set(cells)
  } else {
    lootHighlightCells.value = new Set(cells)
  }
}
function getItemCells(row: number, col: number, width: number, height: number): string[] {
  const cells: string[] = []
  for (let dr = 0; dr < height; dr++) {
    for (let dc = 0; dc < width; dc++) {
      cells.push(`${row + dr},${col + dc}`)
    }
  }
  return cells
}

// ── 拖拽开始 ──────────────────────────────────────────────
const bagGridRef = ref<HTMLElement | null>(null)
const lootGridRef = ref<HTMLElement | null>(null)

// R 键监听由 ItemCell 负责，此处不需要

function onLootDragStart(instanceId: number, offsetRow: number, offsetCol: number) {
  // 保存物品的原始旋转状态
  const lootItem = box.value?.items.find(i => i.instanceId === instanceId)
  if (lootItem) {
    originalRotations.value.set(instanceId, lootItem.rotated)
  }
  dragging.value = { id: instanceId, source: 'loot', offsetRow, offsetCol, rotated: lootItem?.rotated ?? false }
}
function onBagDragStart(instanceId: number, offsetRow: number, offsetCol: number) {
  // 保存物品的原始旋转状态
  const bagItem = store.bagItems.find(i => i.instanceId === instanceId)
  if (bagItem) {
    originalRotations.value.set(instanceId, bagItem.rotated)
  }
  dragging.value = { id: instanceId, source: 'bag', offsetRow, offsetCol, rotated: bagItem?.rotated ?? false }
}

// ── 旋转（已禁用手动旋转，仅保留接口） ──────────────────────
function onRotateItem(_instanceId: number) {
  // 手动旋转已禁用，物品方向由自动旋转逻辑决定
}
const lastDragInfo = ref<{ e: DragEvent; el: Element } | null>(null)

// ── 失败提示（队列机制：上一个消失后才显示下一个）───────────────────────
const toastMsg = ref('')
const toastTimer = ref<ReturnType<typeof setTimeout> | null>(null)
const toastQueue = ref<string[]>([])
const isToastShowing = ref(false)

function showToast(msg: string) {
  toastMsg.value = msg
  isToastShowing.value = true
  if (toastTimer.value) clearTimeout(toastTimer.value)
  toastTimer.value = setTimeout(() => {
    toastMsg.value = ''
    isToastShowing.value = false
    toastTimer.value = null
    // 显示队列中的下一条
    if (toastQueue.value.length > 0) {
      const next = toastQueue.value.shift()!
      showToast(next)
    }
  }, 2000)
}

// ── 背包区域：dragover + drop ──────────────────────────────

function onBagGridDragOver(e: DragEvent) {
  if (!dragging.value) return
  const el = e.currentTarget as Element
  lastDragInfo.value = { e, el }
  const def = getDragItemDef()
  if (!def) return
  const { row, col } = getDropCell(e, el)
  
  // 自动选择最优方向（包括越界时尝试旋转）
  const shouldRotate = autoSelectRotation('bag', row, col, def)
  if (shouldRotate !== dragging.value.rotated) {
    dragging.value.rotated = shouldRotate
  }
  
  const w = dragging.value.rotated ? def.height : def.width
  const h = dragging.value.rotated ? def.width  : def.height
  
  // 严格边界检测：不显示越界高亮
  if (row < 0 || col < 0 || row + h > store.BAG_ROWS || col + w > store.BAG_COLS) {
    bagHighlightCells.value = new Set()  // 清空高亮，表示无效位置
    return
  }
  
  bagHighlightCells.value = new Set(getItemCells(row, col, w, h))
}

function onBagGridDrop(e: DragEvent) {
  clearHighlight()
  if (!dragging.value) return
  const { row, col } = getDropCell(e, e.currentTarget as Element)
  const draggedId = dragging.value.id
  let ok = false

  if (dragging.value.source === 'loot') {
    ok = store.placeItemInBag(draggedId, row, col, dragging.value.rotated)
  } else {
    ok = store.moveBagItem(draggedId, row, col, dragging.value.rotated)
  }
  
  // 失败时显示 toast
  if (!ok) {
    const err = store.lastPlaceError
    const msgs: Record<string, string> = {
      'out-of-bounds': '超出格子边界，放置失败',
      'bag-full':      '背包已满，换位失败',
      'loot-full':     '物资箱已满，放置失败',
      'multi-conflict': '目标位置有多个物品，无法放置',
    }
    const msg = msgs[err] ?? '放置失败'
    if (isToastShowing.value) {
      toastQueue.value.push(msg)
    } else {
      showToast(msg)
    }
  } else {
    store.lastPlaceError = 'none'
  }
  
  // 清理
  originalRotations.value.delete(draggedId)
  dragging.value = null
}

// ── 物资箱区域：dragover + drop ──────────────────────────

function onLootGridDragOver(e: DragEvent) {
  if (!dragging.value) return
  const el = e.currentTarget as Element
  lastDragInfo.value = { e, el }
  const def = getDragItemDef()
  if (!def) return
  const { row, col } = getDropCell(e, el)
  
  // 自动选择最优方向
  const shouldRotate = autoSelectRotation('loot', row, col, def)
  if (shouldRotate !== dragging.value.rotated) {
    dragging.value.rotated = shouldRotate
  }
  
  const w = dragging.value.rotated ? def.height : def.width
  const h = dragging.value.rotated ? def.width  : def.height
  
  // 严格边界检测：不显示越界高亮
  if (row < 0 || col < 0 || row + h > LOOT_ROWS || col + w > LOOT_COLS) {
    lootHighlightCells.value = new Set()  // 清空高亮，表示无效位置
    return
  }
  
  lootHighlightCells.value = new Set(getItemCells(row, col, w, h))
}

function onLootGridDrop(e: DragEvent) {
  clearHighlight()
  if (!dragging.value) return
  const { row, col } = getDropCell(e, e.currentTarget as Element)
  const draggedId = dragging.value.id
  let ok = false

  if (dragging.value.source === 'bag') {
    ok = store.placeItemInLoot(draggedId, row, col, dragging.value.rotated)
  } else if (dragging.value.source === 'loot') {
    // loot 内部移动
    ok = store.moveLootItem(draggedId, row, col, dragging.value.rotated)
  }
  
  // 失败时显示 toast
  if (!ok) {
    const err = store.lastPlaceError
    const msgs: Record<string, string> = {
      'out-of-bounds': '超出格子边界，放置失败',
      'bag-full':      '背包已满，换位失败',
      'loot-full':     '物资箱已满，放置失败',
      'multi-conflict': '目标位置有多个物品，无法放置',
    }
    const msg = msgs[err] ?? '放置失败'
    if (isToastShowing.value) {
      toastQueue.value.push(msg)
    } else {
      showToast(msg)
    }
  } else {
    store.lastPlaceError = 'none'
  }
  
  // 清理
  originalRotations.value.delete(draggedId)
  dragging.value = null
}

// ── 双击 ─────────────────────────────────────────────────

function onLootDblClick(instanceId: number) {
  const ok = store.pickItemToBag(instanceId)
  if (!ok) {
    const err = store.lastPlaceError
    const msgs: Record<string, string> = {
      'out-of-bounds': '超出格子边界，放置失败',
      'bag-full':      '背包已满，换位失败',
      'loot-full':     '物资箱已满，放置失败',
      'multi-conflict': '目标位置有多个物品，无法放置',
    }
    const msg = msgs[err] ?? '放置失败'
    if (isToastShowing.value) {
      toastQueue.value.push(msg)
    } else {
      showToast(msg)
    }
  }
}
function onBagDblClick(instanceId: number) {
  const ok = store.returnItemToBox(instanceId)
  if (!ok) {
    const err = store.lastPlaceError
    const msgs: Record<string, string> = {
      'out-of-bounds': '超出格子边界，放置失败',
      'bag-full':      '背包已满，换位失败',
      'loot-full':     '物资箱已满，放置失败',
      'multi-conflict': '目标位置有多个物品，无法放置',
    }
    const msg = msgs[err] ?? '放置失败'
    if (isToastShowing.value) {
      toastQueue.value.push(msg)
    } else {
      showToast(msg)
    }
  }
}
</script>

<style scoped>
.loot-overlay {
  position: fixed; inset: 0;
  background: rgba(0,0,0,0.55);
  display: flex; align-items: center; justify-content: center;
  z-index: 100;
}

.loot-panel {
  background: #1a1a2e;
  border: 1px solid #333;
  border-radius: 8px;
  padding: 16px;
  min-width: 720px;
  max-width: 92vw;
  box-shadow: 0 8px 32px rgba(0,0,0,0.7);
}

.title-row {
  display: flex; align-items: center; gap: 8px;
  font-size: 15px; font-weight: bold; color: #e8d5a0;
  margin-bottom: 10px;
}
.title-icon { font-size: 18px; }
.close-btn {
  margin-left: auto; background: transparent;
  color: #aaa; font-size: 16px; padding: 2px 8px;
  border-radius: 4px; transition: background 0.1s;
}
.close-btn:hover { background: rgba(255,255,255,0.1); color: #fff; }

/* ── 失败提示 toast ── */
.toast {
  position: absolute;
  top: 20px;
  left: 50%;
  transform: translateX(-50%);
  background: rgba(20, 10, 10, 0.95);
  border: 1px solid #c03030;
  color: #ff8080;
  padding: 10px 20px;
  border-radius: 6px;
  font-size: 13px;
  pointer-events: none;
  z-index: 200;
  white-space: nowrap;
}
.toast-enter-active, .toast-leave-active { transition: opacity 0.2s; }
.toast-enter-from, .toast-leave-to { opacity: 0; }

.search-bar-wrap { margin-bottom: 12px; }
.search-label { font-size: 13px; color: #ccc; text-align: center; margin-bottom: 4px; }
.search-bar-bg { height: 8px; background: #333; border-radius: 4px; overflow: hidden; }
.search-bar-fill {
  height: 100%;
  background: linear-gradient(90deg, #4080ff, #40c0ff);
  border-radius: 4px; transition: width 0.1s linear;
}

.columns { display: flex; gap: 20px; align-items: flex-start; }
.panel-side { flex-shrink: 0; }
.side-title {
  font-size: 13px; color: #f07030;
  margin-bottom: 8px; display: flex; align-items: center; gap: 8px;
}

/* 网格容器：CSS grid 铺背景格 + relative 供物品绝对定位 */
.item-grid {
  background: #0e0e1a;
  border: 1px solid #333;
  border-radius: 3px;
}

/* 背景格子 */
.grid-cell {
  background: #1a1a2e;
  border: 1px solid #252535;
  box-sizing: border-box;
  transition: background 0.1s;
}
.grid-cell.highlight {
  background: rgba(64, 128, 255, 0.25);
  border-color: #4080ff;
}
</style>
