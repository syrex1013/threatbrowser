<template>
  <v-container fluid>
    <v-data-table :headers="headers" :items="profiles" class="elevation-1">
      <!-- Profile Name Slot -->
      <template #[`item.name`]="{ item }">
        <div class="centered-content">
          <v-chip>{{ item.name }}</v-chip>
        </div>
      </template>

      <!-- Status Slot -->
      <template #[`item.status`]="{ item }">
        <div class="centered-content">
          <v-chip :color="item.launched ? 'green' : 'red'" dark>
            <v-icon left>{{ item.launched ? 'mdi-check-circle' : 'mdi-close-circle' }}</v-icon>
            {{ item.launched ? 'Launched' : 'Not Launched' }}
          </v-chip>
        </div>
      </template>

      <!-- Proxy Slot -->
      <template #[`item.proxy`]="{ item }">
        <div class="centered-content">
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
        </div>
      </template>

      <!-- Notes Slot -->
      <template #[`item.notes`]="{ item }">
        <div class="centered-content">
          <v-textarea
            v-model="item.notes"
            outlined
            rows="2"
            class="notes-textarea"
            @change="updateNote(item)"
          ></v-textarea>
        </div>
      </template>

      <!-- Actions Slot -->
      <template #[`item.actions`]="{ item }">
        <div class="centered-content action-buttons">
          <v-btn color="green" small @click="launchProfile(item)">
            <v-icon left>mdi-play-circle</v-icon>
          </v-btn>
          <v-btn color="blue" small @click="editProfile(item)">
            <v-icon left>mdi-pencil</v-icon>
          </v-btn>
          <v-btn color="red" small @click="deleteProfile(item)">
            <v-icon left>mdi-delete</v-icon>
          </v-btn>
        </div>
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

// Props to accept searchQuery from App.vue
const props = defineProps({
  searchQuery: {
    type: String,
    default: ''
  }
})

// Define headers with the correct type
const headers = ref([
  { text: 'Profile Name', value: 'name', align: 'center' },
  { text: 'Status', value: 'status', align: 'center' },
  { text: 'Proxy', value: 'proxy', align: 'center' },
  { text: 'Notes', value: 'notes', align: 'center' },
  { text: 'Actions', value: 'actions', sortable: false, align: 'center' }
] as const)

const store = useStore()
const profiles = computed<Profile[]>(() => store.state.profiles as Profile[])
const proxies = computed<ProxyData[]>(() => store.state.proxies as ProxyData[])

const isEditModalVisible = ref(false)
const editingProfile = ref<Profile>()
const oldProfileName = ref('')

// Computed property to filter profiles based on searchQuery
const filteredProfiles = computed<Profile[]>(() => {
  if (!props.searchQuery) return profiles.value
  return profiles.value.filter((profile) =>
    profile.name.toLowerCase().includes(props.searchQuery.toLowerCase())
  )
})
logger.info(`[HomePage] Profiles: ${filteredProfiles.value}`)

function launchProfile(profile: Profile): void {
  logger.debug('Launching profile')
  logger.info(`[HomePage] Launching profile: ${profile.name}`)
  window.electron.ipcRenderer.send('launch-profile', profile.name)
  store.commit('setLaunchedProfile', profile.name)
}

function editProfile(profile: Profile): void {
  logger.debug('Editing profile')
  logger.info(`[HomePage] Editing profile: ${profile.name}`)
  editingProfile.value = { ...profile }
  oldProfileName.value = profile.name
  isEditModalVisible.value = true
}

function deleteProfile(profile: Profile): void {
  logger.info(`[HomePage] Deleting profile: ${profile.name}`)
  store.commit('deleteProfile', profile.name)
}

function updateNote(profile: Profile): void {
  logger.info(`[HomePage] Updating notes for profile: ${profile.name}`)
  window.electron.ipcRenderer.send('update-note', {
    name: profile.name,
    notes: profile.notes
  })
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

onMounted(() => {
  store.commit('fetchProfiles')
  store.commit('fetchProxies')
})

window.electron.ipcRenderer.on('profile-closed', (_, profileName: string) => {
  logger.info(`[HomePage] Profile closed received: ${profileName}`)
  store.commit('fetchProfiles')
  logger.debug('Profile closed')
})
</script>
