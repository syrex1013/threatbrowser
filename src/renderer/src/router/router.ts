import { createRouter, createWebHashHistory } from 'vue-router'
import Home from '../pages/home.vue'
import SinglePhish from '../pages/singlephish.vue'
import LivePhish from '../pages/livephish.vue'

const routes = [
  { path: '/', component: Home },
  { path: '/single-phish', component: SinglePhish },
  { path: '/live-phish', component: LivePhish }
]

const router = createRouter({
  history: createWebHashHistory(),
  routes
})

export default router
