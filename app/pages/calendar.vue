<script setup lang="ts">
  import FullCalendar from '@fullcalendar/vue3'
  import dayGridPlugin from '@fullcalendar/daygrid'
  import interactionPlugin from '@fullcalendar/interaction'

  const toast = useToast()

  const events = ref([])

  async function loadEvents() {
    const data = await $fetch('/api/appointments')
    events.value = data
  }

  onMounted(async () => {
    await loadEvents()
  })

  const calendarOptions = {
    plugins: [dayGridPlugin, interactionPlugin],
    initialView: 'dayGridMonth',
    events,
    height: 'auto', // important
  }
</script>

<template>
  <div class="space-y-4 p-6">
    <!-- Header -->
    <div class="flex items-center justify-between">
      <h1 class="text-2xl font-bold">Calendar</h1>

      <UButton icon="i-heroicons-plus" label="Create Session" @click="openCreateModal" />
    </div>

    <!-- Calendar Container -->
    <div class="rounded-xl bg-white p-4 shadow dark:bg-gray-900">
      <FullCalendar :options="calendarOptions" class="min-h-[700px]" />
    </div>
  </div>
</template>
