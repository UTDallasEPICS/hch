<script setup lang="ts">
  type ScheduleRequestRow = {
    id: string
    requestedStartTime: string
    requestedEndTime: string
    message: string | null
    status: 'PENDING' | 'ACCEPTED' | 'DENIED'
    createdAt: string
    updatedAt: string
    decidedAt: string | null
    staffResponseNote: string | null
    createdAppointmentId: string | null
  }

  const toast = useToast()

  const {
    data: rows,
    pending,
    error,
    refresh,
  } = await useFetch<ScheduleRequestRow[]>('/api/client/schedule-requests', {
    getCachedData: () => undefined,
  })

  const newDate = ref('')
  const newStart = ref('')
  const newEnd = ref('')
  const newMessage = ref('')
  const submitting = ref(false)

  const editOpen = ref(false)
  const editId = ref<string | null>(null)
  const editDate = ref('')
  const editStart = ref('')
  const editEnd = ref('')
  const editMessage = ref('')
  const editSaving = ref(false)

  function toDateInputValue(iso: string) {
    const d = new Date(iso)
    if (Number.isNaN(d.getTime())) return ''
    const y = d.getFullYear()
    const m = String(d.getMonth() + 1).padStart(2, '0')
    const day = String(d.getDate()).padStart(2, '0')
    return `${y}-${m}-${day}`
  }

  function toTimeInputValue(iso: string) {
    const d = new Date(iso)
    if (Number.isNaN(d.getTime())) return ''
    return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
  }

  function formatRange(startIso: string, endIso: string) {
    const start = new Date(startIso)
    const end = new Date(endIso)
    const dateStr = start.toLocaleDateString(undefined, {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    })
    const timeOpts: Intl.DateTimeFormatOptions = { hour: 'numeric', minute: '2-digit' }
    return `${dateStr} · ${start.toLocaleTimeString(undefined, timeOpts)} – ${end.toLocaleTimeString(undefined, timeOpts)}`
  }

  function statusBadgeColor(s: ScheduleRequestRow['status']) {
    if (s === 'PENDING') return 'warning'
    if (s === 'ACCEPTED') return 'success'
    return 'error'
  }

  function statusLabel(s: ScheduleRequestRow['status']) {
    if (s === 'PENDING') return 'Awaiting clinic'
    if (s === 'ACCEPTED') return 'Approved'
    return 'Not scheduled'
  }

  async function submitNew() {
    if (!newDate.value || !newStart.value || !newEnd.value) {
      toast.add({
        title: 'Missing fields',
        description: 'Choose a date, start time, and end time.',
        color: 'warning',
      })
      return
    }
    try {
      submitting.value = true
      await $fetch('/api/client/schedule-requests', {
        method: 'POST',
        body: {
          date: newDate.value,
          startTime: newStart.value,
          endTime: newEnd.value,
          message: newMessage.value.trim() || undefined,
        },
      })
      toast.add({
        title: 'Request sent',
        description: 'Your clinician will review it.',
        color: 'success',
      })
      newDate.value = ''
      newStart.value = ''
      newEnd.value = ''
      newMessage.value = ''
      await refresh()
    } catch (e: unknown) {
      const msg =
        (e as { data?: { statusMessage?: string } })?.data?.statusMessage ??
        'Could not submit request'
      toast.add({ title: 'Error', description: msg, color: 'error' })
    } finally {
      submitting.value = false
    }
  }

  function openEdit(r: ScheduleRequestRow) {
    if (r.status !== 'PENDING') return
    editId.value = r.id
    editDate.value = toDateInputValue(r.requestedStartTime)
    editStart.value = toTimeInputValue(r.requestedStartTime)
    editEnd.value = toTimeInputValue(r.requestedEndTime)
    editMessage.value = r.message ?? ''
    editOpen.value = true
  }

  async function saveEdit() {
    if (!editId.value || !editDate.value || !editStart.value || !editEnd.value) {
      toast.add({
        title: 'Missing fields',
        description: 'Choose a date, start time, and end time.',
        color: 'warning',
      })
      return
    }
    try {
      editSaving.value = true
      await $fetch(`/api/client/schedule-requests/${editId.value}`, {
        method: 'PATCH',
        body: {
          date: editDate.value,
          startTime: editStart.value,
          endTime: editEnd.value,
          message: editMessage.value.trim() || null,
        },
      })
      toast.add({ title: 'Request updated', color: 'success' })
      editOpen.value = false
      editId.value = null
      await refresh()
    } catch (e: unknown) {
      const msg =
        (e as { data?: { statusMessage?: string } })?.data?.statusMessage ?? 'Could not update'
      toast.add({ title: 'Error', description: msg, color: 'error' })
    } finally {
      editSaving.value = false
    }
  }
</script>

<template>
  <section class="mt-8">
    <div class="mb-3">
      <h2 class="text-lg font-semibold text-gray-900 dark:text-white">Request a session time</h2>
      <p class="mt-0.5 text-sm text-gray-600 dark:text-gray-400">
        Propose a date and time for your next visit. Scheduling is not confirmed until your
        clinician or admin approves it.
      </p>
    </div>

    <UAlert
      v-if="error"
      color="error"
      variant="subtle"
      title="Could not load your requests"
      :description="String(error)"
    />

    <div
      v-else
      class="rounded-xl border border-gray-200 bg-white p-5 shadow-sm dark:border-gray-800 dark:bg-gray-900"
    >
      <h3 class="text-sm font-semibold text-gray-900 dark:text-white">New request</h3>
      <div class="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <UFormField label="Date">
          <UInput v-model="newDate" type="date" class="w-full" />
        </UFormField>
        <UFormField label="Start">
          <UInput v-model="newStart" type="time" class="w-full" />
        </UFormField>
        <UFormField label="End">
          <UInput v-model="newEnd" type="time" class="w-full" />
        </UFormField>
        <div class="flex items-end">
          <UButton
            color="primary"
            class="w-full sm:w-auto"
            :loading="submitting"
            icon="i-heroicons-paper-airplane-20-solid"
            label="Submit request"
            @click="submitNew"
          />
        </div>
      </div>
      <UFormField label="Note (optional)" class="mt-3">
        <UTextarea
          v-model="newMessage"
          :rows="2"
          class="w-full"
          placeholder="Anything your care team should know"
        />
      </UFormField>
    </div>

    <div class="mt-6">
      <h3 class="mb-2 text-sm font-semibold text-gray-900 dark:text-white">Your requests</h3>
      <div v-if="pending" class="space-y-2">
        <USkeleton class="h-16 w-full" />
        <USkeleton class="h-16 w-full" />
      </div>
      <div
        v-else-if="!rows?.length"
        class="rounded-lg border border-dashed border-gray-200 p-6 text-center text-sm text-gray-600 dark:border-gray-700 dark:text-gray-400"
      >
        No requests yet. Use the form above to propose a time.
      </div>
      <ul v-else class="space-y-3">
        <li
          v-for="r in rows"
          :key="r.id"
          class="rounded-xl border border-gray-200 bg-white p-4 dark:border-gray-800 dark:bg-gray-900"
        >
          <div class="flex flex-wrap items-start justify-between gap-3">
            <div class="min-w-0">
              <UBadge :color="statusBadgeColor(r.status)" variant="subtle" size="sm" class="mb-2">
                {{ statusLabel(r.status) }}
              </UBadge>
              <p class="font-medium text-gray-900 dark:text-white">
                {{ formatRange(r.requestedStartTime, r.requestedEndTime) }}
              </p>
              <p v-if="r.message" class="mt-1 text-sm text-gray-600 dark:text-gray-400">
                {{ r.message }}
              </p>
              <p
                v-if="r.status === 'DENIED' && r.staffResponseNote"
                class="mt-2 text-sm text-gray-600 dark:text-gray-400"
              >
                <span class="font-medium text-gray-800 dark:text-gray-200">Clinic note:</span>
                {{ r.staffResponseNote }}
              </p>
            </div>
            <UButton
              v-if="r.status === 'PENDING'"
              size="sm"
              variant="soft"
              color="primary"
              label="Edit"
              icon="i-heroicons-pencil-square-20-solid"
              @click="openEdit(r)"
            />
          </div>
        </li>
      </ul>
    </div>

    <UModal
      :open="editOpen"
      title="Edit request"
      :ui="{ content: 'max-w-lg w-full' }"
      @update:open="(v: boolean) => !v && (editOpen = false)"
    >
      <template #body>
        <div class="space-y-4 p-6">
          <div class="grid gap-3 sm:grid-cols-3">
            <UFormField label="Date">
              <UInput v-model="editDate" type="date" class="w-full" />
            </UFormField>
            <UFormField label="Start">
              <UInput v-model="editStart" type="time" class="w-full" />
            </UFormField>
            <UFormField label="End">
              <UInput v-model="editEnd" type="time" class="w-full" />
            </UFormField>
          </div>
          <UFormField label="Note (optional)">
            <UTextarea v-model="editMessage" :rows="3" class="w-full" />
          </UFormField>
          <div class="flex justify-end gap-2">
            <UButton variant="ghost" @click="editOpen = false">Cancel</UButton>
            <UButton color="primary" :loading="editSaving" @click="saveEdit">Save changes</UButton>
          </div>
        </div>
      </template>
    </UModal>
  </section>
</template>
