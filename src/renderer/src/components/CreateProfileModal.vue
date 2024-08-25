<template>
  <v-dialog :model-value="isVisibleModal" max-width="1200px" @update:model-value="updateModal">
    <v-card>
      <v-card-title>
        <v-icon class="mr-2">mdi-account</v-icon>
        <span class="headline">{{ profile ? 'Edit Profile' : 'Create New Profile' }}</span>
      </v-card-title>

      <v-card-subtitle>
        <v-alert v-if="alert.visible" :type="alert.type" dismissible @input="closeAlert">
          {{ alert.message }}
        </v-alert>

        <v-row>
          <v-col cols="8">
            <v-form ref="form" v-model="valid" lazy-validation>
              <v-text-field
                v-model="name"
                :rules="[rules.required]"
                label="Profile Name"
                required
                prepend-icon="mdi-rename"
              ></v-text-field>

              <v-text-field v-model="notes" label="Notes" prepend-icon="mdi-note"></v-text-field>

              <v-text-field
                v-model="useragent"
                :rules="[rules.required]"
                label="User Agent"
                required
                prepend-icon="mdi-face-agent"
              ></v-text-field>

              <center>
                <v-card-text>
                  <span class="caption">(Optional) Customization</span>
                </v-card-text>
              </center>

              <v-select
                v-model="selectedPlatform"
                :items="platformOptions"
                label="Select Platform"
                prepend-icon="mdi-monitor"
                clearable
              ></v-select>

              <v-select
                v-model="selectedBrowser"
                :items="browserOptions"
                label="Select Browser"
                prepend-icon="mdi-web"
                clearable
              ></v-select>

              <center>
                <v-btn text @click="generateRandomUserAgent" style="margin-bottom: 20px">
                  <v-icon class="mr-2">mdi-refresh</v-icon> Generate Random User Agent
                </v-btn>
              </center>

              <v-select
                v-model="selectedProxy"
                label="Select Proxy"
                :items="proxyItems"
                item-title="title"
                prepend-icon="mdi-shield-lock"
                @update:model-value="selectfunc"
              ></v-select>

              <v-text-field v-model="proxy" label="Proxy (optional)" prepend-icon="mdi-shield" />

              <center>
                <v-btn text :disabled="loading" @click="testProxyConnection">
                  <v-icon class="mr-2">mdi-wifi</v-icon> Test Proxy Connection
                  <v-progress-circular
                    v-if="loading"
                    indeterminate
                    color="primary"
                    size="20"
                    class="ml-2"
                  />
                </v-btn>
              </center>
            </v-form>
          </v-col>

          <v-col cols="4">
            <v-card>
              <v-card-title>
                <v-icon class="mr-2">mdi-information</v-icon> User Agent Details
              </v-card-title>

              <v-card-text>
                <p><strong>Platform:</strong> {{ userAgentDetails.platform }}</p>
                <p><strong>Vendor:</strong> {{ userAgentDetails.vendor }}</p>
                <p><strong>Device:</strong> {{ userAgentDetails.device }}</p>
                <p><strong>Browser:</strong> {{ userAgentDetails.browser }}</p>
                <p><strong>User Agent String:</strong> {{ useragent }}</p>
                <p><strong>Operating System:</strong> {{ userAgentDetails.os }}</p>
                <p><strong>Browser Version:</strong> {{ userAgentDetails.browserVersion }}</p>
                <p><strong>Device Type:</strong> {{ userAgentDetails.deviceType }}</p>
              </v-card-text>
            </v-card>
          </v-col>
        </v-row>
      </v-card-subtitle>

      <v-card-actions>
        <v-spacer />
        <v-btn text @click="close"> <v-icon class="mr-2">mdi-close</v-icon> Cancel </v-btn>
        <v-btn color="primary" @click="submit">
          <v-icon class="mr-2">mdi-check</v-icon> {{ profile ? 'Save' : 'Create' }}
        </v-btn>
      </v-card-actions>
    </v-card>
  </v-dialog>
</template>

<script setup>
import { ref, watch, computed } from 'vue'
import { useStore } from 'vuex'
import UserAgent from 'user-agents'
import { UAParser } from 'ua-parser-js'

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

// Dropdown options for platform, device category, and browser
const platformOptions = ['Windows', 'Macintosh', 'Linux', 'iOS', 'Android']
const browserOptions = ['Chrome', 'Firefox', 'Safari', 'Edge', 'Opera']

const selectedPlatform = ref('')
const selectedBrowser = ref('')

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

const selectedProxy = ref(null)

const userAgentDetails = ref({
  platform: '',
  vendor: '',
  device: '',
  browser: '',
  os: '',
  browserVersion: '',
  deviceType: ''
})

function selectfunc(selectedValue) {
  const selectedItem = proxyItems.value.find((item) => item.value === selectedValue)
  if (selectedItem) {
    proxy.value = selectedItem.value
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
  { immediate: true }
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

function closeAlert() {
  alert.value.visible = false
}

function validateProxy(proxy) {
  const regex = /^(http|https|socks4|socks5):\/\/(.+)$/
  return regex.test(proxy)
}

async function generateRandomUserAgent() {
  try {
    let regexString = ''

    // Build regex based on selected options
    if (selectedPlatform.value) {
      regexString += `(?=.*${selectedPlatform.value})`
    }
    if (selectedBrowser.value) {
      regexString += `(?=.*${selectedBrowser.value})`
    }

    let userAgent

    if (regexString) {
      // Wrap the regex pattern to match the entire string
      regexString = `^${regexString}.*$`

      console.log('Generated Regex:', regexString)

      // Convert the regexString to a RegExp object
      const userAgentRegex = new RegExp(regexString)

      // Pass the RegExp object to the UserAgent constructor
      userAgent = new UserAgent(userAgentRegex)

      // Check if no user agent matches the criteria
      if (!userAgent.userAgent) {
        alert.value = {
          visible: true,
          message: 'No matching user agents found. Please adjust your criteria.',
          type: 'error'
        }
        setTimeout(closeAlert, 5000)
        return
      }
    } else {
      // No specific options selected, generate a random user agent without regex
      userAgent = new UserAgent()
    }

    // Set the user agent value
    useragent.value = userAgent.toString()

    // Update user agent details
    const parser = new UAParser(userAgent.toString())
    const parsed = parser.getResult()
    userAgentDetails.value = {
      platform: userAgent.platform,
      vendor: userAgent.vendor,
      device: userAgent.deviceCategory,
      browser: userAgent.userAgent.split(' ').slice(-1)[0],
      os: parsed.os.name,
      browserVersion: parsed.browser.version,
      deviceType: parsed.device.type
    }
  } catch (error) {
    alert.value = {
      visible: true,
      message: `Failed to generate user agent: ${error.message}`,
      type: 'error'
    }
    setTimeout(closeAlert, 5000)
  }
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
      setTimeout(closeAlert, 5000)
      return
    }
    let proxyId = proxyItems.value.find((item) => item.value === proxy.value)?.id
    if (!proxyId && proxy.value) {
      window.electron.ipcRenderer.invoke('parse-proxy-create', proxy.value).then((response) => {
        proxyId = response.id
        store.commit('fetchProxies')
      })
    }
    const profileData = {
      name: name.value,
      useragent: useragent.value,
      notes: notes.value,
      proxy: proxy.value,
      proxyId: proxyId
    }

    if (props.profile) {
      window.electron.ipcRenderer.send('update-profile', {
        profileData,
        oldProfileName: props.oldProfileName
      })
    } else {
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
    setTimeout(closeAlert, 5000)
  } else {
    alert.value = {
      visible: true,
      message: 'Invalid proxy format. Please enter a valid proxy.',
      type: 'error'
    }
    setTimeout(closeAlert, 5000)
  }
}
</script>
