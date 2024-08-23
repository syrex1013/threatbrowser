<template>
  <v-app>
    <v-app-bar app>
      <v-app-bar-nav-icon variant="text" @click.stop="drawer = !drawer"></v-app-bar-nav-icon>
      <v-toolbar-title>ThreatBrowser</v-toolbar-title>
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

      <router-view />
    </v-main>
  </v-app>
</template>

<script setup>
import { ref } from 'vue'
const drawer = ref(false)

const items = [
  { title: 'Profiles', icon: 'mdi-account', route: '/' },
  { title: 'Proxies', icon: 'mdi-shield-account', route: '/single-phish' }
]
</script>
