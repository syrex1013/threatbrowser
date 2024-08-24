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

const store = createStore({
  state() {
    return {
      profiles: []
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
