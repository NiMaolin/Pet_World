<template>
  <div class="main-menu">
    <div class="title">
      <h1>宠物搜打撤</h1>
      <p class="subtitle">Pet Extraction</p>
    </div>
    <div class="menu-box">
      <button class="menu-btn" @click="onNewGame">开始游戏</button>
      <button class="menu-btn disabled" disabled>读取存档</button>
      <button class="menu-btn" @click="onQuit">退出游戏</button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { useRouter } from 'vue-router'
import { useGameStore } from '../game/stores/gameStore'

const router = useRouter()
const store = useGameStore()

function onNewGame() {
  store.startNewGame()
  router.push('/game')
}
function onQuit() {
  window.close()
}
</script>

<style scoped>
.main-menu {
  width: 100vw;
  height: 100vh;
  background: #0d0d1e;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 60px;
}

.title h1 {
  font-size: 48px;
  font-weight: bold;
  text-align: center;
  color: #e8d5a0;
  text-shadow: 0 0 20px rgba(232, 213, 160, 0.5);
}

.subtitle {
  text-align: center;
  color: #888;
  font-size: 16px;
  margin-top: 8px;
}

.menu-box {
  display: flex;
  flex-direction: column;
  gap: 16px;
  background: rgba(0, 0, 0, 0.5);
  padding: 32px 48px;
  border-radius: 8px;
  min-width: 240px;
}

.menu-btn {
  padding: 12px 0;
  font-size: 18px;
  background: transparent;
  color: #e8d5a0;
  border: 1px solid transparent;
  border-radius: 4px;
  transition: all 0.15s;
  letter-spacing: 2px;
}
.menu-btn:hover:not(.disabled) {
  background: rgba(232, 213, 160, 0.12);
  border-color: rgba(232, 213, 160, 0.3);
  color: #fff;
}
.menu-btn:active:not(.disabled) {
  transform: scale(0.97);
}
.menu-btn.disabled {
  color: #555;
  cursor: not-allowed;
}
</style>
