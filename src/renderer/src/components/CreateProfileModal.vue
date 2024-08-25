<template>
  <v-dialog :model-value="isVisibleModal" max-width="500px" @update:model-value="updateModal">
    <v-card>
      <v-card-title>
        <span class="headline">{{ profile ? 'Edit Profile' : 'Create New Profile' }}</span>
      </v-card-title>

      <v-card-subtitle>
        <v-alert v-if="alert.visible" :type="alert.type" dismissible @input="alert.visible = false">
          {{ alert.message }}
        </v-alert>

        <v-form ref="form" v-model="valid" lazy-validation>
          <v-text-field v-model="name" :rules="[rules.required]" label="Profile Name" required />
          <v-text-field v-model="useragent" :rules="[rules.required]" label="User Agent" required />
          <v-btn text @click="generateRandomUserAgent">Generate Random User Agent</v-btn>
          <v-text-field v-model="notes" label="Notes" />
          <v-select
            v-model="selectedProxy"
            label="Select Proxy"
            :items="proxyItems"
            item-title="title"
            @update:model-value="selectfunc"
          >
          </v-select>
          <v-text-field v-model="proxy" label="Proxy (optional)" />
          <v-btn text :disabled="loading" @click="testProxyConnection">
            Test Proxy Connection
            <v-progress-circular
              v-if="loading"
              indeterminate
              color="primary"
              size="20"
              class="ml-2"
            />
          </v-btn>
        </v-form>
      </v-card-subtitle>

      <v-card-actions>
        <v-spacer />
        <v-btn text @click="close">Cancel</v-btn>
        <v-btn color="primary" @click="submit">{{ profile ? 'Save' : 'Create' }}</v-btn>
      </v-card-actions>
    </v-card>
  </v-dialog>
</template>

<script setup>
import { ref, watch, computed } from 'vue'
import { useStore } from 'vuex'
import UserAgent from 'user-agents'

const props = defineProps({
  isVisibleModal: {
    type: Boolean,
    required: true
  },
  profile: {
    type: Object,
    default: null
  },
  oldProfileName: {
    type: String,
    default: ''
  }
})

const emit = defineEmits(['update:model-value', 'profile-created'])
const valid = ref(false)
const name = ref('')
const useragent = ref('')
const notes = ref('')
const proxy = ref('')
const alert = ref({
  visible: false,
  message: '',
  type: 'error'
})
const loading = ref(false)
const store = useStore()
const rules = {
  required: (value) => !!value || 'Required.'
}
const proxyItems = computed(() => {
  if (store.state.proxies) {
    return store.state.proxies.map((proxy) => ({
      title: proxy.name,
      value: `${proxy.protocol}://${proxy.username}:${proxy.password}@${proxy.host}:${proxy.port}`,
      id: proxy.id
    }))
  }
  return []
})
console.log('Proxy Items:', proxyItems.value)
const selectedProxy = ref(null)

function selectfunc(selectedValue) {
  console.log('Selected Value:', selectedValue)

  // Find the selected item from proxyItems
  const selectedItem = proxyItems.value.find((item) => item.value === selectedValue)

  if (selectedItem) {
    console.log('Selected Proxy ID:', selectedItem.id) // Print the ID
    proxy.value = selectedItem.value // Update proxy value
  } else {
    console.log('No matching item found.')
  }
}
watch(
  () => props.profile,
  (newProfile) => {
    if (newProfile) {
      name.value = newProfile.name
      useragent.value = newProfile.useragent
      notes.value = newProfile.notes
      proxy.value = newProfile.proxy
    } else {
      resetFields()
    }
  },
  { immediate: true } // Ensures watch is triggered on initial load
)

watch(
  () => props.isVisibleModal,
  (isVisible) => {
    if (isVisible) {
      resetAlert()
    }
  }
)
function updateModal(value) {
  emit('update:model-value', value)
}

function close() {
  emit('update:model-value', false)
}

function validateProxy(proxy) {
  const regex = /^(http|https|socks4|socks5):\/\/(.+)$/
  return regex.test(proxy)
}

function generateRandomUserAgent() {
  const userAgent = new UserAgent()
  useragent.value = userAgent.toString()
}

function resetAlert() {
  alert.value = {
    visible: false,
    message: '',
    type: 'error'
  }
}

function resetFields() {
  name.value = ''
  useragent.value = ''
  notes.value = ''
  proxy.value = ''
}

async function submit() {
  if (valid.value) {
    if (proxy.value && !validateProxy(proxy.value)) {
      alert.value = {
        visible: true,
        message: 'Invalid proxy format. Please enter a valid proxy.',
        type: 'error'
      }
      return
    }
    let proxyId = proxyItems.value.find((item) => item.value === proxy.value)?.id
    if (!proxyId && proxy.value) {
      console.log('Creating new proxy:', proxy.value)
      window.electron.ipcRenderer.invoke('parse-proxy-create', proxy.value).then((response) => {
        console.log('Proxy created:', response)
        proxyId = response.id
        store.commit('fetchProxies') // Fetch proxies again
        console.log('Proxy ID:', proxyId) // Log the updated proxyId
      })
    } else {
      console.log('Proxy ID:', proxyId) // Log the existing proxyId
    }
    const profileData = {
      name: name.value,
      useragent: useragent.value,
      notes: notes.value,
      proxy: proxy.value,
      proxyId: proxyId
    }

    if (props.profile) {
      // Handle profile update logic
      window.electron.ipcRenderer.send('update-profile', {
        profileData,
        oldProfileName: props.oldProfileName
      })
    } else {
      // Handle profile creation logic
      window.electron.ipcRenderer.send('create-profile', profileData)
    }

    store.commit('fetchProfiles')
    close()
  }
}

async function testProxyConnection() {
  if (proxy.value && validateProxy(proxy.value)) {
    loading.value = true
    try {
      const response = await window.electron.ipcRenderer.invoke('test-proxy', proxy.value)
      alert.value = {
        visible: true,
        message: response
          ? 'Proxy connection successful.'
          : 'Proxy connection failed. Please check your proxy settings.',
        type: response ? 'success' : 'error'
      }
    } catch (error) {
      alert.value = {
        visible: true,
        message: `Proxy connection failed: ${error.message}`,
        type: 'error'
      }
    } finally {
      loading.value = false
    }
  } else {
    alert.value = {
      visible: true,
      message: 'Invalid proxy format. Please enter a valid proxy.',
      type: 'error'
    }
  }
}
</script>
