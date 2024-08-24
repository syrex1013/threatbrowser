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
          <v-text-field
            v-model="name"
            :rules="[rules.required]"
            label="Profile Name"
            required
          ></v-text-field>
          <v-text-field
            v-model="useragent"
            :rules="[rules.required]"
            label="User Agent"
            required
          ></v-text-field>
          <v-btn text @click="generateRandomUserAgent">Generate Random User Agent</v-btn>
          <v-text-field v-model="notes" label="Notes"></v-text-field>
          <v-text-field v-model="proxy" label="Proxy (optional)"></v-text-field>
          <v-btn text @click="testProxyConnection" :disabled="loading">
            Test Proxy Connection
            <v-progress-circular
              v-if="loading"
              indeterminate
              color="primary"
              size="20"
              class="ml-2"
            ></v-progress-circular>
          </v-btn>
        </v-form>
      </v-card-subtitle>
      <v-card-actions>
        <v-spacer></v-spacer>
        <v-btn text @click="close">Cancel</v-btn>
        <v-btn color="primary" @click="submit">{{ profile ? 'Save' : 'Create' }}</v-btn>
      </v-card-actions>
    </v-card>
  </v-dialog>
</template>

<script setup>
import { ref, watch } from 'vue'
import { useStore } from 'vuex'
import randomUseragent from 'random-useragent'
import axios from 'axios'

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

watch(
  () => props.profile,
  (newProfile) => {
    if (newProfile) {
      name.value = newProfile.name
      useragent.value = newProfile.useragent
      notes.value = newProfile.notes
      proxy.value = newProfile.proxy
    } else {
      name.value = ''
      useragent.value = ''
      notes.value = ''
      proxy.value = ''
    }
  }
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
  useragent.value = randomUseragent.getRandom()
}

function resetAlert() {
  alert.value = {
    visible: false,
    message: '',
    type: 'error'
  }
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

    const profileData = {
      name: name.value,
      useragent: useragent.value,
      notes: notes.value,
      proxy: proxy.value
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
    window.electron.ipcRenderer
      .invoke('test-proxy', proxy.value)
      .then((response) => {
        loading.value = false
        if (response == true) {
          alert.value = {
            visible: true,
            message: 'Proxy connection successful.',
            type: 'success'
          }
        } else {
          alert.value = {
            visible: true,
            message: 'Proxy connection failed. Please check your proxy settings.',
            type: 'error'
          }
        }
      })
      .catch((error) => {
        loading.value = false
        alert.value = {
          visible: true,
          message: `Proxy connection failed: ${error.message}`,
          type: 'error'
        }
      })
  } else {
    alert.value = {
      visible: true,
      message: 'Invalid proxy format. Please enter a valid proxy.',
      type: 'error'
    }
  }
}
</script>
