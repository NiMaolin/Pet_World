<template>
  <ItemCell
    class="loot-cell-wrap"
    :item="item"
    cell-type="loot"
    :is-searching="isSearching"
    @dragstart-item="(id, oRow, oCol, isDrag) => emit('dragstart-item', id, oRow, oCol, isDrag)"
    @dblclick-item="(id) => emit('dblclick-item', id)"
    @rotate-item="(id) => emit('rotate-item', id)"
  />
</template>

<script setup lang="ts">
import type { LootItem } from '../../game/types'
import ItemCell from './ItemCell.vue'

const props = defineProps<{
  item: LootItem
  isSearching: boolean
}>()
const emit = defineEmits<{
  (e: 'dragstart-item', instanceId: number, offsetRow: number, offsetCol: number, isDragging: boolean): void
  (e: 'dblclick-item', instanceId: number): void
  (e: 'rotate-item', instanceId: number): void
}>()
</script>

<style scoped>
/* loot 专属：pointer 光标（未搜索时由 ItemCell 内部覆盖为 default） */
.loot-cell-wrap { cursor: pointer; }
</style>
