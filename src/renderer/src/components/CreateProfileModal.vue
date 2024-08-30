<template>
  <v-dialog :model-value="isVisibleModal" max-width="1200px" @update:model-value="updateModal">
    <v-card>
      <v-card-title>
        <v-icon class="mr-2">mdi-account</v-icon>
        <span class="headline">{{ profile ? 'Edit Profile' : 'Create New Profile' }}</span>
      </v-card-title>

      <v-card-subtitle>
        <v-alert
          v-if="alert.visible"
          class="ma-4"
          :type="alert.type"
          dismissible
          @input="closeAlert"
        >
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

              <!-- Additional Section for Cookies Input -->
              <center>
                <v-card-title>
                  <v-icon class="mr-2">mdi-cookie</v-icon> (Optional) Upload Cookies in JSON Format
                </v-card-title>
              </center>

              <v-file-input
                label="Upload Cookies"
                prepend-icon="mdi-file-upload"
                accept=".json"
                clearable
                placeholder="Select JSON file"
                @change="handleFileUpload"
              ></v-file-input>

              <!-- Display the uploaded cookies -->
              <v-card-text v-if="cookies && Object.keys(cookies).length">
                <v-alert type="info">
                  <pre>{{ cookies }}</pre>
                </v-alert>
              </v-card-text>

              <center>
                <v-card-title>
                  <v-icon class="mr-2">mdi-face-agent</v-icon> (Optional) User Agent Details
                </v-card-title>
              </center>

              <v-select
                v-model="selectedPlatform"
                :items="platformOptions"
                label="Select Platform (optional)"
                prepend-icon="mdi-monitor"
                clearable
              ></v-select>

              <v-select
                v-model="selectedBrowser"
                :items="browserOptions"
                label="Select Browser (optional)"
                prepend-icon="mdi-web"
                clearable
              ></v-select>

              <center>
                <v-btn text style="ma-4" @click="generateRandomUserAgent">
                  <v-icon class="mr-2">mdi-refresh</v-icon> Generate Random User Agent
                </v-btn>
              </center>
              <center>
                <v-card-title>
                  <v-icon class="mr-2">mdi-face-agent</v-icon> (Optional) Proxy Settings
                </v-card-title>
              </center>
              <v-select
                v-model="selectedProxy"
                label="Select Proxy from List (optional)"
                :items="proxyItems"
                item-title="title"
                prepend-icon="mdi-shield-lock"
                @update:model-value="selectfunc"
              ></v-select>

              <v-card-text class="mt-4">
                <small>Supported protocols: HTTP, HTTPS, SOCKS4, SOCKS5</small>
              </v-card-text>

              <v-text-field
                v-model="proxy"
                label="protocol://username:password@ip:port"
                prepend-icon="mdi-shield"
              />
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
import logger from '../logger/logger'

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
const cookies = ref({})
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
  return store.state.proxies.map((proxy) => ({
    title: proxy.name,
    value: `${proxy.protocol}://${proxy.username}:${proxy.password}@${proxy.host}:${proxy.port}`,
    id: proxy.id
  }))
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
    logger.info(`[CreateProfileModal] Selected Proxy: ${selectedItem.value}`)
    proxy.value = selectedItem.value
  }
}

function handleFileUpload(event) {
  const file = event.target.files[0]
  if (file) {
    const reader = new FileReader()
    reader.onload = (e) => {
      try {
        cookies.value = JSON.parse(e.target.result)
        logger.info('[CreateProfileModal] Cookies uploaded successfully:', cookies.value)
      } catch (error) {
        alert.value = {
          visible: true,
          message: 'Invalid JSON format. Please upload a valid cookies file.',
          type: 'error'
        }
        setTimeout(closeAlert, 5000)
      }
    }
    reader.readAsText(file)
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
  logger.debug('Closing modal')
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

      logger.info(`[CreateProfileModal] Generating user agent with regex: ${regexString}`)

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
    let proxyId = null
    proxyId = proxyItems.value.find((item) => item.value === proxy.value)?.id
    if (!proxyId && proxy.value) {
      logger.info(`[CreateProfileModal] Proxy not found. Creating new with data: ${proxy.value}`)
      proxyId = await store.dispatch('createProxy', `${proxy.value}`)
    }
    logger.info(`[CreateProfileModal] Proxy ID: ${proxyId}`)
    //deepclone cookies
    const cookiesClone = JSON.stringify(cookies.value)
    const profileData = {
      id: props.profile ? props.profile.id : Date.now(),
      name: name.value,
      useragent: useragent.value,
      notes: notes.value,
      proxy: proxy.value,
      proxyId: proxyId,
      cookies: cookiesClone ? cookiesClone : '{}',
      launched: false
    }

    if (props.profile) {
      store.dispatch('editProfile', profileData)
    } else {
      store.dispatch('createProfile', profileData)
    }

    store.dispatch('fetchProfiles') // Fetch profiles from Vuex store
    store.dispatch('fetchProxies') // Fetch proxies from Vuex store
    close()
  }
}
</script>
