import { createRouter, createWebHashHistory } from 'vue-router'
import HomePage from '../pages/HomePage.vue'
import ProxyPage from '../pages/ProxyPage.vue'

const routes = [
  { path: '/', component: HomePage },
  { path: '/proxies', component: ProxyPage }
]

const router = createRouter({
  history: createWebHashHistory(),
  routes
})

export default router
