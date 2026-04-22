<script setup lang="ts">
  import FullCalendar from '@fullcalendar/vue3'
  import timeGridPlugin from '@fullcalendar/timegrid'
  import dayGridPlugin from '@fullcalendar/daygrid'
  import interactionPlugin from '@fullcalendar/interaction'
  import { authClient } from '~/utils/auth-client'
  import listPlugin from '@fullcalendar/list'
  import { VIDEO_PROVIDER_LABEL } from '~/utils/video-conference'

  const videoMeetingTypeOptions = [
    { value: 'GOOGLE_MEET' as const, label: 'Google Meet' },
    { value: 'ZOOM' as const, label: 'Zoom' },
    { value: 'OTHER' as const, label: 'Other link' },
  ]

  const isMobile = ref(process.client && window.innerWidth < 768)
  const calendarRef = ref()
  const session = authClient.useSession()
  const currentUser = computed(
    () =>
      (session.value.data?.user as
        | ({ id: string; role?: string } & Record<string, unknown>)
        | null) ?? null
  )
  const { data: adminData, refresh: refreshAdminData } = await useFetch<{
    isAdmin: boolean
    isClinician: boolean
    isStaff: boolean
  }>('/api/users/me/is-admin', {
    server: false,
    default: () => ({ isAdmin: false, isClinician: false, isStaff: false }),
  })
  watch(
    () => currentUser.value?.id,
    () => {
      refreshAdminData()
    },
    { immediate: true }
  )
  const toast = useToast()
  const clients = ref<any[]>([])
  const events = ref<any[]>([])
  const isAdmin = computed(() => adminData.value?.isStaff ?? false)
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
    try {
      const data = await $fetch<
        {
          id: string
          title: string
          sessionName: string
          sessionNumber: number
          start: string
          end: string
          clientName: string
          description: string | null
          status: string
          videoProvider: string | null
          videoJoinUrl: string | null
        }[]
      >('/api/appointments', {
        credentials: 'include',
      })

      events.value = data.map((e) => ({
        id: e.id,
        title: e.sessionName || e.title,
        start: e.start,
        end: e.end,
        extendedProps: {
          sessionName: e.sessionName,
          sessionNumber: e.sessionNumber,
          clientName: e.clientName,
          description: e.description,
          status: e.status,
          videoProvider: e.videoProvider,
          videoJoinUrl: e.videoJoinUrl,
        },
      }))
    } catch (err) {
      console.error('EVENT LOAD FAILED:', err)
      events.value = []
    }
  }

  async function loadClients() {
    if (!isAdmin.value) {
      clients.value = []
      return
    }

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

  async function syncCalendarData() {
    await loadEvents()
    await loadClients()
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

  onMounted(() => {
    isMobile.value = window.innerWidth < 768

    if (isMobile.value) {
      const calendarEl = calendarRef.value?.$el

      if (calendarEl) {
        calendarEl.addEventListener('touchstart', handleTouchStart)
        calendarEl.addEventListener('touchend', handleTouchEnd)
      }
    }
  })

  watch(
    () => currentUser.value?.id,
    async (userId) => {
      if (!userId) {
        events.value = []
        clients.value = []
        return
      }

      await syncCalendarData()
    },
    { immediate: true }
  )

  watch(isAdmin, async (admin) => {
    if (admin && currentUser.value?.id) {
      await loadClients()
    } else if (!admin) {
      clients.value = []
    }
  })

  const isViewModalOpen = ref(false)
  const selectedEvent = ref<any>(null)
  const isEditMode = ref(false)
  const isDeleteConfirming = ref(false)
  const mobileView = ref('week')

  watch(mobileView, (view) => {
    changeView(view)
  })

  const editForm = reactive({
    description: '',
    date: '',
    startTime: '',
    endTime: '',
    includeVideo: false,
    videoProvider: '' as '' | 'GOOGLE_MEET' | 'ZOOM' | 'OTHER',
    videoJoinUrl: '',
  })
  const createTimeRangeError = ref('')
  const editTimeRangeError = ref('')

  function getTimeRangeError(
    date: string,
    startTime: string,
    endTime: string,
    options?: { allowPastStart?: boolean }
  ): string {
    if (!date || !startTime || !endTime) return 'Please choose date, start time, and end time.'
    const start = new Date(`${date}T${startTime}`)
    const end = new Date(`${date}T${endTime}`)
    const now = new Date()
    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
      return 'Please enter a valid date and time.'
    }
    if (!options?.allowPastStart && start < now) {
      return 'Cannot create events in the past.'
    }
    if (end <= start) {
      return 'End time must be after start time on the selected date.'
    }
    return ''
  }

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
    console.log('event extendedProps:', info.event.extendedProps)
    console.log('event._def.extendedProps:', info.event._def?.extendedProps)

    isEditMode.value = false

    // Get clientName from either extendedProps or _def.extendedProps
    const clientName =
      info.event.extendedProps?.clientName || info.event._def?.extendedProps?.clientName

    const ext = info.event.extendedProps || info.event._def?.extendedProps || {}
    selectedEvent.value = {
      ...ext,
      clientName: clientName, // Make sure clientName is included
      id: info.event.id,
      title: info.event.title,
      sessionName: ext.sessionName || info.event.title,
      sessionNumber: ext.sessionNumber ?? null,
      start: info.event.start,
      end: info.event.end,
      description: ext.description,
      status: ext.status,
      videoProvider: ext.videoProvider ?? null,
      videoJoinUrl: ext.videoJoinUrl ?? null,
    }

    console.log('selectedEvent after click:', selectedEvent.value)

    isViewModalOpen.value = true
  }

  function enterEditMode() {
    isEditMode.value = true
    editForm.description = selectedEvent.value.description || ''
    const d = selectedEvent.value.start
    editForm.date = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
    editForm.startTime = selectedEvent.value.start.toTimeString().slice(0, 5)
    editForm.endTime = selectedEvent.value.end.toTimeString().slice(0, 5)
    editForm.includeVideo = Boolean(
      selectedEvent.value.videoJoinUrl || selectedEvent.value.videoProvider
    )
    editForm.videoJoinUrl = selectedEvent.value.videoJoinUrl || ''
    editForm.videoProvider = editForm.includeVideo
      ? (selectedEvent.value.videoProvider as typeof editForm.videoProvider) || 'GOOGLE_MEET'
      : ''
    editTimeRangeError.value = ''
  }

  function cancelEdit() {
    isEditMode.value = false
    editTimeRangeError.value = ''
  }

  async function saveEdit() {
    if (editForm.includeVideo && !editForm.videoJoinUrl?.trim()) {
      toast.add({
        title: 'Add a video link or uncheck Video',
        color: 'warning',
      })
      return
    }
    editTimeRangeError.value = getTimeRangeError(editForm.date, editForm.startTime, editForm.endTime, {
      allowPastStart: true,
    })
    if (editTimeRangeError.value) {
      toast.add({
        title: 'Invalid date/time range',
        description: editTimeRangeError.value,
        color: 'warning',
      })
      return
    }
    try {
      await $fetch(`/api/appointments/${selectedEvent.value.id}`, {
        method: 'PUT',
        body: {
          id: selectedEvent.value.id,
          description: editForm.description,
          date: editForm.date,
          startTime: editForm.startTime,
          endTime: editForm.endTime,
          videoProvider: editForm.includeVideo ? editForm.videoProvider || 'GOOGLE_MEET' : null,
          videoJoinUrl: editForm.includeVideo ? editForm.videoJoinUrl.trim() || null : null,
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
      const message =
        (error as { data?: { statusMessage?: string }; statusMessage?: string })?.data
          ?.statusMessage ||
        (error as { statusMessage?: string })?.statusMessage ||
        'Failed to update session'

      toast.add({
        title: message,
        color: 'error',
      })
    }
  }

  async function deleteEvent() {
    try {
      await $fetch(`/api/appointments/${selectedEvent.value.id}`, {
        method: 'DELETE',
        credentials: 'include',
      })

      toast.add({
        title: 'Session deleted',
        color: 'success',
      })

      isDeleteConfirming.value = false
      isViewModalOpen.value = false

      await loadEvents()
    } catch (error) {
      console.error('Delete error:', error)

      toast.add({
        title: 'Failed to delete session',
        color: 'error',
      })
    }
  }

  const isCreateModalOpen = ref(false)

  const form = reactive({
    clientId: '',
    description: '',
    date: '',
    startTime: '',
    endTime: '',
    includeVideo: false,
    videoProvider: '' as '' | 'GOOGLE_MEET' | 'ZOOM' | 'OTHER',
    videoJoinUrl: '',
  })

  watch(
    () => form.includeVideo,
    (on) => {
      if (!on) {
        form.videoProvider = ''
        form.videoJoinUrl = ''
      } else if (!form.videoProvider) {
        form.videoProvider = 'GOOGLE_MEET'
      }
    }
  )

  watch(
    () => editForm.includeVideo,
    (on) => {
      if (!on) {
        editForm.videoProvider = ''
        editForm.videoJoinUrl = ''
      } else if (!editForm.videoProvider) {
        editForm.videoProvider = 'GOOGLE_MEET'
      }
    }
  )

  const clientOptions = computed(() =>
    clients.value
      .filter((c) => c.status !== 'Archived')
      .map((c) => ({
        label: c.name || c.email,
        value: c.id,
      }))
  )

  const selectedClientName = computed(() => {
    const name = selectedEvent.value?.clientName
    console.log('selectedClientName:', name)
    return name || 'Unknown Client'
  })

  function openCreateModal() {
    form.clientId = ''
    form.description = ''
    form.date = ''
    form.startTime = ''
    form.endTime = ''
    form.includeVideo = false
    form.videoProvider = ''
    form.videoJoinUrl = ''
    createTimeRangeError.value = ''
    isCreateModalOpen.value = true
  }

  function closeCreateModal() {
    isCreateModalOpen.value = false
    createTimeRangeError.value = ''
  }

  async function createSession() {
    if (form.includeVideo && !form.videoJoinUrl?.trim()) {
      toast.add({
        title: 'Add a video link or uncheck Video',
        color: 'warning',
      })
      return
    }
    createTimeRangeError.value = getTimeRangeError(form.date, form.startTime, form.endTime)
    if (!form.clientId || createTimeRangeError.value) {
      toast.add({
        title: 'Invalid session details',
        description: !form.clientId ? 'Please select a client.' : createTimeRangeError.value,
        color: 'warning',
      })
      return
    }
    console.log('sending appointment', { ...form })
    try {
      await $fetch('/api/appointments', {
        method: 'POST',
        body: {
          clientId: form.clientId,
          description: form.description,
          date: form.date,
          startTime: form.startTime,
          endTime: form.endTime,
          videoProvider: form.includeVideo ? form.videoProvider || 'GOOGLE_MEET' : undefined,
          videoJoinUrl: form.includeVideo ? form.videoJoinUrl.trim() : undefined,
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
      const message =
        (error as { data?: { statusMessage?: string }; statusMessage?: string })?.data
          ?.statusMessage ||
        (error as { statusMessage?: string })?.statusMessage ||
        'Failed to create session'

      toast.add({
        title: message,
        color: 'error',
      })
    }
  }

  watch(
    () => [form.date, form.startTime, form.endTime] as const,
    ([date, startTime, endTime]) => {
      if (!isCreateModalOpen.value) return
      createTimeRangeError.value = getTimeRangeError(date, startTime, endTime)
    }
  )

  watch(
    () => [editForm.date, editForm.startTime, editForm.endTime] as const,
    ([date, startTime, endTime]) => {
      if (!isEditMode.value) return
      editTimeRangeError.value = getTimeRangeError(date, startTime, endTime, { allowPastStart: true })
    }
  )
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
      </div>
    </div>

    <div v-if="isAdmin" class="flex justify-start">
      <UButton icon="i-heroicons-plus" label="Create Event" @click="openCreateModal" />
    </div>

    <div class="flex gap-6">
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

        <p class="rounded-md border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-600 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-300">
          Session name will be auto-generated as <strong>Firstname_Lastname_##</strong>.
        </p>

        <UTextarea v-model="form.description" placeholder="Description" />

        <div class="grid grid-cols-3 gap-4">
          <UInput v-model="form.date" type="date" />

          <UInput v-model="form.startTime" type="time" />

          <UInput v-model="form.endTime" type="time" />
        </div>
        <p v-if="createTimeRangeError" class="text-sm text-red-500">
          {{ createTimeRangeError }}
        </p>

        <div class="flex flex-col gap-3">
          <label class="flex cursor-pointer items-center gap-3">
            <UCheckbox v-model="form.includeVideo" />
            <span class="text-sm font-medium text-gray-900 dark:text-gray-100">Video</span>
          </label>

          <div
            v-if="form.includeVideo"
            class="space-y-3 rounded-lg border border-gray-200 bg-gray-50/90 p-4 shadow-sm dark:border-gray-700 dark:bg-gray-900/60"
          >
            <p class="text-xs font-medium text-gray-600 dark:text-gray-400">Meeting type</p>
            <div class="flex flex-wrap gap-4">
              <label
                v-for="opt in videoMeetingTypeOptions"
                :key="opt.value"
                class="flex cursor-pointer items-center gap-2 text-sm text-gray-800 dark:text-gray-200"
              >
                <input
                  v-model="form.videoProvider"
                  type="radio"
                  name="create-video-provider"
                  :value="opt.value"
                  class="text-primary-600 focus:ring-primary-500 border-gray-300 dark:border-gray-600"
                />
                {{ opt.label }}
              </label>
            </div>
            <div>
              <label
                class="mb-1 block text-xs font-medium text-gray-600 dark:text-gray-400"
                for="create-video-url"
              >
                Join link
              </label>
              <UInput
                id="create-video-url"
                v-model="form.videoJoinUrl"
                placeholder="https://meet.google.com/..."
              />
              <p class="mt-1 text-xs text-gray-500 dark:text-gray-400">
                Paste a secure https link so clients can join from the dashboard and calendar.
              </p>
            </div>
          </div>
        </div>

        <div class="flex justify-end gap-3 pt-2">
          <UButton variant="outline" @click="closeCreateModal"> Cancel </UButton>

          <UButton
            color="primary"
            :disabled="!form.clientId || !!createTimeRangeError"
            @click="createSession"
          >
            Create
          </UButton>
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
          <p><strong>Client:</strong> {{ selectedClientName }}</p>
          <p><strong>Session Name:</strong> {{ selectedEvent?.sessionName || selectedEvent?.title }}</p>
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

          <div
            v-if="selectedEvent?.videoJoinUrl && selectedEvent?.videoProvider === 'GOOGLE_MEET'"
            class="mt-3"
          >
            <p class="mb-2 text-sm font-medium text-gray-700 dark:text-gray-300">Video</p>
            <UButton
              :to="selectedEvent.videoJoinUrl"
              external
              target="_blank"
              rel="noopener noreferrer"
              color="primary"
              variant="soft"
              icon="i-heroicons-video-camera-20-solid"
              label="Join Google Meet"
            />
          </div>
          <div v-else-if="selectedEvent?.videoJoinUrl && selectedEvent?.videoProvider" class="mt-3">
            <p class="mb-2 text-sm font-medium text-gray-700 dark:text-gray-300">Video</p>
            <UButton
              :to="selectedEvent.videoJoinUrl"
              external
              target="_blank"
              rel="noopener noreferrer"
              color="primary"
              variant="soft"
              icon="i-heroicons-video-camera-20-solid"
              :label="`Join ${VIDEO_PROVIDER_LABEL[selectedEvent.videoProvider] ?? 'session'}`"
            />
          </div>
        </div>

        <div v-else class="flex flex-col gap-4">
          <p class="rounded-md border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-600 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-300">
            Session name is auto-generated and cannot be edited.
          </p>

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
          <p v-if="editTimeRangeError" class="text-sm text-red-500">
            {{ editTimeRangeError }}
          </p>

          <div class="flex flex-col gap-3">
            <label class="flex cursor-pointer items-center gap-3">
              <UCheckbox v-model="editForm.includeVideo" />
              <span class="text-sm font-medium text-gray-900 dark:text-gray-100">Video</span>
            </label>

            <div
              v-if="editForm.includeVideo"
              class="space-y-3 rounded-lg border border-gray-200 bg-gray-50/90 p-4 shadow-sm dark:border-gray-700 dark:bg-gray-900/60"
            >
              <p class="text-xs font-medium text-gray-600 dark:text-gray-400">Meeting type</p>
              <div class="flex flex-wrap gap-4">
                <label
                  v-for="opt in videoMeetingTypeOptions"
                  :key="opt.value"
                  class="flex cursor-pointer items-center gap-2 text-sm text-gray-800 dark:text-gray-200"
                >
                  <input
                    v-model="editForm.videoProvider"
                    type="radio"
                    name="edit-video-provider"
                    :value="opt.value"
                    class="text-primary-600 focus:ring-primary-500 border-gray-300 dark:border-gray-600"
                  />
                  {{ opt.label }}
                </label>
              </div>
              <div>
                <label
                  class="mb-1 block text-xs font-medium text-gray-600 dark:text-gray-400"
                  for="edit-video-url"
                >
                  Join link
                </label>
                <UInput
                  id="edit-video-url"
                  v-model="editForm.videoJoinUrl"
                  placeholder="https://meet.google.com/..."
                />
              </div>
            </div>
          </div>
        </div>

        <!-- Delete confirmation -->
        <div
          v-if="isDeleteConfirming && !isEditMode"
          class="rounded-lg border border-red-200 bg-red-50 p-4 dark:border-red-900 dark:bg-red-900/20"
        >
          <p class="mb-3 font-medium text-red-900 dark:text-red-200">
            Are you sure you want to delete this session?
          </p>
          <div class="flex justify-end gap-2">
            <UButton variant="outline" @click="isDeleteConfirming = false"> Cancel </UButton>
            <UButton color="error" @click="deleteEvent"> Delete </UButton>
          </div>
        </div>

        <!-- Buttons (same pattern as Create modal) -->
        <div v-if="!isDeleteConfirming" class="flex justify-end gap-3 pt-2">
          <UButton
            v-if="!isEditMode && isAdmin"
            color="error"
            variant="outline"
            @click="isDeleteConfirming = true"
          >
            Delete
          </UButton>

          <UButton v-if="!isEditMode && isAdmin" variant="outline" @click="enterEditMode">
            Edit
          </UButton>

          <UButton v-if="!isEditMode" variant="outline" @click="isViewModalOpen = false">
            Close
          </UButton>

          <UButton v-if="isEditMode" variant="outline" @click="cancelEdit"> Cancel </UButton>

          <UButton v-if="isEditMode" color="primary" :disabled="!!editTimeRangeError" @click="saveEdit">
            Save
          </UButton>
        </div>
      </div>
    </template>
  </UModal>
</template>
