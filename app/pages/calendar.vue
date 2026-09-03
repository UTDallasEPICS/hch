<script setup lang="ts">
  import FullCalendar from '@fullcalendar/vue3'
  import timeGridPlugin from '@fullcalendar/timegrid'
  import dayGridPlugin from '@fullcalendar/daygrid'
  import interactionPlugin from '@fullcalendar/interaction'
  import { authClient } from '~/utils/auth-client'
  import listPlugin from '@fullcalendar/list'
  import { VIDEO_PROVIDER_LABEL } from '~/utils/video-conference'
  import { getAttendanceColor, isAttendanceStrikethrough } from '~/utils/attendance-status'

  const isMobile = ref(process.client && window.innerWidth < 768)
  const calendarRef = ref()
  const datePickerRef = ref<HTMLInputElement | null>(null)
  const session = authClient.useSession()
  const currentUser = computed(
    () =>
      (session.value.data?.user as
        | ({ id: string; role?: string } & Record<string, unknown>)
        | null) ?? null
  )
  const deleteType = ref<'ONE' | 'FUTURE' | 'ALL' | null>(null)
  const isDeleteTypeModalOpen = ref(false)
  const isDeleteConfirmOpen = ref(false)
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
  const isAdminViewer = computed(() => adminData.value?.isAdmin === true)

  type ClinicianOption = {
    id: string
    name: string
    email: string
  }

  type CalendarClient = {
    id: string
    name: string
    email: string
    status: string
  }

  type AppointmentResponse = {
    id: string
    clientId: string
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
    attendanceStatus: string | null
    assignedClinicianName: string | null
    seriesId: string | null
    recurrence: string
  }

  type SelectedCalendarEvent = {
    id: string
    title: string
    sessionName: string
    sessionNumber: number | null
    clientId: string
    start: Date
    end: Date
    clientName: string
    description: string | null
    status: string
    videoProvider: string | null
    videoJoinUrl: string | null
    assignedClinicianName: string | null
    seriesId?: string | null
    recurrence?: string
  }

  const { data: clinicians } = await useFetch<ClinicianOption[]>('/api/clinicians', {
    getCachedData: () => undefined,
  })
  const clinicianFilter = ref<string[]>([])
  const clientFilter = ref<string[]>([])
  const clinicianFilterItems = computed(() =>
    (clinicians.value ?? []).map((clinician) => ({
      label: clinician.name ? `${clinician.name} (${clinician.email})` : clinician.email,
      value: clinician.id,
    }))
  )
  const clientOptionsQueryParams = computed(() => {
    const params: Record<string, string> = {}
    if (isAdminViewer.value && clinicianFilter.value.length > 0) {
      params.clinicianUserId = clinicianFilter.value.join(',')
    }
    return params
  })
  const calendarQueryParams = computed(() => {
    const params = { ...clientOptionsQueryParams.value }
    if (clientFilter.value.length > 0) {
      params.clientId = clientFilter.value.join(',')
    }
    return params
  })
  const clients = ref<CalendarClient[]>([])
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
      const data = await $fetch<AppointmentResponse[]>('/api/appointments', {
        credentials: 'include',
        query: calendarQueryParams.value,
      })

      events.value = data.map((e) => ({
        id: e.id,
        title: e.sessionName || e.title,
        start: e.start,
        end: e.end,
        extendedProps: {
          clientId: e.clientId,
          sessionName: e.sessionName,
          sessionNumber: e.sessionNumber,
          clientName: e.clientName,
          description: e.description,
          status: e.status,
          videoProvider: e.videoProvider,
          videoJoinUrl: e.videoJoinUrl,
          attendanceStatus: e.attendanceStatus,
          assignedClinicianName: e.assignedClinicianName,
          seriesId: e.seriesId,
          recurrence: e.recurrence,
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
      const data = await $fetch<CalendarClient[]>('/api/clients', {
        credentials: 'include',
        query: clientOptionsQueryParams.value,
      })

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
    const calendarApi = calendarRef.value?.getApi?.()
    if (!calendarApi) return
    calendarApi.gotoDate(event.target.value)
  }

  function next() {
    const calendarApi = calendarRef.value?.getApi?.()
    if (!calendarApi) return
    calendarApi.next()
  }

  function prev() {
    const calendarApi = calendarRef.value?.getApi?.()
    if (!calendarApi) return
    calendarApi.prev()
  }

  function handleTouchStart(e: TouchEvent) {
    const touch = e.changedTouches[0]
    if (!touch) return
    touchStartX = touch.screenX
  }

  function handleTouchEnd(e: TouchEvent) {
    const touch = e.changedTouches[0]
    if (!touch) return
    touchEndX = touch.screenX
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
    const calendarApi = calendarRef.value?.getApi?.()
    if (!calendarApi) return
    calendarApi.today()
  }

  function changeView(view: string) {
    const calendar = calendarRef.value?.getApi?.()
    if (!calendar) return
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

  watch(calendarQueryParams, async () => {
    if (!currentUser.value?.id) return
    await syncCalendarData()
  })

  watch(clients, (availableClients) => {
    const allowedClientIds = new Set(availableClients.map((client) => client.id))
    clientFilter.value = clientFilter.value.filter((id) => allowedClientIds.has(id))
  })

  const isViewModalOpen = ref(false)
  const selectedEvent = ref<SelectedCalendarEvent | null>(null)
  const isEditMode = ref(false)
  const editType = ref<'ONE' | 'FUTURE' | 'ALL' | null>(null)
  const isEditTypeModalOpen = ref(false)
  const isDeleteConfirming = ref(false)
  const mobileView = ref('week')
  const currentRangeLabel = ref('')

  function formatShortDate(date: Date) {
    return date.toLocaleDateString('en-US')
  }

  function updateRangeLabel(viewType: string, start: Date) {
    if (viewType.includes('Week')) {
      currentRangeLabel.value = `Week of ${formatShortDate(start)}`
      return
    }

    if (viewType.includes('Month')) {
      currentRangeLabel.value = start.toLocaleDateString('en-US', {
        month: 'long',
        year: 'numeric',
      })
      return
    }

    currentRangeLabel.value = start.toLocaleDateString('en-US', {
      month: 'long',
      day: 'numeric',
      year: 'numeric',
    })
  }

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
    recurrence: '' as '' | 'DAILY' | 'WEEKLY' | 'MONTHLY',
    recurrenceEndDate: '',
  })
  const editRecurrenceEndDateTouched = ref(false)
  const createTimeRangeError = ref('')
  const editTimeRangeError = ref('')
  const createModalError = ref('')
  const editModalError = ref('')

  function setCreateModalError(message: string) {
    createModalError.value = message
  }

  function setEditModalError(message: string) {
    editModalError.value = message
  }

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

    datesSet(info: any) {
      const view = info.view.type
      updateRangeLabel(view, info.view.currentStart)

      if (view.includes('Day')) mobileView.value = 'day'
      if (view.includes('Week')) mobileView.value = 'week'
      if (view.includes('Month')) mobileView.value = 'month'
    },

    dayHeaderDidMount(info: any) {
      if (info.el) {
        info.el.style.cursor = 'pointer'

        info.el.onclick = () => {
          const section = info.el.closest('.fc-list-day')
          if (!section) return

          const events = section.querySelectorAll('.fc-list-event')

          events.forEach((e: Element) => {
            e.classList.toggle('hidden')
          })
        }
      }
    },

    initialView: isMobile.value ? 'listWeek' : 'dayGridMonth',

    headerToolbar: false as const,
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
      const clientColor = getClientColor(client)
      // Event color reflects the session's attendance status (#32); the small dot
      // keeps the per-client color so both signals survive.
      const rawStatus = arg.event.extendedProps.attendanceStatus as string | null
      // Appointments are seeded with a default 'show' note at creation, so a future
      // session that only carries that default hasn't actually happened yet → show it
      // blue (unrecorded). Cancellations set ahead of time still show their color.
      const start = arg.event.start as Date | null
      const isFuture = !!start && start.getTime() > Date.now()
      const attendanceStatus = isFuture && (!rawStatus || rawStatus === 'show') ? null : rawStatus
      const statusColor = getAttendanceColor(attendanceStatus)
      const titleStyle = isAttendanceStrikethrough(attendanceStatus)
        ? 'text-decoration: line-through;'
        : ''
      const clientDot = `<span style="display:inline-block;width:8px;height:8px;border-radius:9999px;background:${clientColor};margin-right:6px;vertical-align:middle;flex:none;"></span>`

      return {
        html: `
          <div class="custom-event-wrapper" style="border-left: 4px solid ${statusColor}; background: ${statusColor}15;">
            <div class="event-title" style="${titleStyle}">${clientDot}${title}</div>
            <div class="event-meta">${client} • ${time}</div>
          </div>
        `,
      }
    },
    height: 'auto',
    eventClick: onEventClick,
    dateClick: onDateClick,
  })

  function onEventClick(info: any) {
    isEditMode.value = false

    const clientName =
      info.event.extendedProps?.clientName || info.event._def?.extendedProps?.clientName

    const ext = info.event.extendedProps || info.event._def?.extendedProps || {}

    selectedEvent.value = {
      ...ext,
      clientName,
      id: info.event.id,
      clientId: ext.clientId,
      title: info.event.title,
      sessionName: ext.sessionName || info.event.title,
      sessionNumber: ext.sessionNumber ?? null,
      start: info.event.start,
      end: info.event.end,

      // merged fields
      description: ext.description,
      status: ext.status,
      seriesId: ext.seriesId ?? null,
      recurrence: ext.recurrence ?? 'NONE',

      videoProvider: ext.videoProvider ?? null,
      videoJoinUrl: ext.videoJoinUrl ?? null,
      assignedClinicianName: ext.assignedClinicianName ?? null,
    }

    isViewModalOpen.value = true
  }

  function enterEditMode() {
    const event = selectedEvent.value
    if (!event) return
    isEditMode.value = true
    editForm.description = event.description || ''
    const d = event.start
    editForm.date = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
    editForm.startTime = event.start.toTimeString().slice(0, 5)
    editForm.endTime = event.end.toTimeString().slice(0, 5)
    editForm.includeVideo = Boolean(event.videoJoinUrl || event.videoProvider)
    editForm.videoJoinUrl = event.videoJoinUrl || ''
    editForm.videoProvider = editForm.includeVideo
      ? (event.videoProvider as typeof editForm.videoProvider) || 'OTHER'
      : ''
    editForm.recurrence =
      event.recurrence && ['DAILY', 'WEEKLY', 'MONTHLY'].includes(event.recurrence)
        ? (event.recurrence as typeof editForm.recurrence)
        : ''
    editForm.recurrenceEndDate = getSeriesEndDate(event.seriesId, event.start)
    editRecurrenceEndDateTouched.value = false
    editTimeRangeError.value = ''
    editModalError.value = ''
    editType.value = null
  }

  function cancelEdit() {
    isEditMode.value = false
    editTimeRangeError.value = ''
    editModalError.value = ''
    isEditTypeModalOpen.value = false
    editType.value = null
  }

  async function submitEdit(type: 'ONE' | 'FUTURE' | 'ALL') {
    editModalError.value = ''
    const event = selectedEvent.value
    if (!event) return
    if (editForm.includeVideo && !editForm.videoJoinUrl?.trim()) {
      setEditModalError('Add a video link or uncheck Video.')
      return
    }
    if (editForm.recurrence && !editForm.recurrenceEndDate) {
      setEditModalError('Please set a recurrence end date.')
      return
    }
    if (editForm.recurrence && editForm.recurrenceEndDate < editForm.date) {
      setEditModalError('Recurrence end date must be on or after the session date.')
      return
    }
    editTimeRangeError.value = getTimeRangeError(
      editForm.date,
      editForm.startTime,
      editForm.endTime,
      {
        allowPastStart: true,
      }
    )
    if (editTimeRangeError.value) {
      toast.add({
        title: 'Invalid date/time range',
        description: editTimeRangeError.value,
        color: 'warning',
      })
      return
    }
    try {
      await $fetch(`/api/appointments/${event.id}`, {
        method: 'PUT',
        body: {
          type,
          seriesId: event.seriesId || null,
          startTime: event.start.toISOString(),
          id: event.id,
          description: editForm.description,
          date: editForm.date,
          startTimeOfDay: editForm.startTime,
          endTime: editForm.endTime,
          recurrence: editForm.recurrence || 'NONE',
          recurrenceEndDate: editForm.recurrence ? editForm.recurrenceEndDate : null,
          videoProvider: editForm.includeVideo ? editForm.videoProvider || 'OTHER' : null,
          videoJoinUrl: editForm.includeVideo ? editForm.videoJoinUrl.trim() || null : null,
        },
      })

      toast.add({
        title: 'Session updated',
        color: 'success',
      })

      isEditMode.value = false
      isViewModalOpen.value = false
      isEditTypeModalOpen.value = false
      editType.value = null

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

  async function saveEdit() {
    const event = selectedEvent.value
    if (!event) return

    if (event.seriesId) {
      isViewModalOpen.value = false
      setTimeout(() => {
        isEditTypeModalOpen.value = true
      }, 100)
      return
    }

    await submitEdit('ONE')
  }

  async function selectEditType(type: 'ONE' | 'FUTURE' | 'ALL') {
    editType.value = type
    isEditTypeModalOpen.value = false
    await submitEdit(type)
  }

  function cancelEditTypeSelection() {
    isEditTypeModalOpen.value = false
    isViewModalOpen.value = true
    isEditMode.value = true
  }

  function onDeleteClick() {
    // CLOSE the current modal first
    isViewModalOpen.value = false

    setTimeout(() => {
      if (selectedEvent.value?.seriesId) {
        isDeleteTypeModalOpen.value = true
      } else {
        deleteType.value = 'ONE'
        isDeleteConfirmOpen.value = true
      }
    }, 100) // small delay so UI updates cleanly
  }

  function selectDeleteType(type: 'ONE' | 'FUTURE' | 'ALL') {
    deleteType.value = type
    isDeleteTypeModalOpen.value = false

    setTimeout(() => {
      isDeleteConfirmOpen.value = true
    }, 100)
  }

  async function confirmDelete() {
    const event = selectedEvent.value
    if (!event) return
    try {
      await $fetch(`/api/appointments/${selectedEvent.value?.id}`, {
        method: 'DELETE',
        body: {
          type: deleteType.value || 'ONE', // fallback safety
          startTime: event.start.toISOString(),
          seriesId: event.seriesId || null,
        },
      })

      toast.add({
        title: 'Session deleted',
        color: 'success',
      })

      // reset state
      deleteType.value = null
      isDeleteConfirmOpen.value = false
      isViewModalOpen.value = false

      await loadEvents()
    } catch (error) {
      console.error(error)

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
    recurrence: '',
    recurrenceEndDate: '',
    includeVideo: false,
    videoProvider: '' as '' | 'GOOGLE_MEET' | 'ZOOM' | 'OTHER',
    videoJoinUrl: '',
  })
  const recurrenceEndDateTouched = ref(false)

  watch(
    () => form.includeVideo,
    (on) => {
      if (!on) {
        form.videoProvider = ''
        form.videoJoinUrl = ''
      } else if (!form.videoProvider) {
        form.videoProvider = 'OTHER'
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
        editForm.videoProvider = 'OTHER'
      }
    }
  )

  const clientOptions = computed(() =>
    clients.value
      .filter((c: CalendarClient) => c.status !== 'Archived')
      .map((c: CalendarClient) => ({
        label: c.name || c.email,
        value: c.id,
      }))
  )

  const searchableClientOptions = computed(() =>
    clientOptions.value.map((option) => ({
      label: option.label,
      value: option.value,
    }))
  )

  const selectedClientName = computed(() => {
    const name = selectedEvent.value?.clientName
    return name || 'Unknown Client'
  })

  function formatDateForInput(date: Date) {
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
  }

  function formatTimeForInput(date: Date) {
    return `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`
  }

  function getSeriesEndDate(seriesId: string | null | undefined, fallback: Date) {
    if (!seriesId) return formatDateForInput(fallback)
    const relatedEvents = events.value.filter(
      (calendarEvent) => calendarEvent?.extendedProps?.seriesId === seriesId
    )
    if (relatedEvents.length === 0) return formatDateForInput(fallback)
    const maxStart = relatedEvents.reduce((maxDate: Date, calendarEvent) => {
      const candidate = new Date(calendarEvent.start)
      return candidate > maxDate ? candidate : maxDate
    }, new Date(fallback))
    return formatDateForInput(maxStart)
  }

  function openCreateModal(prefill?: { date?: Date; startDate?: Date; endDate?: Date }) {
    const firstDate = prefill?.date ? new Date(prefill.date) : null
    if (firstDate) {
      firstDate.setDate(firstDate.getDate() + 7 * 26)
    }
    form.clientId = ''
    form.description = ''
    form.date = prefill?.date ? formatDateForInput(prefill.date) : ''
    form.startTime = prefill?.startDate ? formatTimeForInput(prefill.startDate) : ''
    form.endTime = prefill?.endDate ? formatTimeForInput(prefill.endDate) : ''
    form.recurrence = ''
    form.recurrenceEndDate = firstDate ? formatDateForInput(firstDate) : ''
    form.includeVideo = false
    form.videoProvider = ''
    form.videoJoinUrl = ''
    recurrenceEndDateTouched.value = false
    createTimeRangeError.value = ''
    createModalError.value = ''
    isCreateModalOpen.value = true
  }

  function closeCreateModal() {
    isCreateModalOpen.value = false
    createTimeRangeError.value = ''
    createModalError.value = ''
  }

  function onDateClick(info: any) {
    if (!isAdmin.value) return
    const start = new Date(info.date)
    const viewType = info.view?.type ?? ''
    const isMonthView = viewType.includes('Month')

    if (isMonthView) {
      openCreateModal({ date: start })
      return
    }

    const end = new Date(start)
    end.setMinutes(end.getMinutes() + 60)
    openCreateModal({ date: start, startDate: start, endDate: end })
  }

  async function createSession() {
    createModalError.value = ''
    if (form.includeVideo && !form.videoJoinUrl?.trim()) {
      setCreateModalError('Add a video link or uncheck Video.')
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
    if (form.recurrence && !form.recurrenceEndDate) {
      setCreateModalError('Please set a recurrence end date.')
      return
    }
    if (form.recurrence && form.recurrenceEndDate < form.date) {
      setCreateModalError('Recurrence end date must be on or after the session date.')
      return
    }
    try {
      await $fetch('/api/appointments', {
        method: 'POST',
        body: {
          clientId: form.clientId,
          description: form.description,
          date: form.date,
          startTime: form.startTime,
          endTime: form.endTime,
          isRecurring: !!form.recurrence,
          recurrence: form.recurrence || null,
          recurrenceEndDate: form.recurrence ? form.recurrenceEndDate : null,
          videoProvider: form.includeVideo ? form.videoProvider || 'OTHER' : undefined,
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
    () => form.date,
    (date) => {
      if (!date || recurrenceEndDateTouched.value) return
      const start = new Date(`${date}T00:00:00`)
      if (Number.isNaN(start.getTime())) return
      start.setDate(start.getDate() + 7 * 26)
      form.recurrenceEndDate = formatDateForInput(start)
    }
  )

  watch(
    () => [editForm.date, editForm.startTime, editForm.endTime] as const,
    ([date, startTime, endTime]) => {
      if (!isEditMode.value) return
      editTimeRangeError.value = getTimeRangeError(date, startTime, endTime, {
        allowPastStart: true,
      })
    }
  )

  watch(
    () => editForm.date,
    (date) => {
      if (!isEditMode.value || !editForm.recurrence || editRecurrenceEndDateTouched.value) return
      const start = new Date(`${date}T00:00:00`)
      if (Number.isNaN(start.getTime())) return
      start.setDate(start.getDate() + 7 * 26)
      editForm.recurrenceEndDate = formatDateForInput(start)
    }
  )

  watch(
    () => editForm.recurrence,
    (recurrence) => {
      if (!isEditMode.value || editRecurrenceEndDateTouched.value) return
      if (!recurrence) {
        editForm.recurrenceEndDate = ''
        return
      }
      if (!editForm.recurrenceEndDate) {
        const start = new Date(`${editForm.date}T00:00:00`)
        if (Number.isNaN(start.getTime())) return
        start.setDate(start.getDate() + 7 * 26)
        editForm.recurrenceEndDate = formatDateForInput(start)
      }
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
        <p class="ml-2 text-sm font-medium text-gray-600 dark:text-gray-300">
          {{ currentRangeLabel }}
        </p>
      </div>

      <div class="flex items-center gap-2">
        <UButton
          icon="i-heroicons-calendar-days"
          variant="outline"
          @click="datePickerRef?.showPicker?.()"
        />
        <input ref="datePickerRef" type="date" class="hidden" @change="goToDate" />

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

    <div v-if="isAdmin" class="flex justify-end">
      <div class="flex flex-wrap items-center justify-end gap-3">
        <USelect
          id="calendar-client-filter"
          v-model="clientFilter"
          :items="clientOptions"
          multiple
          placeholder="Filter by clients"
          class="w-full min-w-[18rem] sm:w-72"
        />
        <USelect
          v-if="isAdminViewer"
          id="calendar-clinician-filter"
          v-model="clinicianFilter"
          :items="clinicianFilterItems"
          multiple
          placeholder="Filter by clinicians"
          class="w-full min-w-[18rem] sm:w-72"
        />
        <UButton icon="i-heroicons-plus" label="Create Event" @click="openCreateModal" />
      </div>
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
        <div
          v-if="createModalError"
          class="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-900 dark:bg-red-900/20 dark:text-red-200"
        >
          {{ createModalError }}
        </div>
        <div>
          <label class="mb-2 block text-sm font-medium" for="client">Client</label>
          <USelectMenu
            id="client"
            v-model="form.clientId"
            value-key="value"
            :items="searchableClientOptions"
            :search-input="{ placeholder: 'Search clients...' }"
            searchable
            placeholder="Select a client"
            class="w-full"
          />
          <p v-if="clientOptions.length === 0" class="mt-1 text-xs text-gray-500">
            No clients available. Make sure clients are registered in the system.
          </p>
        </div>

        <p
          class="rounded-md border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-600 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-300"
        >
          Session name will be auto-generated as <strong>Firstname_Lastname_##</strong>.
        </p>

        <div>
          <label class="mb-2 block text-sm font-medium" for="create-description">Description</label>
          <UTextarea
            id="create-description"
            v-model="form.description"
            placeholder="Optional notes for this session"
          />
        </div>

        <div class="grid grid-cols-3 gap-4">
          <div>
            <label class="mb-2 block text-sm font-medium" for="create-date">Date</label>
            <UInput id="create-date" v-model="form.date" type="date" />
          </div>

          <div>
            <label class="mb-2 block text-sm font-medium" for="create-start-time">Start Time</label>
            <UInput id="create-start-time" v-model="form.startTime" type="time" />
          </div>

          <div>
            <label class="mb-2 block text-sm font-medium" for="create-end-time">End Time</label>
            <UInput id="create-end-time" v-model="form.endTime" type="time" />
          </div>
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
            class="space-y-2 rounded-lg border border-gray-200 bg-gray-50/90 p-4 shadow-sm dark:border-gray-700 dark:bg-gray-900/60"
          >
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
        <select v-model="form.recurrence">
          <option value="">Does not repeat</option>
          <option value="DAILY">Daily</option>
          <option value="WEEKLY">Weekly</option>
          <option value="MONTHLY">Monthly</option>
        </select>
        <div v-if="form.recurrence">
          <label class="mb-2 block text-sm font-medium" for="create-recurrence-end-date">
            Recurrence end date
          </label>
          <UInput
            id="create-recurrence-end-date"
            v-model="form.recurrenceEndDate"
            type="date"
            @input="recurrenceEndDateTouched = true"
          />
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
  <!-- DELETE TYPE MODAL -->
  <UModal v-model:open="isDeleteTypeModalOpen">
    <template #title>Delete Recurring Session</template>

    <template #content>
      <div class="flex flex-col gap-3 p-4">
        <UButton @click="selectDeleteType('ONE')">This event only</UButton>
        <UButton @click="selectDeleteType('FUTURE')">This and future events</UButton>
        <UButton @click="selectDeleteType('ALL')">All events in series</UButton>
      </div>
    </template>
  </UModal>

  <UModal v-model:open="isEditTypeModalOpen">
    <template #title>Edit Recurring Session</template>
    <template #content>
      <div class="flex flex-col gap-3 p-4">
        <UButton @click="selectEditType('ONE')">This event only</UButton>
        <UButton @click="selectEditType('FUTURE')">This and future events</UButton>
        <UButton @click="selectEditType('ALL')">All events in series</UButton>
        <UButton variant="outline" @click="cancelEditTypeSelection">Cancel</UButton>
      </div>
    </template>
  </UModal>

  <!-- DELETE CONFIRM MODAL -->
  <UModal v-model:open="isDeleteConfirmOpen" :ui="{ content: 'max-w-md', body: 'p-0' }">
    <template #title>Confirm Delete</template>

    <template #content>
      <div class="p-4">
        <p>Are you sure you want to delete this session?</p>

        <div class="mt-4 flex justify-end gap-2">
          <UButton variant="outline" @click="isDeleteConfirmOpen = false"> Cancel </UButton>

          <UButton color="error" @click="confirmDelete"> Delete </UButton>
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
          <p v-if="selectedEvent?.assignedClinicianName">
            <strong>Assigned Clinician:</strong> {{ selectedEvent.assignedClinicianName }}
          </p>
          <p>
            <strong>Session Name:</strong> {{ selectedEvent?.sessionName || selectedEvent?.title }}
          </p>
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

          <div class="mt-3">
            <p class="mb-2 text-sm font-medium text-gray-700 dark:text-gray-300">Meeting Link</p>
            <p
              v-if="selectedEvent?.videoJoinUrl"
              class="mb-2 text-sm break-all text-gray-700 dark:text-gray-300"
            >
              <a
                :href="selectedEvent.videoJoinUrl"
                target="_blank"
                rel="noopener noreferrer"
                class="text-primary-600 hover:text-primary-500 dark:text-primary-400 underline"
              >
                {{ selectedEvent.videoJoinUrl }}
              </a>
            </p>
            <p v-else class="mb-2 text-sm text-gray-500 dark:text-gray-400">Not set</p>
            <UButton
              v-if="selectedEvent?.videoJoinUrl"
              :to="selectedEvent.videoJoinUrl"
              external
              target="_blank"
              rel="noopener noreferrer"
              color="primary"
              variant="soft"
              icon="i-heroicons-video-camera-20-solid"
              :label="
                selectedEvent?.videoProvider === 'GOOGLE_MEET'
                  ? 'Join Google Meet'
                  : `Join ${selectedEvent?.videoProvider ? (VIDEO_PROVIDER_LABEL[selectedEvent.videoProvider] ?? 'meeting') : 'meeting'}`
              "
            />
          </div>
          <UButton
            v-if="selectedEvent?.clientId"
            class="mt-3"
            color="primary"
            variant="outline"
            icon="i-heroicons-document-text"
            :to="{ path: '/notes-test', query: { client: selectedEvent.clientId } }"
            label="Open Notes"
          />
        </div>

        <div v-else class="flex flex-col gap-4">
          <div
            v-if="editModalError"
            class="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-900 dark:bg-red-900/20 dark:text-red-200"
          >
            {{ editModalError }}
          </div>
          <p
            class="rounded-md border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-600 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-300"
          >
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
              class="space-y-2 rounded-lg border border-gray-200 bg-gray-50/90 p-4 shadow-sm dark:border-gray-700 dark:bg-gray-900/60"
            >
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
          <div>
            <label class="mb-2 block text-sm font-medium">Recurrence</label>
            <select v-model="editForm.recurrence" class="w-full rounded border px-2 py-2">
              <option value="">Does not repeat</option>
              <option value="DAILY">Daily</option>
              <option value="WEEKLY">Weekly</option>
              <option value="MONTHLY">Monthly</option>
            </select>
          </div>
          <div v-if="editForm.recurrence">
            <label class="mb-2 block text-sm font-medium" for="edit-recurrence-end-date">
              Recurrence end date
            </label>
            <UInput
              id="edit-recurrence-end-date"
              v-model="editForm.recurrenceEndDate"
              type="date"
              @input="editRecurrenceEndDateTouched = true"
            />
          </div>
        </div>

        <!-- Buttons (same pattern as Create modal) -->
        <div v-if="!isDeleteConfirming" class="flex justify-end gap-3 pt-2">
          <UButton
            v-if="!isEditMode && isAdmin"
            color="error"
            variant="outline"
            @click="onDeleteClick"
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

          <UButton
            v-if="isEditMode"
            color="primary"
            :disabled="!!editTimeRangeError"
            @click="saveEdit"
          >
            Save
          </UButton>
        </div>
      </div>
    </template>
  </UModal>
</template>
