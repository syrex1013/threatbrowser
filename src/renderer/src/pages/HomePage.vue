<template>
  <v-container fluid>
    <v-data-table :headers="headers" :items="filteredProfiles" class="elevation-1">
      <template #item.status="{ item }">
        <v-chip color="primary" dark>
          <v-icon left>{{
            item.status === 'Active' ? 'mdi-check-circle' : 'mdi-close-circle'
          }}</v-icon>
          {{ item.status }}
        </v-chip>
      </template>
      <template #item.proxy="{ item }">
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
      <template #item.notes="{ item }">
        <v-textarea
          v-model="item.notes"
          outlined
          rows="2"
          class="notes-textarea"
          @change="updateNote(item)"
        ></v-textarea>
      </template>
      <template #item.actions="{ item }">
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
        </div>
      </template>
    </v-data-table>
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

// Props to accept searchQuery from App.vue
const props = defineProps({
  searchQuery: {
    type: String,
    default: ''
  }
})

const headers = [
  { title: 'Name', value: 'name' },
  { title: 'Status', value: 'status' },
  { title: 'Proxy', value: 'proxy' },
  { title: 'Notes', value: 'notes' },
  { title: 'Actions', value: 'actions', sortable: false }
]

const store = useStore()
const profiles = computed(() => store.state.profiles)
const proxies = computed(() => store.state.proxies)
const isEditModalVisible = ref(false)
const editingProfile = ref(null)
const oldProfileName = ref('')

// Computed property to filter profiles based on searchQuery
const filteredProfiles = computed(() => {
  if (!props.searchQuery) return profiles.value
  return profiles.value.filter((profile) =>
    profile.name.toLowerCase().includes(props.searchQuery.toLowerCase())
  )
})

function launchProfile(profile) {
  console.log('Launch button clicked', profile)
  window.electron.ipcRenderer.send('launch-profile', profile.name)
  store.commit('setLanchedProfile', profile.name)
}

function editProfile(profile) {
  console.log('Edit Profile button clicked', profile)
  editingProfile.value = { ...profile }
  oldProfileName.value = profile.name
  isEditModalVisible.value = true
}

function deleteProfile(profile) {
  console.log('Delete Profile button clicked', profile)
  store.commit('deleteProfile', profile.name)
}

function updateNote(profile) {
  window.electron.ipcRenderer.send('update-note', {
    name: profile.name,
    notes: profile.notes
  })
}

function getStatusColor(status) {
  switch (status) {
    case 'Working':
      return 'green'
    case 'Not Working':
      return 'red'
    default:
      return 'grey'
  }
}

function getProxyStatus(proxyId) {
  const proxy = proxies.value.find((p) => p.id === proxyId)
  return proxy ? proxy.status : 'Unknown'
}

function getProxyName(proxyId) {
  const proxy = proxies.value.find((p) => p.id === proxyId)
  return proxy ? proxy.name : 'Unknown'
}

onMounted(() => {
  store.commit('fetchProfiles')
  store.commit('fetchProxies')
})
</script>

<style scoped>
/* Style for notes textarea */
.notes-textarea {
  min-height: 50px;
  margin-top: 8px;
}

/* Style for action buttons container */
.action-buttons {
  display: flex;
  gap: 8px;
}
</style>
