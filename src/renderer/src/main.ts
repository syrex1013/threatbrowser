import '@mdi/font/css/materialdesignicons.css'
import './assets/main.css'

import { createApp } from 'vue'
import App from './App.vue'

// Vuetify
import 'vuetify/styles'
import { createVuetify } from 'vuetify'
import * as components from 'vuetify/components'
import * as directives from 'vuetify/directives'
import { Profile, ProxyData } from '../../main/types'
//router
import router from './router/router'

//store
import { createStore } from 'vuex'

// Custom logger to maintain order of logs from browser
import logger from './logger/logger'

const store = createStore({
  state() {
    return {
      profiles: [] as Profile[],
      proxies: [] as ProxyData[]
    }
  },
  mutations: {
    fetchProfiles(state) {
      logger.info(`[store] Fetching profiles`)
      window.electron.ipcRenderer
        .invoke('load-profiles', '')
        .then((loadedProfiles) => {
          state.profiles = loadedProfiles
          logger.info(`[store] Profiles loaded: ${JSON.stringify(loadedProfiles)}`)
        })
        .catch((error) => {
          logger.error(`[store] Error loading profiles: ${error}`)
        })
    },
    deleteProfile(state, profileName) {
      logger.info(`[store] Deleting profile: ${profileName}`)
      window.electron.ipcRenderer.send('delete-profile', profileName)
      state.profiles = state.profiles.filter((profile) => profile.name !== profileName)
      logger.info(`[store] Profile deleted: ${profileName}`)
    },
    setLaunchedProfile(state, profileName) {
      logger.info(`[store] Setting launched profile: ${profileName}`)
      window.electron.ipcRenderer.send('change-profile-status', profileName)
      state.profiles.forEach((profile) => {
        if (profile.name === profileName) {
          profile.launched = !profile.launched
          logger.info(
            `[store] Profile status toggled: ${profileName} is now ${profile.launched ? 'launched' : 'not launched'}`
          )
        }
      })
    },
    fetchProxies(state) {
      logger.info(`[store] Fetching proxies`)
      window.electron.ipcRenderer
        .invoke('get-proxies', '')
        .then((loadedProxies) => {
          state.proxies = loadedProxies
          logger.info(`[store] Proxies loaded: ${JSON.stringify(loadedProxies)}`)
        })
        .catch((error) => {
          logger.error(`[store] Error loading proxies: ${error}`)
        })
    },
    deleteProxy(state, proxyID) {
      logger.info(`[store] Deleting proxy: ${proxyID}`)
      window.electron.ipcRenderer.invoke('delete-proxy', proxyID)
      state.proxies = state.proxies.filter((proxy) => proxy.id !== proxyID)
      logger.info(`[store] Proxy deleted: ${proxyID}`)
    },
    createProxy(state, proxy) {
      logger.info(`[store] Creating proxy: ${JSON.stringify(proxy)}`)
      window.electron.ipcRenderer.invoke('create-proxy', proxy)
      state.proxies.push(proxy)
      logger.info(`[store] Proxy created: ${JSON.stringify(proxy)}`)
    },
    parseProxyCreate(state, proxy) {
      logger.info(`[store] Parsing proxy and creating: ${JSON.stringify(proxy)}`)
      window.electron.ipcRenderer
        .invoke('parse-proxy-create', proxy)
        .then((parsedProxy) => {
          state.proxies.push(parsedProxy)
          logger.info(`[store] Parsed and created proxy: ${JSON.stringify(parsedProxy)}`)
        })
        .catch((error) => {
          logger.error(`[store] Error parsing and creating proxy: ${error}`)
        })
    }
  }
})

const vuetify = createVuetify({
  components,
  directives,
  ssr: false,
  theme: {
    defaultTheme: 'dark'
  }
})

createApp(App).use(vuetify).use(router).use(store).mount('#app')
