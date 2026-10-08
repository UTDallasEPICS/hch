<script setup lang="ts">
const { data, status } = await useFetch('/api/client/available-slots')
</script>

<template>
  <div v-if="status === 'pending'">Loading slots...</div>

  <!-- If client has NO clinician: show Contact Admin -->
  <div v-else-if="data && !data.hasClinician" class="p-4 border rounded text-center">
    <p class="font-bold">No Clinician Assigned</p>
    <p class="text-sm">Please contact administration to be assigned a clinician.</p>
    <UButton class="mt-3" to="mailto:admin@hopecopeheal.org">Contact Admin</UButton>
  </div>

  <!-- If client HAS a clinician: list the slots -->
  <div v-else-if="data && data.hasClinician">
    <h3 class="font-bold mb-3">Available Times</h3>
    <div v-if="data.slots.length === 0">No upcoming open slots right now.</div>
    <ul v-else class="space-y-2">
      <li v-for="slot in data.slots" :key="slot.id" class="p-3 border rounded flex justify-between">
        <div>
          <div>{{ new Date(slot.startTime).toLocaleString() }}</div>
        </div>
        <UButton size="xs">Book</UButton>
      </li>
    </ul>
  </div>
</template>