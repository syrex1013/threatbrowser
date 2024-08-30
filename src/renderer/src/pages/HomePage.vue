<template>
  <v-container fluid>
    <v-data-table :headers="headers" :items="filteredProfiles" class="elevation-1 profile-table">
      <!-- Profile Name Slot -->
      <template #[`item.name`]="{ item }">
        <v-chip>{{ item.name }}</v-chip>
      </template>

      <!-- Status Slot -->
      <template #[`item.status`]="{ item }">
        <v-chip :color="item.launched ? 'green' : 'red'" dark>
          <v-icon left>{{ item.launched ? 'mdi-check-circle' : 'mdi-close-circle' }}</v-icon>
          {{ item.launched ? 'Launched' : 'Not Launched' }}
        </v-chip>
      </template>

      <!-- Proxy Slot -->
      <template #[`item.proxy`]="{ item }">
        <v-chip :color="getStatusColor(getProxyStatus(item.proxyId))" dark>
          <v-icon left>{{
            getProxyStatus(item.proxyId) === 'Working'
              ? 'mdi-shield-check'
              : getProxyStatus(item.proxyId) === 'Not Working'
                ? 'mdi-shield-off'
                : 'mdi-help-circle'
          }}</v-icon>
          {{ getProxyName(item.proxyId) }}
        </v-chip>
      </template>

      <!-- Notes Slot -->
      <template #[`item.notes`]="{ item }">
        <v-textarea
          v-model="item.notes"
          outlined
          rows="2"
          :items-per-page="5"
          class="mt-4"
          @change="updateNote(item)"
        ></v-textarea>
      </template>

      <!-- Actions Slot -->
      <template #[`item.actions`]="{ item }">
        <v-row justify="center">
          <div class="action-buttons">
            <v-btn color="green" small @click="launchProfile(item)">
              <v-icon left>mdi-play-circle</v-icon>
            </v-btn>
            <v-btn color="blue" small @click="editProfile(item)">
              <v-icon left>mdi-pencil</v-icon>
            </v-btn>
            <v-btn color="red" small @click="deleteProfile(item)">
              <v-icon left>mdi-delete</v-icon>
            </v-btn>
            <v-btn v-if="item.cookies" color="orange" small @click="exportCookies(item)">
              <v-icon left>mdi-cookie</v-icon>
            </v-btn>
          </div>
        </v-row>
      </template>
    </v-data-table>

    <!-- Modal -->
    <CreateProfileModal
      :is-visible-modal="isEditModalVisible"
      :profile="editingProfile"
      :old-profile-name="oldProfileName"
      @update:model-value="isEditModalVisible = $event"
    />
  </v-container>
</template>

<script lang="ts" setup>
import { ref, computed, onMounted } from 'vue'
import { useStore } from 'vuex'
import CreateProfileModal from '../components/CreateProfileModal.vue'
import logger from '../logger/logger'
import { Profile, ProxyData } from '../types/types'

// Define headers
const headers = [
  { title: 'Profile Name', value: 'name' },
  { title: 'Status', value: 'status' },
  { title: 'Proxy', value: 'proxy' },
  { title: 'Notes', value: 'notes' },
  { title: 'Actions', value: 'actions', sortable: false }
] as const

const store = useStore()

// Reactive data
const profiles = computed(() => store.state.profiles as Profile[])
const proxies = computed(() => store.state.proxies as ProxyData[])

// Modal states
const isEditModalVisible = ref(false)
const editingProfile = ref<Profile>()
const oldProfileName = ref('')

// Computed property to filter profiles based on searchQuery
const filteredProfiles = computed(() => {
  const searchQuery = store.state.searchQuery || ''
  if (!searchQuery) return profiles.value
  return profiles.value.filter((profile) =>
    profile.name.toLowerCase().includes(searchQuery.toLowerCase())
  )
})

// Actions
function launchProfile(profile: Profile): void {
  logger.debug('Launching profile')
  logger.info(`[HomePage] Launching profile: ${profile.id}`)
  const deepclone: Profile = JSON.parse(JSON.stringify(profile))
  store.dispatch('launchProfile', deepclone)
}

function editProfile(profile: Profile): void {
  logger.debug('Editing profile')
  logger.info(`[HomePage] Editing profile: ${profile.id}`)
  editingProfile.value = { ...profile }
  oldProfileName.value = profile.name
  isEditModalVisible.value = true
}

function deleteProfile(profile: Profile): void {
  logger.info(`[HomePage] Deleting profile: ${profile.id}`)
  const deepclone: Profile = JSON.parse(JSON.stringify(profile))
  store.dispatch('deleteProfile', deepclone)
}

function updateNote(profile: Profile): void {
  logger.info(`[HomePage] Updating notes for profile: ${profile.name}`)
  const deepclone: Profile = JSON.parse(JSON.stringify(profile))
  store.dispatch('editProfile', deepclone)
}

function getStatusColor(status: string): string {
  switch (status) {
    case 'Working':
      return 'green'
    case 'Not Working':
      return 'red'
    default:
      return 'grey'
  }
}

function getProxyStatus(proxyId?: number): string {
  const proxy = proxies.value.find((p) => p.id === proxyId)
  return proxy ? proxy.status : 'Unknown'
}

function getProxyName(proxyId?: number): string {
  const proxy = proxies.value.find((p) => p.id === proxyId)
  return proxy ? proxy.name : 'Unknown'
}

function exportCookies(profile: Profile): void {
  if (profile.cookies) {
    const blob = new Blob([profile.cookies], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${profile.name}_cookies.json`
    a.click()
    URL.revokeObjectURL(url)
    logger.info(`[HomePage] Exported cookies for profile: ${profile.name}`)
  } else {
    logger.error(`[HomePage] No cookies to export for profile: ${profile.name}`)
  }
}

// Fetch profiles and proxies on mount
onMounted(() => {
  store.dispatch('fetchProfiles')
  store.dispatch('fetchProxies')
})

// Handle profile closed event
window.electron.ipcRenderer.on('profile-closed', (_, profileName: string) => {
  logger.info(`[HomePage] Profile closed received: ${profileName}`)
  store.dispatch('fetchProfiles')
  logger.debug('Profile closed')
})
</script>

<style scoped>
/* Table styling */
.profile-table {
  border-radius: 8px;
  overflow: hidden;
}

.profile-table .v-chip {
  margin: 0;
}

.action-buttons {
  display: flex;
  gap: 4px;
  flex-wrap: nowrap;
}
</style>
