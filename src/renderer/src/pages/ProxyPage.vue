<template>
  <v-container fluid>
    <v-row>
      <v-col cols="12" md="6">
        <v-textarea
          v-model="proxyInput"
          label="Add Proxies (one per line)"
          rows="4"
          outlined
        ></v-textarea>
      </v-col>
      <v-col cols="12" md="6">
        <v-file-input
          v-model="proxyFile"
          label="Upload Proxy File"
          accept=".txt"
          outlined
          @change="handleFileUpload"
        ></v-file-input>
      </v-col>
    </v-row>
    <v-row>
      <v-col cols="12">
        <v-btn color="primary" @click="addProxies">Add Proxies</v-btn>
      </v-col>
    </v-row>

    <v-data-table :headers="headers" :items="proxies" class="elevation-1">
      <template #item.type="{ item }">
        <v-chip color="teal" dark>{{ item.type.toUpperCase() }}</v-chip>
      </template>
      <template #item.actions="{ item }">
        <v-btn color="blue" small @click="checkProxy(item)">
          <v-icon left>mdi-check-network</v-icon>
          Check
        </v-btn>
      </template>
    </v-data-table>
  </v-container>
</template>

<script lang="ts" setup>
import { ref } from 'vue'

// Data setup
const proxyInput = ref('')
const proxyFile = ref<File | null>(null)
const proxies = ref<Array<{ type: string; address: string }>>([])

// Headers for the data table
const headers = [
  { text: 'Proxy Type', value: 'type' },
  { text: 'Proxy Address', value: 'address' },
  { text: 'Actions', value: 'actions', sortable: false }
]

// Function to handle file upload and read the contents
function handleFileUpload() {
  if (!proxyFile.value) return
  const reader = new FileReader()
  reader.onload = (event) => {
    const fileContent = event.target?.result as string
    const fileProxies = fileContent.split('\n').map((line) => parseProxy(line.trim()))
    proxies.value.push(
      ...(fileProxies.filter((proxy) => proxy !== null) as Array<{ type: string; address: string }>)
    )
  }
  reader.readAsText(proxyFile.value)
}

// Function to add proxies from textarea input
function addProxies() {
  const manualProxies = proxyInput.value.split('\n').map((line) => parseProxy(line.trim()))
  proxies.value.push(
    ...(manualProxies.filter((proxy) => proxy !== null) as Array<{ type: string; address: string }>)
  )
  proxyInput.value = ''
}

// Function to parse proxy input
function parseProxy(proxy: string) {
  const regex = /^(http|https|socks4|socks5):\/\/(.+)$/
  const match = proxy.match(regex)
  if (match) {
    return { type: match[1], address: match[2] }
  }
  return null
}

// Function to check proxy status (mock function for now)
function checkProxy(proxy: { type: string; address: string }) {
  console.log('Checking proxy:', proxy)
  // Here, you would typically call an API to check the proxy's status
  // For now, we're just logging to the console
}
</script>

<style scoped>
/* Style adjustments */
</style>
