<template>
  <v-container fluid>
    <!-- Input Section -->
    <v-row class="mb-4">
      <v-col cols="12" md="6">
        <v-textarea
          v-model="proxyInput"
          label="Add Proxies (one per line)"
          rows="6"
          outlined
          color="primary"
          hint="Enter proxies in the format: type://username:password@host:port"
        ></v-textarea>
      </v-col>
      <v-col cols="12" md="6">
        <v-file-input
          v-model="proxyFile"
          label="Upload Proxy File"
          accept=".txt"
          outlined
          color="primary"
          @change="handleFileUpload"
        ></v-file-input>
      </v-col>
    </v-row>

    <!-- Action Buttons -->
    <v-row class="mb-4" justify="center">
      <v-btn color="primary" class="mx-2" @click="addProxies">
        <v-icon left>mdi-plus-circle</v-icon>
        Add Proxies
      </v-btn>
      <v-btn color="secondary" :disabled="loading" class="mx-2" @click="checkAllProxies">
        <v-icon left>mdi-check-network-outline</v-icon>
        Check All Proxies
        <v-progress-circular
          v-if="loading"
          indeterminate
          color="white"
          size="20"
          class="ml-2"
        ></v-progress-circular>
      </v-btn>
    </v-row>

    <!-- Data Table -->
    <v-data-table
      :headers="headers"
      :items="proxies"
      class="elevation-1 proxy-table"
      item-value="host"
      :items-per-page="5"
    >
      <!-- Table Templates... -->
      <template #[`item.country`]="{ item }">
        <v-chip v-if="item.country !== 'Unknown'" color="primary" dark>
          <v-icon left>
            <img
              :src="`http://purecatamphetamine.github.io/country-flag-icons/3x2/${item.country}.svg`"
              alt="Country Flag"
            />
          </v-icon>
          {{ item.country }}
        </v-chip>
        <template v-else> Unknown </template>
      </template>
      <!-- Other templates omitted for brevity -->
      <template #[`item.actions`]="{ item }">
        <div class="action-buttons">
          <v-btn color="success" small class="mr-2" @click="checkProxy(item)">
            <v-icon left>mdi-check-network</v-icon>
          </v-btn>
          <v-btn color="primary" small class="mr-2" @click="openEditProxyModal(item)">
            <v-icon left>mdi-pencil</v-icon>
          </v-btn>
          <v-btn color="error" small @click="deleteProxy(item)">
            <v-icon left>mdi-delete</v-icon>
          </v-btn>
        </div>
      </template>
    </v-data-table>

    <!-- Edit Proxy Modal -->
    <EditProxyModal
      :edit-modal="editModal"
      :edit-proxy-data="editProxyData"
      @save-proxy-edit="handleSaveProxyEdit"
    ></EditProxyModal>
  </v-container>
</template>

<script lang="ts" setup>
import { ref, computed, onMounted } from 'vue'
import { useStore } from 'vuex'
import logger from '../logger/logger'
import EditProxyModal from '@renderer/components/EditProxyModal.vue'
import { ProxyData } from '../types/types'

// Vuex store
const store = useStore()

// Reactive properties
const proxyInput = ref('')
const proxyFile = ref<File | null>(null)
const editModal = ref(false)
const editProxyData = ref<ProxyData | null>(null)
const loading = ref(false)

// Getters from the store
const proxies = computed(() => store.state.proxies)

// Fetch proxies from the store when component is mounted
onMounted(() => {
  store.dispatch('fetchProxies')
})

// Headers for the data table
const headers = [
  { title: 'Name', value: 'name' },
  { title: 'Country', value: 'country' },
  { title: 'Proxy Type', value: 'protocol' },
  { title: 'Proxy Address', value: 'host' },
  { title: 'Port', value: 'port' },
  { title: 'Username', value: 'username' },
  { title: 'Password', value: 'password' },
  { title: 'Status', value: 'status' },
  { title: 'Actions', value: 'actions', sortable: false }
]

// Function to wrap text
function wrapText(text: string, maxLength: number) {
  return text.length > maxLength ? text.slice(0, maxLength) + '...' : text
}

// Function to handle file upload and read the contents
function handleFileUpload() {
  if (!proxyFile.value) return
  const reader = new FileReader()
  reader.onload = (event) => {
    const fileContent = event.target?.result as string
    const fileProxies = fileContent.split('\n').map((line) => parseProxy(line.trim()))
    fileProxies.forEach((proxy) => {
      if (proxy) store.dispatch('createProxy', proxy)
    })
  }
  reader.readAsText(proxyFile.value)
}

// Function to add proxies from textarea input
function addProxies() {
  logger.info(`[ProxyPage] Adding proxies from input`)
  const manualProxies = proxyInput.value.split('\n').map((line) => parseProxy(line.trim()))
  manualProxies.forEach((proxy) => {
    if (proxy) store.dispatch('createProxy', proxy)
  })
  proxyInput.value = ''
}

// Function to parse proxy input
function parseProxy(proxy: string): ProxyData | null {
  const regex = /^(http|https|socks4|socks5):\/\/([^:]+):([^@]+)@([^:]+):(\d+)$/
  const match = proxy.match(regex)
  const name = generateProxyName()
  if (match) {
    return {
      name: name,
      protocol: match[1],
      username: match[2],
      password: match[3],
      host: match[4],
      port: parseInt(match[5], 10),
      status: 'Unchecked',
      id: Date.now(),
      country: 'Unknown'
    }
  }
  return null
}

// Generate a unique proxy name
function generateProxyName() {
  const existingNames = proxies.value.map((p) => p.name)
  let index = 1
  let name = `Proxy ${index}`
  while (existingNames.includes(name)) {
    index++
    name = `Proxy ${index}`
  }
  return name
}

// Function to check proxy status and save it
async function checkProxy(proxy: ProxyData) {
  logger.info(`[ProxyPage] Checking proxy: ${proxy.host}:${proxy.port}`)
  proxy.status = 'Checking...'
  try {
    await store.dispatch('getProxyCountry', {
      proxyId: proxy.id,
      proxy: `${proxy.protocol}://${proxy.username}:${proxy.password}@${proxy.host}:${proxy.port}`
    })
    await store.dispatch('getProxyStatus', {
      proxyId: proxy.id,
      proxy: `${proxy.protocol}://${proxy.username}:${proxy.password}@${proxy.host}:${proxy.port}`
    })
  } catch (error) {
    //deepclone
    const deepclone: ProxyData = JSON.parse(JSON.stringify(proxy))
    store.dispatch('editProxy', deepclone)
  }
}

// Function to check all proxies
async function checkAllProxies() {
  loading.value = true
  for (const proxy of proxies.value) {
    await checkProxy(proxy)
  }
  loading.value = false
}

// Function to delete a proxy
function deleteProxy(proxy: ProxyData) {
  const deepclone: ProxyData = JSON.parse(JSON.stringify(proxy))
  store.dispatch('deleteProxy', deepclone)
}

// Function to open the edit proxy modal
function openEditProxyModal(proxy: ProxyData) {
  editProxyData.value = { ...proxy }
  editModal.value = true
}

// Handle saving proxy edit
function handleSaveProxyEdit(updatedProxy: ProxyData) {
  store.dispatch('editProxy', updatedProxy)
  editModal.value = false
}

// Function to get status color
function getStatusColor(status: string) {
  switch (status) {
    case 'Working':
      return 'green'
    case 'Not Working':
      return 'red'
    case 'Checking...':
      return 'orange'
    default:
      return 'grey'
  }
}
</script>

<style scoped>
/* Table styling */
.proxy-table {
  border-radius: 8px;
  overflow: hidden;
}

.proxy-table .v-chip {
  margin: 0;
}

.action-buttons {
  display: flex;
  gap: 4px;
  flex-wrap: nowrap;
}
</style>
