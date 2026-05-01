<template>
  <ItemCell
    class="bag-cell-wrap"
    :item="item"
    cell-type="bag"
    @dragstart-item="(id, oRow, oCol, isDrag) => emit('dragstart-item', id, oRow, oCol, isDrag)"
    @dblclick-item="(id) => emit('dblclick-item', id)"
    @rotate-item="(id) => emit('rotate-item', id)"
  />
</template>

<script setup lang="ts">
import type { BagItem } from '../../game/types'
import ItemCell from './ItemCell.vue'

const props = defineProps<{ item: BagItem }>()
const emit = defineEmits<{
  (e: 'dragstart-item', instanceId: number, offsetRow: number, offsetCol: number, isDragging: boolean): void
  (e: 'dblclick-item', instanceId: number): void
  (e: 'rotate-item', instanceId: number): void
}>()
</script>

<style scoped>
/* bag 专属：grab 光标 */
.bag-cell-wrap { cursor: grab; }
.bag-cell-wrap:active { cursor: grabbing; }
</style>
