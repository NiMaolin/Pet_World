<template>
  <div class="game-world">
    <!-- 地图 Canvas -->
    <canvas ref="mapCanvas" class="map-canvas" />

    <!-- HUD -->
    <div class="hud">
      <div class="hud-row">❤️ HP: {{ store.player.hp }} / {{ store.player.maxHp }}</div>
      <div class="hud-row">🎒 背包: {{ store.bagUsed }} 件</div>
      <!-- <div class="hud-row hint">WASD移动 | F交互 | J攻击</div> -->
    </div>

    <!-- 附近提示 -->
    <div v-if="nearbyHint" class="nearby-hint">{{ nearbyHint }}</div>

    <!-- 撤离提示 -->
    <div v-if="nearExtract" class="extract-hint">✅ 撤离点 — 按 E 撤离</div>

    <!-- 物资箱 UI -->
    <LootUI v-if="store.lootUIOpen" />
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted, computed } from 'vue'
import { useRouter } from 'vue-router'
import { useGameStore } from '../game/stores/gameStore'
import { TILE_SIZE, MAP_COLS, MAP_ROWS } from '../game/utils/mapGen'
import LootUI from '../components/game/LootUI.vue'

const store = useGameStore()
const router = useRouter()
const mapCanvas = ref<HTMLCanvasElement | null>(null)

// 按键状态
const keys: Record<string, boolean> = {}
const handledKeys = new Set<string>()  // 记录已处理的按键

// 保存函数引用，确保 removeEventListener 能正确移除
function onKeyDown(e: KeyboardEvent) {
  const key = e.key.toLowerCase()
  keys[key] = true
  if (!handledKeys.has(key)) {
    handledKeys.add(key)
    handleAction(key)
  }
}
function onKeyUp(e: KeyboardEvent) {
  const key = e.key.toLowerCase()
  keys[key] = false
  handledKeys.delete(key)
}

window.addEventListener('keydown', onKeyDown)
window.addEventListener('keyup', onKeyUp)

function handleAction(key: string) {
  // F 键：打开/关闭物资箱
  if (key === 'f') {
    if (store.lootUIOpen) {
      store.closeLootUI()
    } else {
      const box = store.getNearbyBox()
      if (box) store.openLootBox(box.id)
    }
    return
  }
  // UI 打开时不处理其他按键
  if (store.lootUIOpen) return
  if (key === 'j') {
    store.attackNearbyEnemy()
  }
  if (key === 'e' && nearExtract.value) {
    store.goScene('extract-success')
    router.push('/')
  }
}

const nearbyHint = computed(() => {
  if (store.lootUIOpen) return '[F] 关闭物资箱'
  const box = store.getNearbyBox()
  if (box) {
    const unsearched = box.items.filter(i => !i.searched).length
    return unsearched > 0
      ? `[F] 搜索物资箱`
      : `[F] 打开物资箱`
  }
  return null
})

const nearExtract = computed(() => {
  if (store.lootUIOpen) return false
  return store.checkExtract()
})

// 游戏循环
let lastTime = 0
let animId = 0

function gameLoop(ts: number) {
  const delta = Math.min((ts - lastTime) / 1000, 0.05)
  lastTime = ts

  if (!store.lootUIOpen) {
    // 移动
    let dx = 0, dy = 0
    if (keys['w'] || keys['arrowup'])    dy = -1
    if (keys['s'] || keys['arrowdown'])  dy =  1
    if (keys['a'] || keys['arrowleft'])  dx = -1
    if (keys['d'] || keys['arrowright']) dx =  1
    if (dx !== 0 && dy !== 0) { dx *= 0.707; dy *= 0.707 }
    if (dx !== 0 || dy !== 0) store.movePlayer(dx, dy, delta)
  }

  // 搜索 tick
  if (store.lootUIOpen) store.tickSearch(delta)

  // 渲染
  render()
  animId = requestAnimationFrame(gameLoop)
}

// ─── 渲染 ───────────────────────────────────────────
const TERRAIN_COLORS: Record<string, string> = {
  floor:    '#2a2a2a',
  wall:     '#59524a',
  building: '#72665a',
  grass:    '#2d4a2d',
}
const TERRAIN_DETAIL: Record<string, string> = {
  wall:     '#6b5f52',
  building: '#8a7a6e',
}

function render() {
  const canvas = mapCanvas.value
  if (!canvas) return
  const ctx = canvas.getContext('2d')
  if (!ctx) return

  const W = canvas.width, H = canvas.height
  ctx.clearRect(0, 0, W, H)

  // 相机跟随玩家（居中）
  const camX = store.player.x - W / 2
  const camY = store.player.y - H / 2

  ctx.save()
  ctx.translate(-camX, -camY)

  // 绘制地图格子
  const cells = store.mapCells
  for (let r = 0; r < MAP_ROWS; r++) {
    for (let c = 0; c < MAP_COLS; c++) {
      const cell = cells[r]?.[c]
      if (!cell) continue
      const x = c * TILE_SIZE, y = r * TILE_SIZE
      ctx.fillStyle = TERRAIN_COLORS[cell.terrain] ?? '#222'
      ctx.fillRect(x, y, TILE_SIZE, TILE_SIZE)
      // 细节
      if (TERRAIN_DETAIL[cell.terrain]) {
        ctx.fillStyle = TERRAIN_DETAIL[cell.terrain]
        ctx.fillRect(x + 4, y + 4, TILE_SIZE - 10, TILE_SIZE - 10)
        ctx.fillStyle = 'rgba(255,255,255,0.07)'
        ctx.fillRect(x + 2, y + 2, TILE_SIZE - 4, 3)
      }
      // 格子线
      ctx.strokeStyle = 'rgba(255,255,255,0.04)'
      ctx.strokeRect(x, y, TILE_SIZE, TILE_SIZE)
    }
  }

  // 绘制物资箱
  for (const box of store.lootBoxes) {
    const x = box.x * TILE_SIZE, y = box.y * TILE_SIZE
    ctx.fillStyle = box.opened ? '#4a3a28' : '#7a5a2a'
    ctx.fillRect(x + 8, y + 12, TILE_SIZE - 16, TILE_SIZE - 20)
    ctx.strokeStyle = box.opened ? '#6a5a3a' : '#c8a040'
    ctx.lineWidth = 2
    ctx.strokeRect(x + 8, y + 12, TILE_SIZE - 16, TILE_SIZE - 20)
    // 箱子扣
    ctx.fillStyle = box.opened ? '#6a5a3a' : '#e0b840'
    ctx.fillRect(x + TILE_SIZE / 2 - 4, y + TILE_SIZE / 2 - 4, 8, 8)
  }

  // 绘制撤离点
  const ex = store.extractX, ey = store.extractY
  ctx.fillStyle = 'rgba(100,200,100,0.25)'
  ctx.fillRect(ex, ey, TILE_SIZE, TILE_SIZE)
  ctx.strokeStyle = '#4fc04f'
  ctx.lineWidth = 2
  ctx.strokeRect(ex, ey, TILE_SIZE, TILE_SIZE)
  ctx.fillStyle = '#4fc04f'
  ctx.font = 'bold 12px sans-serif'
  ctx.textAlign = 'center'
  ctx.fillText('撤离', ex + TILE_SIZE / 2, ey + TILE_SIZE / 2 + 4)

  // 绘制敌人
  for (const e of store.enemies) {
    if (!e.alive) continue
    ctx.fillStyle = '#c03020'
    ctx.beginPath()
    ctx.arc(e.x, e.y, 16, 0, Math.PI * 2)
    ctx.fill()
    ctx.fillStyle = '#ff6050'
    ctx.beginPath()
    ctx.arc(e.x - 4, e.y - 3, 4, 0, Math.PI * 2)
    ctx.arc(e.x + 4, e.y - 3, 4, 0, Math.PI * 2)
    ctx.fill()
  }

  // 绘制玩家
  const px = store.player.x, py = store.player.y
  ctx.fillStyle = '#3080e0'
  ctx.beginPath()
  ctx.arc(px, py, 12, 0, Math.PI * 2)
  ctx.fill()
  ctx.strokeStyle = '#80c0ff'
  ctx.lineWidth = 2
  ctx.stroke()
  // 方向点
  ctx.fillStyle = '#fff'
  ctx.beginPath()
  ctx.arc(px, py - 7, 3, 0, Math.PI * 2)
  ctx.fill()

  ctx.restore()
}

onMounted(() => {
  const canvas = mapCanvas.value!
  canvas.width = window.innerWidth
  canvas.height = window.innerHeight
  window.addEventListener('resize', () => {
    canvas.width = window.innerWidth
    canvas.height = window.innerHeight
  })
  lastTime = performance.now()
  animId = requestAnimationFrame(gameLoop)
})

onUnmounted(() => {
  cancelAnimationFrame(animId)
  window.removeEventListener('keydown', onKeyDown)
  window.removeEventListener('keyup', onKeyUp)
})
</script>

<style scoped>
.game-world {
  position: relative;
  width: 100vw;
  height: 100vh;
  overflow: hidden;
  background: #111;
}
.map-canvas {
  position: absolute;
  top: 0; left: 0;
}
.hud {
  position: absolute;
  top: 12px; left: 12px;
  background: rgba(0,0,0,0.6);
  padding: 10px 14px;
  border-radius: 6px;
  display: flex;
  flex-direction: column;
  gap: 4px;
}
.hud-row { font-size: 14px; color: #ddd; }
.hint { font-size: 11px; color: #888; margin-top: 4px; }

.nearby-hint {
  position: absolute;
  bottom: 80px;
  left: 50%;
  transform: translateX(-50%);
  background: rgba(0,0,0,0.75);
  color: #e8d5a0;
  padding: 8px 20px;
  border-radius: 4px;
  font-size: 14px;
  border: 1px solid rgba(232,213,160,0.3);
}
.extract-hint {
  position: absolute;
  bottom: 120px;
  left: 50%;
  transform: translateX(-50%);
  background: rgba(0,80,0,0.8);
  color: #80ff80;
  padding: 8px 20px;
  border-radius: 4px;
  font-size: 14px;
}
</style>
