<template>
  <v-app>
    <v-app-bar app>
      <v-app-bar-nav-icon variant="text" @click.stop="drawer = !drawer"></v-app-bar-nav-icon>
      <v-toolbar-title>ThreatBrowser</v-toolbar-title>
      <v-spacer></v-spacer>
      <v-btn small class="ma-4" @click="manageModal">
        <v-icon left>mdi-account-plus</v-icon>
        Create profile
      </v-btn>
    </v-app-bar>
    <v-main>
      <v-navigation-drawer v-model="drawer" temporary>
        <v-list>
          <v-list-item v-for="item in items" :key="item.title" :to="item.route" link>
            <v-row align="center">
              <v-col cols="auto">
                <v-icon>{{ item.icon }}</v-icon>
              </v-col>
              <v-col>
                <v-list-item-title>{{ item.title }}</v-list-item-title>
              </v-col>
            </v-row>
          </v-list-item>
        </v-list>
      </v-navigation-drawer>
      <!-- Pass the searchQuery to the router-view (Home.vue) -->
      <router-view />
    </v-main>
    <!-- Include the CreateProfileModal component -->
    <CreateProfileModal
      :is-visible-modal="isModalVisible"
      @update:model-value="isModalVisible = $event"
    />
  </v-app>
</template>

<script setup>
import { ref } from 'vue'
import CreateProfileModal from './components/CreateProfileModal.vue'
import logger from './logger/logger'
logger.debug('App.vue loaded')
const drawer = ref(false)
const isModalVisible = ref(false)
function manageModal() {
  isModalVisible.value = !isModalVisible.value
  logger.debug('CreateProfileModal loaded')
}
const items = [
  { title: 'Profiles', icon: 'mdi-account', route: '/' },
  { title: 'Proxies', icon: 'mdi-shield-account', route: '/proxies' }
]
</script>

<style scoped>
.search-bar {
  max-width: 300px;
}
</style>
