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
          hint="Enter proxies in the format: type://address"
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
      class="elevation-1"
      item-value="address"
      dense
      hide-default-header
      :items-per-page="5"
    >
      <template #column.type="{ column }">
        <v-chip color="teal" dark>{{ column.value.toUpperCase() }}</v-chip>
      </template>
      <template #item.actions="{ item }">
        <v-btn color="success" small @click="checkProxy(item)" class="mr-2">
          <v-icon left>mdi-check-network</v-icon>
          Check
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
  </v-container>
</template>

<script lang="ts" setup>
import { ref } from 'vue'

// Data setup
const proxyInput = ref('')
const proxyFile = ref<File | null>(null)
const proxies = ref<Array<{ type: string; address: string; status: string }>>([])

// Loading state
const loading = ref(false)

// Headers for the data table
const headers = [
  { title: 'Proxy Type', value: 'type' },
  { title: 'Proxy Address', value: 'address' },
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
    proxies.value.push(
      ...(fileProxies.filter((proxy) => proxy !== null) as Array<{
        type: string
        address: string
        status: string
      }>)
    )
  }
  reader.readAsText(proxyFile.value)
}

// Function to add proxies from textarea input
function addProxies() {
  const manualProxies = proxyInput.value.split('\n').map((line) => parseProxy(line.trim()))
  proxies.value.push(
    ...(manualProxies.filter((proxy) => proxy !== null) as Array<{
      type: string
      address: string
      status: string
    }>)
  )
  proxyInput.value = ''
}

// Function to parse proxy input
function parseProxy(proxy: string) {
  const regex = /^(http|https|socks4|socks5):\/\/(.+)$/
  const match = proxy.match(regex)
  if (match) {
    return { type: match[1], address: match[2], status: 'Unchecked' }
  }
  return null
}

// Function to check proxy status
async function checkProxy(proxy: { type: string; address: string; status: string }) {
  console.log('Checking proxy:', proxy)
  proxy.status = 'Checking...'
  try {
    const result = await window.electron.ipcRenderer.invoke(
      'test-proxy',
      `${proxy.type}://${proxy.address}`
    )
    proxy.status = result ? 'Working' : 'Not Working'
  } catch (error) {
    proxy.status = 'Not Working'
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
function deleteProxy(proxy: { type: string; address: string; status: string }) {
  proxies.value = proxies.value.filter((p) => p !== proxy)
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
.v-btn {
  font-weight: 500;
}

.v-data-table {
  border-radius: 8px;
}

.v-chip {
  text-transform: uppercase;
}

.mx-2 {
  margin-left: 8px;
  margin-right: 8px;
}
</style>
