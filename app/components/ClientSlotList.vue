<script setup lang="ts">
  type AvailableSlot = {
    id: string
    startTime: string
    endTime: string
    location: string
    status: string
  }

  type AvailableSlotsResponse = {
    hasClinician: boolean
    slots: AvailableSlot[]
  }

  const toast = useToast()
  const { data, status, refresh } = await useFetch<AvailableSlotsResponse>(
    '/api/client/available-slots'
  )
  const bookingSlotId = ref<string | null>(null)

  async function bookSlot(slot: AvailableSlot) {
    if (
      !window.confirm(
        `Book this session for ${new Date(slot.startTime).toLocaleString()}?`
      )
    ) {
      return
    }

    bookingSlotId.value = slot.id
    try {
      const result = await $fetch<{ confirmationEmailSent: boolean }>(
        `/api/client/available-slots/${slot.id}`,
        { method: 'POST' }
      )

      toast.add({
        title: 'Session booked',
        description: result.confirmationEmailSent
          ? 'Your appointment is confirmed. A confirmation email was sent.'
          : 'Your appointment is confirmed, but the confirmation email could not be sent. Please contact the clinic if you need help.',
        color: result.confirmationEmailSent ? 'success' : 'warning',
      })
      await refresh()
    } catch (error: unknown) {
      const message =
        (error as { data?: { statusMessage?: string } })?.data?.statusMessage ??
        'Could not book this session. Please try again.'
      toast.add({ title: 'Booking failed', description: message, color: 'error' })
      await refresh()
    } finally {
      bookingSlotId.value = null
    }
  }
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
      <li
        v-for="slot in data.slots"
        :key="slot.id"
        class="flex justify-between rounded border p-3"
      >
        <div>
          <div>{{ new Date(slot.startTime).toLocaleString() }}</div>
          <div class="text-sm text-gray-500">{{ slot.location }}</div>
        </div>
        <UButton
          size="xs"
          :loading="bookingSlotId === slot.id"
          :disabled="bookingSlotId !== null"
          @click="bookSlot(slot)"
        >
          Book
        </UButton>
      </li>
    </ul>
  </div>
</template>