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
      <template #item.country="{ item }">
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
      <!-- Add icons to headers -->
      <template #column.protocol="{ column }">
        <span class="d-flex align-center">
          <v-icon>mdi-network</v-icon>
          <span class="ml-2">{{ column.text }}</span>
        </span>
      </template>

      <template #item.username="{ item }">
        <span class="d-flex align-center">
          <v-icon>mdi-account</v-icon>
          <span class="ml-2">{{ wrapText(item.username, 20) }}</span>
        </span>
      </template>

      <template #item.password="{ item }">
        <span class="d-flex align-center">
          <v-icon>mdi-lock</v-icon>
          <span class="ml-2">{{ wrapText(item.password, 20) }}</span>
        </span>
      </template>

      <template #column.port="{ column }">
        <span class="d-flex align-center">
          <v-icon>mdi-port-network</v-icon>
          <span class="ml-2">{{ column.text }}</span>
        </span>
      </template>

      <template #column.status="{ column }">
        <span class="d-flex align-center">
          <v-icon>mdi-status</v-icon>
          <span class="ml-2">{{ column.text }}</span>
        </span>
      </template>

      <!-- Display data with color-coded items -->
      <template #item.protocol="{ item }">
        <v-chip color="teal" dark>
          <v-icon left>
            {{
              item.protocol === 'http'
                ? 'mdi-web'
                : item.protocol === 'https'
                  ? 'mdi-lock'
                  : item.protocol === 'SOCKS4' || item.protocol === 'SOCKS5'
                    ? 'mdi-arrow-decision-auto'
                    : 'mdi-arrow-decision'
            }}
          </v-icon>
          {{ item.protocol.toUpperCase() }}
        </v-chip>
      </template>
      <template #item.status="{ item }">
        <v-chip :color="getStatusColor(item.status)" dark>
          <v-icon left>
            {{
              item.status === 'Working'
                ? 'mdi-check-circle'
                : item.status === 'Not Working'
                  ? 'mdi-close-circle'
                  : item.status === 'Checking...'
                    ? 'mdi-progress-clock'
                    : 'mdi-help-circle'
            }}
          </v-icon>
          {{ item.status }}
        </v-chip>
      </template>
      <template #item.actions="{ item }">
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
    <v-dialog v-model="editModal" max-width="600px">
      <v-card>
        <v-card-title>Edit Proxy</v-card-title>
        <v-card-text>
          <v-form ref="editForm">
            <v-text-field v-model="editProxyData.name" label="Name" required></v-text-field>
            <v-text-field
              v-model="editProxyData.protocol"
              label="Proxy Type"
              disabled
            ></v-text-field>
            <v-text-field
              v-model="editProxyData.host"
              label="Proxy Address"
              required
            ></v-text-field>
            <v-text-field
              v-model="editProxyData.port"
              label="Port"
              type="number"
              required
            ></v-text-field>
            <v-text-field v-model="editProxyData.username" label="Username"></v-text-field>
            <v-text-field
              v-model="editProxyData.password"
              label="Password"
              type="password"
            ></v-text-field>
          </v-form>
        </v-card-text>
        <v-card-actions>
          <v-spacer></v-spacer>
          <v-btn color="primary" @click="saveProxyEdit">Save</v-btn>
          <v-btn text @click="editModal = false">Cancel</v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>
  </v-container>
</template>

<script lang="ts" setup>
import { ref, onMounted } from 'vue'
import { ProxyData } from '../../../main/types'
import { useStore } from 'vuex'
import terminal from 'virtual:terminal'
terminal.log('ProxyPage.vue loaded')
// Data setup
const proxyInput = ref('')
const proxyFile = ref<File | null>(null)
const proxies = ref<Array<ProxyData>>([])

// Modal states and edit proxy data
const editModal = ref(false)
const editProxyData = ref<ProxyData | null>(null)

// Load proxies when the component is mounted
onMounted(async () => {
  proxies.value = store.state.proxies
})

// Loading state
const loading = ref(false)

// store
const store = useStore()

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
    proxies.value.push(...(fileProxies.filter((proxy) => proxy !== null) as Array<ProxyData>))
  }
  reader.readAsText(proxyFile.value)
}

// Function to add proxies from textarea input
async function addProxies() {
  terminal.info(`[ProxyPage] Adding proxies from input`)
  const manualProxies = proxyInput.value.split('\n').map((line) => parseProxy(line.trim()))

  for (const proxy of manualProxies) {
    if (proxy) {
      store.commit('createProxy', proxy)
    }
  }
  proxies.value = store.state.proxies
  proxyInput.value = ''
}

// Function to parse proxy input
function parseProxy(proxy: string): ProxyData | null {
  terminal.info(`[ProxyPage] Parsing proxy: ${proxy}`)
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
      id: Date.now(), // Generate a unique ID for the proxy
      country: 'Unknown'
    }
  }
  return null
}

// Generate name like Proxy 1, Proxy 2, etc.
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
  terminal.info(`[ProxyPage] Checking proxy: ${proxy.host}:${proxy.port}`)
  proxy.status = 'Checking...'
  try {
    const result = await window.electron.ipcRenderer.invoke(
      'test-proxy',
      `${proxy.protocol}://${proxy.username}:${proxy.password}@${proxy.host}:${proxy.port}`
    )
    proxy.status = result ? 'Working' : 'Not Working'
    const countrResult = await window.electron.ipcRenderer.invoke(
      'get-proxy-country',
      `${proxy.protocol}://${proxy.username}:${proxy.password}@${proxy.host}:${proxy.port}`
    )
    proxy.country = countrResult
    // Create a deep copy of the proxy to avoid serialization issues
    const proxyCopy = JSON.parse(JSON.stringify(proxy))
    await window.electron.ipcRenderer.invoke('edit-proxy', proxyCopy.id, proxyCopy)
  } catch (error) {
    proxy.status = 'Not Working'
    // Create a deep copy of the proxy to avoid serialization issues
    const proxyCopy = JSON.parse(JSON.stringify(proxy))
    await window.electron.ipcRenderer.invoke('edit-proxy', proxyCopy.id, proxyCopy) // Save the failed status
  }
}

// Function to check all proxies
async function checkAllProxies() {
  terminal.info(`[ProxyPage] Checking all proxies`)
  loading.value = true
  for (const proxy of proxies.value) {
    await checkProxy(proxy)
  }
  loading.value = false
}

// Function to delete a proxy
async function deleteProxy(proxy: ProxyData) {
  terminal.info(`[ProxyPage] Deleting proxy: ${proxy.name} Proxy ID: ${proxy.id}`)
  store.commit('deleteProxy', proxy.id)
  //await window.electron.ipcRenderer.invoke('delete-proxy', proxy.id)
  proxies.value = proxies.value.filter((p) => p !== proxy)
}

// Function to open the edit proxy modal
function openEditProxyModal(proxy: ProxyData) {
  terminal.info(`[ProxyPage] Opening edit proxy modal for proxy: ${proxy.name}`)
  editProxyData.value = { ...proxy } // Clone the proxy data
  editModal.value = true
}

// Function to save the edited proxy
async function saveProxyEdit() {
  terminal.info(`[ProxyPage] Saving edited proxy: ${editProxyData.value?.name}`)
  if (editProxyData.value) {
    const updatedProxy = { ...editProxyData.value, status: 'Unchecked' } // Reset status to Unchecked
    await window.electron.ipcRenderer.invoke('edit-proxy', updatedProxy.id, updatedProxy)
    const index = proxies.value.findIndex((p) => p.id === updatedProxy.id)
    if (index !== -1) {
      proxies.value[index] = updatedProxy
    }
    editModal.value = false
  }
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
  gap: 4px; /* Adjust the gap between buttons */
  flex-wrap: nowrap; /* Ensure buttons are in a single row */
}
</style>
