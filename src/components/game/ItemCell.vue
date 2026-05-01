<template>
  <div
    class="item-cell"
    :class="[rarityClass, stateClass]"
    :style="cellStyle"
    :draggable="draggable"
    @dragstart.stop="onDragStart"
    @dblclick.stop="onDblClick"
    :title="displayTitle"
  >
    <!-- 未搜索（仅 loot 未搜索时） -->
    <template v-if="state === 'unsearched'">
      <span class="q-mark">?</span>
    </template>

    <!-- 正在搜索（仅 loot 搜索中时） -->
    <template v-else-if="state === 'searching'">
      <span class="q-mark white">?</span>
      <div class="spinner">▲</div>
    </template>

    <!-- 已搜索 / bag：显示物品信息 -->
    <template v-else>
      <span class="item-name">{{ itemDef.name }}</span>
      <!-- <span v-if="itemDef.width > 1 || itemDef.height > 1" class="size-badge">
        {{ itemDef.width }}×{{ itemDef.height }}
      </span> -->
    </template>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import type { BagItem, LootItem } from '../../game/types'
import { getItemDef } from '../../game/data/items'

// ── 常量 ──────────────────────────────────────────────────────
const CELL_SIZE = 40
const GAP = 1

// ── 类型 ──────────────────────────────────────────────────────
type CellType = 'bag' | 'loot'
type CellState = 'normal' | 'unsearched' | 'searching'

// ── Props ─────────────────────────────────────────────────────
const props = defineProps<{
  item: BagItem | LootItem
  cellType: CellType
  isSearching?: boolean   // 仅 loot 有意义，bag 忽略
  isRotated?: boolean    // 物品是否被旋转（宽高互换）
}>()

const emit = defineEmits<{
  (e: 'dragstart-item', instanceId: number, offsetRow: number, offsetCol: number): void
  (e: 'dblclick-item', instanceId: number): void
  (e: 'rotate-item', instanceId: number): void
}>()

// ── 派生数据 ──────────────────────────────────────────────────
const itemDef = computed(() => getItemDef(props.item.itemId))

/** 视觉状态：unsearched / searching / normal */
const state = computed<CellState>(() => {
  if (props.cellType === 'loot') {
    const lootItem = props.item as LootItem
    if (props.isSearching) return 'searching'
    if (!lootItem.searched) return 'unsearched'
  }
  return 'normal'
})

/** 是否可拖拽 */
const draggable = computed(() => {
  if (props.cellType === 'bag') return true
  const lootItem = props.item as LootItem
  return lootItem.searched
})

/** 稀有度 CSS 类 */
const rarityClass = computed(() => `rarity-${itemDef.value.rarity}`)

/** 状态 CSS 类 */
const stateClass = computed(() => {
  if (props.cellType === 'bag') return ''
  return state.value
})

/** 标题 */
const displayTitle = computed(() => {
  if (props.cellType === 'loot' && (props.item as LootItem).searched) {
    return itemDef.value.name
  }
  if (props.cellType === 'loot' && !state.value) {
    return '???'
  }
  return itemDef.value.name
})

// ── 样式 ──────────────────────────────────────────────────────
/** 渲染尺寸：考虑旋转状态 */
const displayWidth = computed(() =>
  props.isRotated ? itemDef.value.height : itemDef.value.width
)
const displayHeight = computed(() =>
  props.isRotated ? itemDef.value.width : itemDef.value.height
)

const cellStyle = computed(() => ({
  position: 'absolute' as const,
  left:  props.item.col * (CELL_SIZE + GAP) + 'px',
  top:   props.item.row * (CELL_SIZE + GAP) + 'px',
  width:  (displayWidth.value  * (CELL_SIZE + GAP) - GAP) + 'px',
  height: (displayHeight.value * (CELL_SIZE + GAP) - GAP) + 'px',
  zIndex: 2,
}))

// ── 事件 ─────────────────────────────────────────────────────

function onDragStart(e: DragEvent) {
  // loot 未搜索时禁止拖拽
  if (props.cellType === 'loot' && !(props.item as LootItem).searched) {
    e.preventDefault()
    return
  }
  
  const target = e.currentTarget as HTMLElement
  const rect = target.getBoundingClientRect()
  const offsetCol = Math.floor((e.clientX - rect.left) / (CELL_SIZE + GAP))
  const offsetRow = Math.floor((e.clientY - rect.top)  / (CELL_SIZE + GAP))
  e.dataTransfer?.setData('text/plain', JSON.stringify({
    instanceId: props.item.instanceId,
    offsetRow,
    offsetCol,
  }))
  // 通知父组件开始拖拽
  emit('dragstart-item', props.item.instanceId, offsetRow, offsetCol)
}

function onDblClick() {
  // loot 未搜索时双击无操作
  if (props.cellType === 'loot' && !(props.item as LootItem).searched) return
  emit('dblclick-item', props.item.instanceId)
}
</script>

<style scoped>
.item-cell {
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 11px;
  text-align: center;
  overflow: hidden;
  cursor: pointer;
  border: 1px solid transparent;
  border-radius: 2px;
  transition: filter 0.1s;
  padding: 2px;
  box-sizing: border-box;
  user-select: none;
}
.item-cell:hover { filter: brightness(1.3); }

/* ── 未搜索（仅 loot） ── */
.unsearched { background: #15151e; border-color: #2a2a3a; cursor: default; }
.q-mark { font-size: 18px; color: #555; font-weight: bold; }
.q-mark.white { color: #fff; }

/* ── 正在搜索（仅 loot） ── */
.searching { background: #7a1010; border-color: #c03030; cursor: wait; }
.spinner {
  position: absolute;
  bottom: 2px; right: 2px;
  font-size: 12px; color: #fff;
  animation: spin 0.8s linear infinite;
}
@keyframes spin {
  from { transform: rotate(0deg); }
  to   { transform: rotate(360deg); }
}

/* ── 已搜索 / bag 通用稀有度配色 ── */
.rarity-common    { background: #1e2a1e; border-color: #9d9d9d; color: #9d9d9d; }
.rarity-uncommon  { background: #1a2a1a; border-color: #1eff00; color: #1eff00; }
.rarity-rare      { background: #101828; border-color: #0070dd; color: #5aafff; }
.rarity-epic      { background: #1a1028; border-color: #a335ee; color: #c070ff; }
.rarity-legendary { background: #201208; border-color: #ff8000; color: #ffb040; }

/* bag 专用样式 */
:global(.bag-cell-wrap) .item-cell { cursor: grab; }
:global(.bag-cell-wrap) .item-cell:active { cursor: grabbing; }

/* ── 物品名称 & 尺寸标签 ── */
.item-name {
  font-size: 10px;
  line-height: 1.2;
  word-break: break-all;
  pointer-events: none;
}
.size-badge {
  position: absolute;
  bottom: 2px; right: 3px;
  font-size: 8px; opacity: 0.6;
  pointer-events: none;
}
</style>
