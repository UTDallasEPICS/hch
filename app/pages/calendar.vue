<script setup lang="ts">
  import FullCalendar from '@fullcalendar/vue3'
  import timeGridPlugin from '@fullcalendar/timegrid'
  import dayGridPlugin from '@fullcalendar/daygrid'
  import interactionPlugin from '@fullcalendar/interaction'
  import { authClient } from '~/utils/auth-client'
  import listPlugin from '@fullcalendar/list'

  const isMobile = ref(process.client && window.innerWidth < 768)
  const calendarRef = ref()
  const session = authClient.useSession()
  const toast = useToast()
  const clients = ref<any[]>([])
  const events = ref<any[]>([])
  const clientColors = [
    '#3b82f6', // blue
    '#10b981', // green
    '#f59e0b', // amber
    '#8b5cf6', // purple
    '#ef4444', // red
    '#14b8a6', // teal
  ]

  const clientColorMap = new Map()
  let touchStartX = 0
  let touchEndX = 0
  async function loadEvents() {
    const data = await $fetch('/api/appointments')
    events.value = data
  }
  async function loadClients() {
    try {
      const data = await $fetch('/api/clients', {
        credentials: 'include',
      })

      console.log('CLIENTS:', data)
      clients.value = data
    } catch (err) {
      console.error('CLIENT LOAD FAILED:', err)
    }
  }

  function getClientColor(clientName: string) {
    if (!clientColorMap.has(clientName)) {
      const color = clientColors[clientColorMap.size % clientColors.length]
      clientColorMap.set(clientName, color)
    }

    return clientColorMap.get(clientName)
  }

  function goToDate(event: any) {
    const calendarApi = calendarRef.value.getApi()
    calendarApi.gotoDate(event.target.value)
  }

  function next() {
    calendarRef.value.getApi().next()
  }

  function prev() {
    calendarRef.value.getApi().prev()
  }

  function handleTouchStart(e: TouchEvent) {
    touchStartX = e.changedTouches[0].screenX
  }

  function handleTouchEnd(e: TouchEvent) {
    touchEndX = e.changedTouches[0].screenX
    handleSwipe()
  }

  function handleSwipe() {
    const calendar = calendarRef.value?.getApi()
    if (!calendar) return

    const diff = touchStartX - touchEndX

    if (Math.abs(diff) < 50) return

    if (diff > 0) {
      calendar.next()
    } else {
      calendar.prev()
    }
  }

  function today() {
    calendarRef.value.getApi().today()
  }

  function changeView(view: string) {
    const calendar = calendarRef.value.getApi()
    const mobile = window.innerWidth < 768

    if (view === 'week') {
      calendar.changeView(mobile ? 'listWeek' : 'timeGridWeek')
      return
    }

    if (view === 'day') {
      calendar.changeView('timeGridDay')
      return
    }

    if (view === 'month') {
      calendar.changeView('dayGridMonth')
      return
    }
  }

  onMounted(async () => {
    isMobile.value = window.innerWidth < 768

    await loadEvents()
    await loadClients()

    if (isMobile.value) {
      const calendarEl = calendarRef.value?.$el

      if (calendarEl) {
        calendarEl.addEventListener('touchstart', handleTouchStart)
        calendarEl.addEventListener('touchend', handleTouchEnd)
      }
    }
  })

  const isViewModalOpen = ref(false)
  const selectedEvent = ref<any>(null)
  const isEditMode = ref(false)
  const mobileView = ref('week')

  watch(mobileView, (view) => {
    changeView(view)
  })

  const editForm = reactive({
    title: '',
    description: '',
    date: '',
    startTime: '',
    endTime: '',
  })

  // use a reactive object instead of a ref so FullCalendar sees the callbacks
  const calendarOptions = reactive({
    plugins: [dayGridPlugin, timeGridPlugin, listPlugin, interactionPlugin],
    dayMaxEvents: true,
    eventDisplay: 'block',
    eventMinHeight: 30,
    expandRows: true,
    slotDuration: '00:30:00',
    snapDuration: '00:05:00',
    slotMinHeight: 50,
    slotMinTime: '06:00:00',
    slotMaxTime: '21:00:00',
    allDaySlot: false,
    slotEventOverlap: true,

    datesSet(info) {
      const view = info.view.type

      if (view.includes('Day')) mobileView.value = 'day'
      if (view.includes('Week')) mobileView.value = 'week'
      if (view.includes('Month')) mobileView.value = 'month'
    },

    dayHeaderDidMount(info) {
      if (info.el) {
        info.el.style.cursor = 'pointer'

        info.el.onclick = () => {
          const section = info.el.closest('.fc-list-day')
          if (!section) return

          const events = section.querySelectorAll('.fc-list-event')

          events.forEach((e) => {
            e.classList.toggle('hidden')
          })
        }
      }
    },

    initialView: isMobile.value ? 'listWeek' : 'dayGridMonth',

    headerToolbar: false,
    // listDayFormat: {
    //   weekday: 'long',
    //   day: 'numeric',
    // },
    // listDaySideFormat: false,
    noEventsContent: 'No events today',

    events: events,
    eventContent(arg: any) {
      const title = arg.event.title
      const time = arg.timeText
      const client = arg.event.extendedProps.clientName || 'Client'
      const color = getClientColor(client)

      return {
        html: `
          <div class="custom-event-wrapper" style="border-left: 4px solid ${color}; background: ${color}15;">
            <div class="event-title">${title}</div>
            <div class="event-meta">${client} • ${time}</div>
          </div>
        `,
      }
    },
    height: 'auto',
    eventClick: onEventClick,
  })

  function onEventClick(info: any) {
    console.log('calendar event clicked (listener)', info.event)

    isEditMode.value = false // ADD THIS LINE

    selectedEvent.value = {
      ...info.event.extendedProps,
      id: info.event.id, // ADD THIS (needed for update)
      title: info.event.title,
      start: info.event.start,
      end: info.event.end,
    }

    isViewModalOpen.value = true
  }

  function enterEditMode() {
    isEditMode.value = true
    editForm.title = selectedEvent.value.title
    editForm.description = selectedEvent.value.description || ''
    const d = selectedEvent.value.start
    editForm.date = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
    editForm.startTime = selectedEvent.value.start.toTimeString().slice(0, 5)
    editForm.endTime = selectedEvent.value.end.toTimeString().slice(0, 5)
  }

  function cancelEdit() {
    isEditMode.value = false
  }

  async function saveEdit() {
    try {
      await $fetch('/api/appointments/update', {
        method: 'POST',
        body: {
          id: selectedEvent.value.id,
          title: editForm.title,
          description: editForm.description,
          date: editForm.date,
          startTime: editForm.startTime,
          endTime: editForm.endTime,
        },
      })

      toast.add({
        title: 'Session updated',
        color: 'success',
      })

      isEditMode.value = false
      isViewModalOpen.value = false

      await loadEvents()
    } catch (error) {
      console.error(error)

      toast.add({
        title: 'Failed to update session',
        color: 'error',
      })
    }
  }

  const isCreateModalOpen = ref(false)

  const form = reactive({
    clientId: '',
    title: '',
    description: '',
    date: '',
    startTime: '',
    endTime: '',
  })

  const clientOptions = computed(() =>
    clients.value.map((c) => ({
      label: c.name || c.email,
      value: c.id,
    }))
  )

  function openCreateModal() {
    isCreateModalOpen.value = true
  }

  function closeCreateModal() {
    isCreateModalOpen.value = false
  }

  async function createSession() {
    console.log('sending appointment', { ...form })
    try {
      await $fetch('/api/appointments/create', {
        method: 'POST',
        body: {
          clientId: form.clientId,
          title: form.title,
          description: form.description,
          date: form.date,
          startTime: form.startTime,
          endTime: form.endTime,
        },
      })

      toast.add({
        title: 'Session created',
        color: 'success',
      })

      closeCreateModal()

      await loadEvents()
    } catch (error) {
      console.error(error)

      toast.add({
        title: 'Failed to create session',
        color: 'error',
      })
    }
  }
</script>

<template>
  <div class="space-y-4 p-6">
    <div class="flex items-center justify-between">
      <div class="flex items-center gap-3">
        <h1 class="text-xl font-semibold">Calendar</h1>

        <UButton icon="i-heroicons-chevron-left" variant="ghost" @click="prev" />
        <UButton icon="i-heroicons-chevron-right" variant="ghost" @click="next" />
        <UButton label="Today" variant="outline" @click="today" />
      </div>

      <div class="flex items-center gap-2">
        <UButton
          icon="i-heroicons-calendar-days"
          variant="outline"
          @click="$refs.datePicker.showPicker()"
        />
        <input ref="datePicker" type="date" class="hidden" @change="goToDate" />

        <!-- Desktop buttons -->
        <div class="hidden items-center gap-2 md:flex">
          <UButton label="Day" variant="outline" @click="changeView('day')" />
          <UButton label="Week" variant="outline" @click="changeView('week')" />
          <UButton label="Month" variant="outline" @click="changeView('month')" />
        </div>

        <!-- Mobile dropdown -->
        <div class="md:hidden">
          <select v-model="mobileView" class="w-28 rounded border px-2 py-1 md:hidden">
            <option value="day">Day</option>
            <option value="week">Week</option>
            <option value="month">Month</option>
          </select>
        </div>

        <UButton
          v-if="session.data?.user?.role === 'ADMIN'"
          icon="i-heroicons-plus"
          class="fixed right-6 bottom-8 z-50 rounded-full shadow-lg lg:hidden"
          size="xl"
          @click="openCreateModal"
        />
      </div>
    </div>
    <div class="flex gap-6">
      <!-- sidebar -->
      <div class="hidden w-64 space-y-4 lg:block">
        <UButton icon="i-heroicons-plus" label="Create Event" block @click="openCreateModal" />
      </div>

      <!-- main calendar -->
      <div class="flex-1 rounded-xl bg-white p-4 shadow dark:bg-gray-900">
        <FullCalendar ref="calendarRef" :options="calendarOptions" class="min-h-[700px]" />
      </div>
    </div>
  </div>

  <UModal
    v-model:open="isCreateModalOpen"
    :transition="true"
    :fullscreen="false"
    :overlay="true"
    :ui="{ content: 'max-w-2xl overflow-visible', body: 'overflow-visible' }"
  >
    <template #title> Create Session </template>

    <template #content>
      <div class="flex flex-col gap-4 p-4">
        <div>
          <label class="mb-2 block text-sm font-medium" for="client">Client</label>
          <select id="client" v-model="form.clientId" class="w-full rounded border px-2 py-1">
            <option value="" disabled>Select a client</option>
            <option v-for="opt in clientOptions" :key="opt.value" :value="opt.value">
              {{ opt.label }}
            </option>
          </select>
          <p v-if="clientOptions.length === 0" class="mt-1 text-xs text-gray-500">
            No clients available. Make sure clients are registered in the system.
          </p>
        </div>

        <UInput v-model="form.title" placeholder="Session Title" />

        <UTextarea v-model="form.description" placeholder="Description" />

        <div class="grid grid-cols-3 gap-4">
          <UInput v-model="form.date" type="date" />

          <UInput v-model="form.startTime" type="time" />

          <UInput v-model="form.endTime" type="time" />
        </div>

        <div class="flex justify-end gap-3 pt-2">
          <UButton variant="outline" @click="closeCreateModal"> Cancel </UButton>

          <UButton color="primary" @click="createSession"> Create </UButton>
        </div>
      </div>
    </template>
  </UModal>

  <!-- view details modal -->
  <UModal
    v-model:open="isViewModalOpen"
    :transition="true"
    :fullscreen="false"
    :overlay="true"
    :ui="{ content: 'max-w-2xl overflow-visible', body: 'overflow-visible' }"
  >
    <template #title> Session Details </template>

    <template #content>
      <div class="flex flex-col gap-4 p-4">
        <div v-if="!isEditMode">
          <p><strong>Client:</strong> {{ selectedEvent?.clientName }}</p>
          <p><strong>Date:</strong> {{ selectedEvent?.start?.toLocaleDateString() }}</p>
          <p>
            <strong>Time:</strong>
            {{ selectedEvent?.start?.toLocaleTimeString() }} -
            {{ selectedEvent?.end?.toLocaleTimeString() }}
          </p>

          <p v-if="selectedEvent?.description">
            <strong>Description:</strong> {{ selectedEvent.description }}
          </p>

          <p><strong>Status:</strong> {{ selectedEvent?.status }}</p>
        </div>

        <div v-else class="flex flex-col gap-4">
          <div>
            <label class="mb-2 block text-sm font-medium">Session Title</label>
            <UInput v-model="editForm.title" />
          </div>

          <div>
            <label class="mb-2 block text-sm font-medium">Description</label>
            <UTextarea v-model="editForm.description" />
          </div>

          <div class="grid grid-cols-3 gap-4">
            <div>
              <label class="mb-2 block text-sm font-medium">Date</label>
              <UInput v-model="editForm.date" type="date" />
            </div>

            <div>
              <label class="mb-2 block text-sm font-medium">Start Time</label>
              <UInput v-model="editForm.startTime" type="time" />
            </div>

            <div>
              <label class="mb-2 block text-sm font-medium">End Time</label>
              <UInput v-model="editForm.endTime" type="time" />
            </div>
          </div>
        </div>

        <!-- Buttons (same pattern as Create modal) -->
        <div class="flex justify-end gap-3 pt-2">
          <UButton
            v-if="!isEditMode && session.data?.user?.role === 'ADMIN'"
            variant="outline"
            @click="enterEditMode"
          >
            Edit
          </UButton>

          <UButton v-if="!isEditMode" variant="outline" @click="isViewModalOpen = false">
            Close
          </UButton>

          <UButton v-if="isEditMode" variant="outline" @click="cancelEdit"> Cancel </UButton>

          <UButton v-if="isEditMode" color="primary" @click="saveEdit"> Save </UButton>
        </div>
      </div>
    </template>
  </UModal>
</template>
