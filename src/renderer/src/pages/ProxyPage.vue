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
      <v-btn color="primary" @click="addProxies" class="mx-2">
        <v-icon left>mdi-plus-circle</v-icon>
        Add Proxies
      </v-btn>

      <v-btn color="secondary" @click="checkAllProxies" :disabled="loading" class="mx-2">
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
      dense
      :items-per-page="5"
    >
      <template #column.protocol="{ column }">
        <v-chip color="teal" dark>{{ column.value.toUpperCase() }}</v-chip>
      </template>
      <template #item.actions="{ item }">
        <v-btn color="success" small @click="checkProxy(item)" class="mr-2">
          <v-icon left>mdi-check-network</v-icon>
          Check
        </v-btn>
        <v-btn color="primary" small @click="openEditProxyModal(item)" class="mr-2">
          <v-icon left>mdi-pencil</v-icon>
          Edit
        </v-btn>
        <v-btn color="error" small @click="deleteProxy(item)">
          <v-icon left>mdi-delete</v-icon>
          Delete
        </v-btn>
      </template>
      <template #item.status="{ item }">
        <v-chip :color="getStatusColor(item.status)" dark>{{ item.status }}</v-chip>
      </template>
    </v-data-table>

    <!-- Edit Proxy Modal -->
    <v-dialog v-model="editModal" max-width="600px">
      <v-card>
        <v-card-title>Edit Proxy</v-card-title>
        <v-card-text>
          <v-form ref="editForm">
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

// Data setup
const proxyInput = ref('')
const proxyFile = ref<File | null>(null)
const proxies = ref<Array<ProxyData>>([])

// Modal states and edit proxy data
const editModal = ref(false)
const editProxyData = ref<ProxyData | null>(null)

// Load proxies when the component is mounted
onMounted(async () => {
  proxies.value = await window.electron.ipcRenderer.invoke('get-proxies')
})

// Loading state
const loading = ref(false)

// Headers for the data table
const headers = [
  { title: 'Proxy Type', value: 'protocol' },
  { title: 'Proxy Address', value: 'host' },
  { title: 'Port', value: 'port' },
  { title: 'Username', value: 'username' },
  { title: 'Password', value: 'password' },
  { title: 'Status', value: 'status' },
  { title: 'Actions', value: 'actions', sortable: false }
]

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
  const manualProxies = proxyInput.value.split('\n').map((line) => parseProxy(line.trim()))

  for (const proxy of manualProxies) {
    if (proxy) {
      await window.electron.ipcRenderer.invoke('create-proxy', proxy)
      proxies.value.push(proxy)
    }
  }

  proxyInput.value = ''
}

// Function to parse proxy input
function parseProxy(proxy: string): ProxyData | null {
  const regex = /^(http|https|socks4|socks5):\/\/([^:]+):([^@]+)@([^:]+):(\d+)$/
  const match = proxy.match(regex)
  if (match) {
    return {
      protocol: match[1],
      username: match[2],
      password: match[3],
      host: match[4],
      port: parseInt(match[5], 10),
      status: 'Unchecked',
      id: Date.now() // Generate a unique ID for the proxy
    }
  }
  return null
}

// Function to check proxy status and save it
async function checkProxy(proxy: ProxyData) {
  console.log('Checking proxy:', proxy)
  proxy.status = 'Checking...'
  try {
    const result = await window.electron.ipcRenderer.invoke(
      'test-proxy',
      `${proxy.protocol}://${proxy.username}:${proxy.password}@${proxy.host}:${proxy.port}`
    )
    proxy.status = result ? 'Working' : 'Not Working'

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
  loading.value = true
  for (const proxy of proxies.value) {
    await checkProxy(proxy)
  }
  loading.value = false
}

// Function to delete a proxy
async function deleteProxy(proxy: ProxyData) {
  console.log('Deleting proxy:', proxy.id)
  await window.electron.ipcRenderer.invoke('delete-proxy', proxy.id)
  proxies.value = proxies.value.filter((p) => p !== proxy)
}

// Function to open the edit proxy modal
function openEditProxyModal(proxy: ProxyData) {
  editProxyData.value = { ...proxy } // Clone the proxy data
  editModal.value = true
}

// Function to save the edited proxy
async function saveProxyEdit() {
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

.proxy-table .v-data-table-header th {
  background-color: #f5f5f5;
  font-weight: bold;
  text-align: left;
}

.proxy-table .v-data-table__wrapper {
  background-color: #ffffff;
}

.proxy-table .v-data-table-header th,
.proxy-table .v-data-table__wrapper td {
  padding: 12px;
}

.proxy-table .v-data-table__wrapper tr:hover {
  background-color: #f1f1f1;
}

.proxy-table .v-data-table__wrapper td {
  border-bottom: 1px solid #e0e0e0;
}

.proxy-table .v-chip {
  margin: 0;
}
</style>
