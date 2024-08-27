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
import { ProxyData } from '../types/types'

const props = defineProps({
  editModal: Boolean,
  editProxyData: Object as () => ProxyData | null
})

const emit = defineEmits(['save-proxy-edit', 'update:editModal'])

const modalVisible = ref(props.editModal)
const localEditProxyData = ref<ProxyData | null>(null)

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

watch(modalVisible, (newVal) => {
  emit('update:editModal', newVal)
})

const closeModal = () => {
  modalVisible.value = false
}

const saveProxyEdit = () => {
  if (localEditProxyData.value) {
    emit('save-proxy-edit', localEditProxyData.value)
    closeModal()
  }
}
</script>
