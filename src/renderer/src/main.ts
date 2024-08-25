import '@mdi/font/css/materialdesignicons.css'
import './assets/main.css'

import { createApp } from 'vue'
import App from './App.vue'

// Vuetify
import 'vuetify/styles'
import { createVuetify } from 'vuetify'
import * as components from 'vuetify/components'
import * as directives from 'vuetify/directives'

//router
import router from './router/router'

//store

import { createStore } from 'vuex'
import { c } from 'vite/dist/node/types.d-aGj9QkWt'

const store = createStore({
  state() {
    return {
      profiles: [],
      proxies: []
    }
  },
  mutations: {
    fetchProfiles(state) {
      window.electron.ipcRenderer.invoke('load-profiles', '').then((loadedProfiles) => {
        state.profiles = loadedProfiles
      })
    },
    deleteProfile(state, profileName) {
      window.electron.ipcRenderer.send('delete-profile', profileName)
      state.profiles = state.profiles.filter((profile) => profile.name !== profileName)
    },
    setLanchedProfile(state, profileName) {
      state.profiles.forEach((profile) => {
        if (profile.name === profileName) {
          profile.launched = !profile.launched
        }
      })
    },
    fetchProxies(state) {
      window.electron.ipcRenderer.invoke('get-proxies').then((loadedProxies) => {
        state.proxies = loadedProxies
      })
    },
    deleteProxy(state, proxyID) {
      window.electron.ipcRenderer.invoke('delete-proxy', proxyID)
      state.proxies = state.proxies.filter((proxy) => proxy.id !== proxyID)
    },
    createProxy(state, proxy) {
      window.electron.ipcRenderer.invoke('create-proxy', proxy)
      state.proxies.push(proxy)
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
