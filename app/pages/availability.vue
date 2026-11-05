<script setup lang="ts">
  import { authClient } from '~/utils/auth-client'

  definePageMeta({ middleware: 'staff-only' })

  type ClinicianOption = { id: string; name: string; email: string }
  type AvailabilitySlot = {
    id: string
    clinicianUserId: string
    startTime: string
    endTime: string
    location: string
    videoUrl: string | null
    notes: string | null
    status: 'OPEN' | 'BOOKED' | 'CANCELLED'
    sourceType: 'ONE_OFF' | 'RECURRING'
  }
  type SlotPreview = { startTime: string; endTime: string }
  type SlotForm = {
    clinicianUserId: string
    sourceType: 'ONE_OFF' | 'RECURRING'
    startDateTime: string
    endDateTime: string
    weekdays: number[]
    startTime: string
    endTime: string
    timeZone: string
    slotDurationMinutes: number
    bookingHorizonDays: number
    location: string
    videoUrl: string
    notes: string
  }

  const toast = useToast()
  const { data: roleData } = await useFetch<{ isAdmin: boolean; isClinician: boolean }>(
    '/api/users/me/is-admin'
  )
  const { data: session } = await authClient.useSession(useFetch)
  const currentUserId = computed(
    () => (session.value?.user as { id?: string } | null)?.id ?? ''
  )
  const { data: clinicians } = await useFetch<ClinicianOption[]>('/api/clinicians', {
    getCachedData: () => undefined,
  })

  const form = reactive<SlotForm>({
    clinicianUserId: '',
    sourceType: 'ONE_OFF',
    startDateTime: '',
    endDateTime: '',
    weekdays: [],
    startTime: '09:00',
    endTime: '17:00',
    timeZone: 'UTC',
    slotDurationMinutes: 60,
    bookingHorizonDays: 60,
    location: '',
    videoUrl: '',
    notes: '',
  })

  const weekdayOptions = [
    { label: 'Sun', value: 0 },
    { label: 'Mon', value: 1 },
    { label: 'Tue', value: 2 },
    { label: 'Wed', value: 3 },
    { label: 'Thu', value: 4 },
    { label: 'Fri', value: 5 },
    { label: 'Sat', value: 6 },
  ]
  const isAdmin = computed(() => roleData.value?.isAdmin === true)
  const clinicianOptions = computed(() =>
    (clinicians.value ?? []).map((clinician) => ({
      label: clinician.name ? `${clinician.name} (${clinician.email})` : clinician.email,
      value: clinician.id,
    }))
  )
  watch(
    [isAdmin, currentUserId, clinicianOptions],
    () => {
      if (isAdmin.value) {
        if (!form.clinicianUserId && clinicianOptions.value.length) {
          form.clinicianUserId = clinicianOptions.value[0].value
        }
      } else {
        form.clinicianUserId = currentUserId.value
      }
    },
    { immediate: true }
  )

  const slots = ref<AvailabilitySlot[]>([])
  const preview = ref<SlotPreview[]>([])
  const loadingSlots = ref(false)
  const loadingPreview = ref(false)
  const publishing = ref(false)
  const editingId = ref<string | null>(null)
  const savingEdit = ref(false)
  const editForm = reactive({
    startDateTime: '',
    endDateTime: '',
    location: '',
    videoUrl: '',
    notes: '',
  })

  onMounted(() => {
    form.timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone
  })

  function errorMessage(error: unknown, fallback: string) {
    return (error as { data?: { statusMessage?: string } })?.data?.statusMessage ?? fallback
  }

  function toLocalDateTime(value: string) {
    const date = new Date(value)
    const pad = (number: number) => String(number).padStart(2, '0')
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`
  }

  function toIsoDate(value: string) {
    const date = new Date(value)
    if (Number.isNaN(date.getTime())) throw new Error('Enter a valid date and time')
    return date.toISOString()
  }

  function generationRequest() {
    if (!form.clinicianUserId) throw new Error('Select a clinician')
    if (!form.location.trim()) throw new Error('Enter a location')

    const common = {
      clinicianUserId: form.clinicianUserId,
      location: form.location.trim(),
      videoUrl: form.videoUrl.trim(),
      notes: form.notes.trim(),
      slotDurationMinutes: Number(form.slotDurationMinutes),
      bookingHorizonDays: Number(form.bookingHorizonDays),
    }

    if (form.sourceType === 'ONE_OFF') {
      if (!form.startDateTime || !form.endDateTime) {
        throw new Error('Enter the start and end date and time')
      }
      return {
        ...common,
        sourceType: 'ONE_OFF' as const,
        startTime: toIsoDate(form.startDateTime),
        endTime: toIsoDate(form.endDateTime),
      }
    }

    if (!form.weekdays.length) throw new Error('Choose at least one weekday')
    return {
      ...common,
      sourceType: 'RECURRING' as const,
      timeZone: form.timeZone,
      weeklyAvailability: form.weekdays.map((dayOfWeek) => ({
        dayOfWeek,
        startTime: form.startTime,
        endTime: form.endTime,
      })),
    }
  }

  async function loadSlots() {
    if (!form.clinicianUserId) {
      slots.value = []
      return
    }
    loadingSlots.value = true
    try {
      slots.value = await $fetch<AvailabilitySlot[]>('/api/availability-slots', {
        query: { clinicianUserId: form.clinicianUserId },
      })
    } catch (error: unknown) {
      toast.add({
        title: 'Could not load published availability',
        description: errorMessage(error, 'Please try again.'),
        color: 'error',
      })
    } finally {
      loadingSlots.value = false
    }
  }

  watch(() => form.clinicianUserId, loadSlots)

  async function previewSlots() {
    loadingPreview.value = true
    try {
      preview.value = await $fetch<SlotPreview[]>('/api/availability-slots/preview', {
        method: 'POST',
        body: generationRequest(),
      })
    } catch (error: unknown) {
      toast.add({
        title: 'Could not preview slots',
        description: errorMessage(error, 'Check the availability details and try again.'),
        color: 'error',
      })
    } finally {
      loadingPreview.value = false
    }
  }

  async function publishAvailability() {
    publishing.value = true
    try {
      const result = await $fetch<{ createdCount: number }>('/api/availability-slots', {
        method: 'POST',
        body: generationRequest(),
      })
      toast.add({
        title: 'Availability published',
        description: `${result.createdCount} open slot${result.createdCount === 1 ? '' : 's'} added.`,
        color: 'success',
      })
      preview.value = []
      await loadSlots()
    } catch (error: unknown) {
      toast.add({
        title: 'Could not publish availability',
        description: errorMessage(error, 'Check the availability details and try again.'),
        color: 'error',
      })
    } finally {
      publishing.value = false
    }
  }

  function beginEdit(slot: AvailabilitySlot) {
    editingId.value = slot.id
    editForm.startDateTime = toLocalDateTime(slot.startTime)
    editForm.endDateTime = toLocalDateTime(slot.endTime)
    editForm.location = slot.location
    editForm.videoUrl = slot.videoUrl ?? ''
    editForm.notes = slot.notes ?? ''
  }

  async function saveEdit(slot: AvailabilitySlot) {
    savingEdit.value = true
    try {
      await $fetch(`/api/availability-slots/${slot.id}`, {
        method: 'PATCH',
        body: {
          startTime: toIsoDate(editForm.startDateTime),
          endTime: toIsoDate(editForm.endDateTime),
          location: editForm.location,
          videoUrl: editForm.videoUrl,
          notes: editForm.notes,
        },
      })
      editingId.value = null
      toast.add({ title: 'Availability updated', color: 'success' })
      await loadSlots()
    } catch (error: unknown) {
      toast.add({
        title: 'Could not update availability',
        description: errorMessage(error, 'Please try again.'),
        color: 'error',
      })
    } finally {
      savingEdit.value = false
    }
  }

  async function deleteSlot(slot: AvailabilitySlot) {
    if (!window.confirm('Delete this future availability slot?')) return
    try {
      await $fetch(`/api/availability-slots/${slot.id}`, { method: 'DELETE' })
      toast.add({ title: 'Availability deleted', color: 'success' })
      await loadSlots()
    } catch (error: unknown) {
      toast.add({
        title: 'Could not delete availability',
        description: errorMessage(error, 'Please try again.'),
        color: 'error',
      })
    }
  }
</script>

<template>
  <UContainer class="max-w-5xl px-4 py-8 sm:px-6 lg:px-8">
    <div class="mb-6">
      <h1 class="text-2xl font-bold">Published availability</h1>
      <p class="mt-1 text-sm text-gray-500 dark:text-gray-400">
        Publish one-off or weekly bookable time blocks. Conflicts and existing slots are skipped.
      </p>
    </div>

    <section class="mb-8 rounded-lg border border-gray-200 bg-white p-4 dark:border-gray-800 dark:bg-gray-900">
      <h2 class="mb-4 text-lg font-semibold">Add availability</h2>
      <div class="grid gap-4 sm:grid-cols-2">
        <label v-if="isAdmin" class="grid gap-1 text-sm font-medium">
          Clinician
          <select v-model="form.clinicianUserId" class="rounded border border-gray-300 bg-transparent p-2 dark:border-gray-700">
            <option value="" disabled>Select a clinician</option>
            <option v-for="option in clinicianOptions" :key="option.value" :value="option.value">
              {{ option.label }}
            </option>
          </select>
        </label>
        <label class="grid gap-1 text-sm font-medium">
          Availability type
          <select v-model="form.sourceType" class="rounded border border-gray-300 bg-transparent p-2 dark:border-gray-700">
            <option value="ONE_OFF">One-off block</option>
            <option value="RECURRING">Recurring weekly</option>
          </select>
        </label>

        <template v-if="form.sourceType === 'ONE_OFF'">
          <label class="grid gap-1 text-sm font-medium">
            Block starts
            <input v-model="form.startDateTime" type="datetime-local" class="rounded border border-gray-300 bg-transparent p-2 dark:border-gray-700" />
          </label>
          <label class="grid gap-1 text-sm font-medium">
            Block ends
            <input v-model="form.endDateTime" type="datetime-local" class="rounded border border-gray-300 bg-transparent p-2 dark:border-gray-700" />
          </label>
        </template>
        <template v-else>
          <fieldset class="grid gap-2 text-sm font-medium sm:col-span-2">
            <legend>Weekdays</legend>
            <div class="flex flex-wrap gap-3">
              <label v-for="day in weekdayOptions" :key="day.value" class="flex items-center gap-1 font-normal">
                <input v-model="form.weekdays" type="checkbox" :value="day.value" />
                {{ day.label }}
              </label>
            </div>
          </fieldset>
          <label class="grid gap-1 text-sm font-medium">
            Local start time
            <input v-model="form.startTime" type="time" class="rounded border border-gray-300 bg-transparent p-2 dark:border-gray-700" />
          </label>
          <label class="grid gap-1 text-sm font-medium">
            Local end time
            <input v-model="form.endTime" type="time" class="rounded border border-gray-300 bg-transparent p-2 dark:border-gray-700" />
          </label>
          <label class="grid gap-1 text-sm font-medium">
            Time zone
            <input v-model="form.timeZone" class="rounded border border-gray-300 bg-transparent p-2 dark:border-gray-700" />
          </label>
        </template>

        <label class="grid gap-1 text-sm font-medium">
          Slot length (minutes)
          <input v-model.number="form.slotDurationMinutes" type="number" min="15" max="240" step="15" class="rounded border border-gray-300 bg-transparent p-2 dark:border-gray-700" />
        </label>
        <label class="grid gap-1 text-sm font-medium">
          Booking horizon (days)
          <input v-model.number="form.bookingHorizonDays" type="number" min="1" max="180" class="rounded border border-gray-300 bg-transparent p-2 dark:border-gray-700" />
        </label>
        <label class="grid gap-1 text-sm font-medium">
          Location
          <input v-model="form.location" required maxlength="200" class="rounded border border-gray-300 bg-transparent p-2 dark:border-gray-700" placeholder="Clinic or remote" />
        </label>
        <label class="grid gap-1 text-sm font-medium">
          Video URL (optional)
          <input v-model="form.videoUrl" type="url" class="rounded border border-gray-300 bg-transparent p-2 dark:border-gray-700" placeholder="https://" />
        </label>
        <label class="grid gap-1 text-sm font-medium sm:col-span-2">
          Notes (optional)
          <textarea v-model="form.notes" rows="2" maxlength="2000" class="rounded border border-gray-300 bg-transparent p-2 dark:border-gray-700" />
        </label>
      </div>

      <div class="mt-4 flex flex-wrap gap-2">
        <UButton label="Preview slots" :loading="loadingPreview" @click="previewSlots" />
        <UButton label="Publish availability" color="primary" :loading="publishing" @click="publishAvailability" />
      </div>

      <div v-if="preview.length || loadingPreview" class="mt-5">
        <h3 class="mb-2 font-semibold">Preview ({{ preview.length }} available slots)</h3>
        <p v-if="loadingPreview" class="text-sm text-gray-500">Generating preview…</p>
        <p v-else-if="!preview.length" class="text-sm text-gray-500">No available slots in this range.</p>
        <ul v-else class="grid gap-1 text-sm sm:grid-cols-2">
          <li v-for="slot in preview" :key="slot.startTime">
            {{ new Date(slot.startTime).toLocaleString() }} – {{ new Date(slot.endTime).toLocaleTimeString() }}
          </li>
        </ul>
      </div>
    </section>

    <section>
      <h2 class="mb-3 text-lg font-semibold">Future published slots</h2>
      <p v-if="loadingSlots" class="text-sm text-gray-500">Loading slots…</p>
      <p v-else-if="!slots.length" class="text-sm text-gray-500">No future open or booked slots.</p>
      <div v-else class="space-y-3">
        <article v-for="slot in slots" :key="slot.id" class="rounded-lg border border-gray-200 bg-white p-4 dark:border-gray-800 dark:bg-gray-900">
          <template v-if="editingId === slot.id">
            <div class="grid gap-3 sm:grid-cols-2">
              <label class="grid gap-1 text-sm">Starts<input v-model="editForm.startDateTime" type="datetime-local" class="rounded border border-gray-300 bg-transparent p-2 dark:border-gray-700" /></label>
              <label class="grid gap-1 text-sm">Ends<input v-model="editForm.endDateTime" type="datetime-local" class="rounded border border-gray-300 bg-transparent p-2 dark:border-gray-700" /></label>
              <label class="grid gap-1 text-sm">Location<input v-model="editForm.location" class="rounded border border-gray-300 bg-transparent p-2 dark:border-gray-700" /></label>
              <label class="grid gap-1 text-sm">Video URL<input v-model="editForm.videoUrl" type="url" class="rounded border border-gray-300 bg-transparent p-2 dark:border-gray-700" /></label>
              <label class="grid gap-1 text-sm sm:col-span-2">Notes<textarea v-model="editForm.notes" rows="2" class="rounded border border-gray-300 bg-transparent p-2 dark:border-gray-700" /></label>
            </div>
            <div class="mt-3 flex gap-2">
              <UButton label="Save" :loading="savingEdit" @click="saveEdit(slot)" />
              <UButton label="Cancel" color="neutral" variant="soft" @click="editingId = null" />
            </div>
          </template>
          <template v-else>
            <div class="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p class="font-medium">
                  {{ new Date(slot.startTime).toLocaleString() }} – {{ new Date(slot.endTime).toLocaleTimeString() }}
                </p>
                <p class="text-sm text-gray-500">
                  {{ slot.location }} · {{ slot.sourceType === 'ONE_OFF' ? 'One-off' : 'Recurring' }} · {{ slot.status }}
                </p>
                <p v-if="slot.videoUrl" class="text-sm"><a :href="slot.videoUrl" target="_blank" rel="noopener noreferrer" class="underline">Video link</a></p>
                <p v-if="slot.notes" class="text-sm">{{ slot.notes }}</p>
              </div>
              <div class="flex gap-2">
                <UButton v-if="slot.status === 'OPEN'" label="Edit" color="neutral" variant="soft" @click="beginEdit(slot)" />
                <UButton v-if="slot.status === 'OPEN'" label="Delete" color="error" variant="soft" @click="deleteSlot(slot)" />
              </div>
            </div>
          </template>
        </article>
      </div>
    </section>
  </UContainer>
</template>
