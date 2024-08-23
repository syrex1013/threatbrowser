<template>
  <v-container fluid>
    <v-data-table :headers="headers" :items="profiles" class="elevation-1">
      <template v-slot:item.status="{ item }">
        <v-chip color="primary" dark>
          <v-icon left>{{
            item.status === 'Active' ? 'mdi-check-circle' : 'mdi-close-circle'
          }}</v-icon>
          {{ item.status }}
        </v-chip>
      </template>

      <template v-slot:item.proxy="{ item }">
        <v-icon color="teal">{{
          item.proxy === 'Proxy 1' ? 'mdi-shield-check' : 'mdi-shield-off'
        }}</v-icon>
        {{ item.proxy }}
      </template>

      <template v-slot:item.notes="{ item }">
        <v-textarea v-model="item.notes" outlined rows="2" class="notes-textarea"></v-textarea>
      </template>

      <template v-slot:item.actions="{ item }">
        <div class="action-buttons">
          <v-btn color="blue" small @click="editProfile(item)">
            <v-icon left>mdi-pencil</v-icon>
            Edit
          </v-btn>
          <v-btn color="red" small @click="deleteProfile(item)">
            <v-icon left>mdi-delete</v-icon>
            Delete
          </v-btn>
        </div>
      </template>
    </v-data-table>
  </v-container>
</template>

<script lang="ts" setup>
import { ref } from 'vue'

const headers = [
  { title: 'Name', value: 'name' },
  { title: 'Status', value: 'status' },
  { title: 'Proxy', value: 'proxy' },
  { title: 'Notes', value: 'notes' },
  { title: 'Actions', value: 'actions', sortable: false }
]

const profiles = ref([
  { name: 'Profile 1', status: 'Active', proxy: 'Proxy 1', notes: '' },
  { name: 'Profile 2', status: 'Inactive', proxy: 'Proxy 2', notes: '' }
])

function createProfile() {
  // Logic to create a profile
  console.log('Create Profile button clicked')
}

function editProfile(profile) {
  // Logic to edit a profile
  console.log('Edit Profile button clicked', profile)
}

function deleteProfile(profile) {
  // Logic to delete a profile
  console.log('Delete Profile button clicked', profile)
}
</script>

<style scoped>
/* Style for notes textarea */
.notes-textarea {
  min-height: 50px; /* Adjust height as needed */
  margin-top: 8px; /* Adjust top margin as needed */
}

/* Style for action buttons container */
.action-buttons {
  display: flex;
  gap: 8px; /* Adjust spacing between buttons */
}
</style>
