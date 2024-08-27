<template>
  <v-dialog v-model="modalVisible" max-width="600px" persistent>
    <v-card>
      <v-card-title>Edit Proxy</v-card-title>
      <v-card-text>
        <v-form v-if="localEditProxyData" ref="editForm">
          <v-text-field v-model="localEditProxyData.name" label="Name" required></v-text-field>
          <v-text-field
            v-model="localEditProxyData.protocol"
            label="Proxy Type"
            disabled
          ></v-text-field>
          <v-text-field
            v-model="localEditProxyData.host"
            label="Proxy Address"
            required
          ></v-text-field>
          <v-text-field
            v-model="localEditProxyData.port"
            label="Port"
            type="number"
            required
          ></v-text-field>
          <v-text-field v-model="localEditProxyData.username" label="Username"></v-text-field>
          <v-text-field
            v-model="localEditProxyData.password"
            label="Password"
            type="password"
          ></v-text-field>
        </v-form>
      </v-card-text>
      <v-card-actions>
        <v-spacer></v-spacer>
        <v-btn color="primary" @click="saveProxyEdit">Save</v-btn>
        <v-btn @click="closeModal">Cancel</v-btn>
      </v-card-actions>
    </v-card>
  </v-dialog>
</template>

<script setup lang="ts">
import { defineProps, defineEmits, ref, watch } from 'vue'
import { useStore } from 'vuex'
import { ProxyData } from '../types/types'

// Vuex store
const store = useStore()

// Props
const props = defineProps({
  editModal: Boolean,
  editProxyData: Object as () => ProxyData | null
})

// Emits
const emit = defineEmits(['save-proxy-edit', 'update:editModal'])

// Local state
const modalVisible = ref(props.editModal)
const localEditProxyData = ref<ProxyData | null>(null)

// Watch for prop changes and sync with local state
watch(
  () => props.editModal,
  (newVal) => {
    modalVisible.value = newVal
  }
)

watch(
  () => props.editProxyData,
  (newVal) => {
    localEditProxyData.value = newVal ? { ...newVal } : null
  },
  { immediate: true }
)

// Watch modal visibility to update parent component
watch(modalVisible, (newVal) => {
  emit('update:editModal', newVal)
})

// Close modal
const closeModal = () => {
  modalVisible.value = false
}

// Save proxy edits
const saveProxyEdit = () => {
  if (localEditProxyData.value) {
    // Dispatch to store, deepclone
    const deepclone: ProxyData = JSON.parse(JSON.stringify(localEditProxyData.value))
    store.dispatch('editProxy', deepclone)
    emit('save-proxy-edit', deepclone)
    closeModal()
  }
}
</script>
