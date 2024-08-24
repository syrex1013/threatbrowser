<template>
  <v-dialog :model-value="isVisibleModal" max-width="500px" @update:model-value="updateModal">
    <v-card>
      <v-card-title>
        <span class="headline">Create New Profile</span>
      </v-card-title>
      <v-card-subtitle>
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
          <v-text-field v-model="notes" label="Notes"></v-text-field>
          <v-text-field v-model="proxy" label="Proxy (optional)"></v-text-field>
        </v-form>
      </v-card-subtitle>
      <v-card-actions>
        <v-spacer></v-spacer>
        <v-btn text @click="close">Cancel</v-btn>
        <v-btn color="primary" @click="submit">Create</v-btn>
      </v-card-actions>
    </v-card>
  </v-dialog>
</template>
<script setup>
import { ref } from 'vue'
const props = defineProps({
  isVisibleModal: {
    type: Boolean,
    required: true
  }
})
const emit = defineEmits(['update:model-value', 'profile-created'])
const valid = ref(false)
const name = ref('')
const useragent = ref('')
const notes = ref('')
const proxy = ref('')
const rules = {
  required: (value) => !!value || 'Required.'
}
function updateModal(value) {
  emit('update:model-value', value)
}
function close() {
  emit('update:model-value', false)
}
async function submit() {
  if (valid.value) {
    // Handle profile creation logic
    window.electron.ipcRenderer.send('create-profile', {
      name: name.value,
      useragent: useragent.value,
      notes: notes.value,
      proxy: proxy.value
    })
    emit('profile-created') // Emit the event to notify the parent component
    close()
  }
}
</script>
