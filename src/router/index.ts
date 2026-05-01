import { createRouter, createWebHashHistory } from 'vue-router'
import MainMenu from '../views/MainMenu.vue'
import GameWorld from '../views/GameWorld.vue'

export const router = createRouter({
  history: createWebHashHistory(),
  routes: [
    { path: '/', component: MainMenu },
    { path: '/game', component: GameWorld },
  ],
})
