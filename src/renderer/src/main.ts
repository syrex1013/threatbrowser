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

const vuetify = createVuetify({
  components,
  directives,
  ssr: false,
  theme: {
    defaultTheme: 'dark'
  }
})
createApp(App).use(vuetify).use(router).mount('#app')
