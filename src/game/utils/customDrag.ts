/**
 * 自定义拖拽系统 - 绕过HTML5 Drag and Drop的键盘限制
 * 使用鼠标事件模拟拖拽，可以正常监听键盘事件
 */

import { ref, type Ref } from 'vue'

export interface DragState {
  isDragging: boolean
  itemId: number | null
  startX: number
  startY: number
  currentX: number
  currentY: number
  offsetX: number
  offsetY: number
}

export function useCustomDrag() {
  const dragState = ref<DragState>({
    isDragging: false,
    itemId: null,
    startX: 0,
    startY: 0,
    currentX: 0,
    currentY: 0,
    offsetX: 0,
    offsetY: 0,
  })

  const keys = ref<Record<string, boolean>>({})

  // 全局键盘监听
  function handleKeyDown(e: KeyboardEvent) {
    keys.value[e.key.toLowerCase()] = true
    console.log('[CustomDrag] Key down:', e.key)
  }

  function handleKeyUp(e: KeyboardEvent) {
    keys.value[e.key.toLowerCase()] = false
    console.log('[CustomDrag] Key up:', e.key)
  }

  // 开始拖拽
  function startDrag(itemId: number, e: MouseEvent) {
    e.preventDefault()
    const target = e.currentTarget as HTMLElement
    const rect = target.getBoundingClientRect()
    
    dragState.value = {
      isDragging: true,
      itemId,
      startX: e.clientX,
      startY: e.clientY,
      currentX: e.clientX,
      currentY: e.clientY,
      offsetX: e.clientX - rect.left,
      offsetY: e.clientY - rect.top,
    }

    console.log('[CustomDrag] Start drag item:', itemId)

    // 添加全局事件监听
    document.addEventListener('mousemove', onDragMove)
    document.addEventListener('mouseup', onDragEnd)
    document.addEventListener('keydown', handleKeyDown)
    document.addEventListener('keyup', handleKeyUp)
  }

  // 拖拽中
  function onDragMove(e: MouseEvent) {
    if (!dragState.value.isDragging) return

    dragState.value.currentX = e.clientX
    dragState.value.currentY = e.clientY

    // 检查R键是否按下
    if (keys.value['r']) {
      console.log('[CustomDrag] R key pressed during drag!')
      // 这里可以触发旋转
    }
  }

  // 结束拖拽
  function onDragEnd(e: MouseEvent) {
    console.log('[CustomDrag] End drag, R key state:', keys.value['r'])
    
    const wasRotated = keys.value['r']
    
    // 清理事件监听
    document.removeEventListener('mousemove', onDragMove)
    document.removeEventListener('mouseup', onDragEnd)
    document.removeEventListener('keydown', handleKeyDown)
    document.removeEventListener('keyup', handleKeyUp)

    // 重置状态
    dragState.value.isDragging = false
    dragState.value.itemId = null

    // 如果R键被按下，触发旋转
    if (wasRotated && dragState.value.itemId) {
      console.log('[CustomDrag] Triggering rotation for item:', dragState.value.itemId)
      return { rotated: true, itemId: dragState.value.itemId }
    }

    return { rotated: false, itemId: null }
  }

  // 清理
  function cleanup() {
    document.removeEventListener('mousemove', onDragMove)
    document.removeEventListener('mouseup', onDragEnd)
    document.removeEventListener('keydown', handleKeyDown)
    document.removeEventListener('keyup', handleKeyUp)
  }

  return {
    dragState,
    startDrag,
    cleanup,
  }
}
