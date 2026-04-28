<script setup lang="ts">
  import NotesToolbar from '~/components/NotesToolbar.vue'
  import AttendanceDropdown from '~/components/AttendanceDropdown.vue'
  import ChangeWithJustificationModal from '~/components/ChangeWithJustificationModal.vue'
  import type { ChangeJustificationPayload } from '~/components/ChangeWithJustificationModal.vue'
  import { useDebounceFn } from '@vueuse/core'
  import { marked } from 'marked'
  import DOMPurify from 'dompurify'
  import { useWindowSize } from '@vueuse/core'

  type NoteKind = 'PROGRESS' | 'PSYCHOTHERAPY'
  type NoteStatus = 'DRAFT' | 'CLINICIAN_SIGNED' | 'FULLY_APPROVED'

  type SessionNoteRow = {
    id: string
    content: string
    createdAt: string
    sessionName: string
    sessionNumber: number
    attendanceStatus?: string 
    appointmentId: string | null
    appointmentStartTime: string | null
    kind?: NoteKind
    status?: NoteStatus
    clinicianSignedAt?: string | null
    clinicianSignedById?: string | null
    adminSignedAt?: string | null
    adminSignedById?: string | null
    adminApprovalNote?: string | null
  }

  const { data: roleData } = await useFetch<{
    isAdmin: boolean
    isClinician: boolean
    isStaff: boolean
  }>('/api/users/me/is-admin', {
    getCachedData: (key, nuxtApp) => nuxtApp.payload.data[key] ?? nuxtApp.static.data[key],
  })
  const isAdminViewer = computed(() => roleData.value?.isAdmin === true)

  const STATUS_LABELS: Record<NoteStatus, string> = {
    DRAFT: 'Draft',
    CLINICIAN_SIGNED: 'Clinician Signed',
    FULLY_APPROVED: 'Fully Approved',
  }
  const KIND_LABELS: Record<NoteKind, string> = {
    PROGRESS: 'Progress note',
    PSYCHOTHERAPY: 'Psychotherapy note',
  }
  function statusColor(s?: NoteStatus) {
    if (s === 'FULLY_APPROVED') return 'success' as const
    if (s === 'CLINICIAN_SIGNED') return 'warning' as const
    return 'neutral' as const
  }

  type SelectedNote =
    | { source: 'editor'; id: number; date: string; content: string; preview: string }
    | { source: 'session'; id: string; date: string; content: string; preview: string }

  const props = withDefaults(
    defineProps<{
      client: { name: string; id: string }
      currentNote: {
        id: number
        date: string
        content: string
      }
      previousNotes: {
        id: number
        date: string
        preview: string
        content: string
      }[]
      forms: {
        label: string
        status: 'complete' | 'pending'
      }[]
      sessionNotes?: SessionNoteRow[]
      appointments?: {
        id: string
        sessionName: string
        sessionNumber: number
        startTime: string
        status: string
      }[]
      initialFocusNoteId?: string | null
      backHref?: string
      /** When set (e.g. admin notes editor), header shows a client switcher; notes/forms use `client.id`. */
      clientPickerOptions?: { id: string; label: string }[]
      /** Where the picker navigates: `/clients/[id]/notes-editor` vs `/notes-test?client=[id]`. */
      clientPickerMode?: 'notes-editor' | 'notes-test'
    }>(),
    {
      sessionNotes: () => [],
      initialFocusNoteId: null,
      backHref: '/taskPage',
      clientPickerOptions: () => [],
      clientPickerMode: 'notes-editor',
      appointments: () => [],
    }
  )

  const route = useRoute()
  const router = useRouter()

  const clientPickerSelectItems = computed(() => {
    const items = props.clientPickerOptions.map((c) => ({ label: c.label, value: c.id }))
    if (items.length > 0 && !items.some((i) => i.value === props.client.id)) {
      items.unshift({ label: props.client.name, value: props.client.id })
    }
    return items
  })

  const selectedClientPickerId = computed({
    get: () => props.client.id,
    set: (id: string) => {
      if (!id || id === props.client.id) return
      // Full page load so editor state / fetches always match the selected client (SPA-only
      // navigate can leave stale UI when only the query changes on the same path).
      const resolved =
        props.clientPickerMode === 'notes-test'
          ? router.resolve({
              path: '/notes-test',
              query: { ...route.query, client: id },
            })
          : router.resolve({
              path: `/clients/${id}/notes-editor`,
              query: { ...route.query },
            })
      window.location.assign(resolved.href)
    },
  })

  const sidebarOpen = ref(true)

  const showSaveModal = ref(false)
  const showSubmitModal = ref(false)

  const selectedPreviousNote = ref<number | null>(null)
  const selectedSessionNoteId = ref<string | null>(null)
  const localPreviousNotes = ref([...props.previousNotes])
  const localSessionNotes = ref<SessionNoteRow[]>([...props.sessionNotes])

  watch(
    () => props.previousNotes,
    (v) => {
      localPreviousNotes.value = [...v]
    },
    { deep: true }
  )

  watch(
    () => props.sessionNotes,
    (v) => {
      localSessionNotes.value = [...v]
    },
    { deep: true }
  )

  const selectedNoteData = computed((): SelectedNote | null => {
    if (selectedSessionNoteId.value) {
      const sn = localSessionNotes.value.find((n) => n.id === selectedSessionNoteId.value)
      if (!sn) return null
      return {
        source: 'session',
        id: sn.id,
        date: new Date(sn.createdAt).toLocaleString('en-US'),
        content: sn.content,
        preview: sn.content.slice(0, 60) + (sn.content.length > 60 ? '...' : ''),
      }
    }
    if (selectedPreviousNote.value !== null) {
      const n = localPreviousNotes.value[selectedPreviousNote.value]
      if (!n) return null
      return {
        source: 'editor',
        id: n.id,
        date: n.date,
        content: n.content,
        preview: n.preview,
      }
    }
    return null
  })

  const searchQuery = ref('')
  const q = computed(() => searchQuery.value.toLowerCase().trim())

  const filteredNotes = computed(() =>
    localPreviousNotes.value.filter(
      (note) =>
        !q.value ||
        note.date.toLowerCase().includes(q.value) ||
        note.preview.toLowerCase().includes(q.value) ||
        note.content.toLowerCase().includes(q.value)
    )
  )

  const filteredSessionNotes = computed(() =>
    localSessionNotes.value.filter((sn) => {
      if (notesKindFilter.value !== 'all' && (sn.kind ?? 'PROGRESS') !== notesKindFilter.value) {
        return false
      }
      if (!q.value) return true
      const d = new Date(sn.createdAt).toLocaleDateString('en-US').toLowerCase()
      return sn.content.toLowerCase().includes(q.value) || d.includes(q.value)
    })
  )

  /** Currently selected session note row (if any) – used for admin approval UI. */
  const selectedSessionNoteRow = computed<SessionNoteRow | null>(() =>
    selectedSessionNoteId.value
      ? localSessionNotes.value.find((n) => n.id === selectedSessionNoteId.value) ?? null
      : null
  )
  const canAdminApproveSelected = computed(
    () =>
      isAdminViewer.value &&
      selectedSessionNoteRow.value?.status === 'CLINICIAN_SIGNED'
  )

  function closeSelectedNote() {
    selectedPreviousNote.value = null
    selectedSessionNoteId.value = null
    editingNoteId.value = null
    editingSessionNoteId.value = null
    isEditingPreviousPanel.value = false
  }

  const selectedNoteEdits = ref<{ editedAt: string; reason: string }[]>([])
  const { width } = useWindowSize()

  async function selectNote(note: (typeof props.previousNotes)[0]) {
    selectedSessionNoteId.value = null
    editingSessionNoteId.value = null
    selectedPreviousNote.value = localPreviousNotes.value.indexOf(note)
    editingNoteId.value = note.id
    isEditingPreviousPanel.value = hasPendingEdit(note.id)

    selectedNoteEdits.value = []
    try {
      selectedNoteEdits.value = await $fetch(`/api/notes/${note.id}/edits`)
    } catch (err) {
      console.error('Failed to fetch edit history:', err)
    }

    if (width.value < 768) {
      sidebarOpen.value = false
    }
  }

  async function selectSessionNote(sn: SessionNoteRow) {
    if (sn.appointmentId && sn.appointmentId === selectedAppointmentId.value) {
      alert('This session is already open in the current note editor.')
      return
    }
    selectedPreviousNote.value = null
    editingNoteId.value = null
    selectedSessionNoteId.value = sn.id
    editingSessionNoteId.value = sn.id
    isEditingPreviousPanel.value = hasPendingSessionEdit(sn.id)

    selectedNoteEdits.value = []
    try {
      selectedNoteEdits.value = await $fetch(`/api/session-notes/${sn.id}/edits`)
    } catch (err) {
      console.error('Failed to fetch session note edit history:', err)
    }

    if (width.value < 768) {
      sidebarOpen.value = false
    }
  }

  const noteContent = ref(props.currentNote.content || '')
  /** Kind for the current in-progress note; progress notes are the default. */
  const currentNoteKind = ref<NoteKind>('PROGRESS')
  /** Filter for the sidebar Notes tab: 'all' | 'PROGRESS' | 'PSYCHOTHERAPY'. */
  const notesKindFilter = ref<'all' | NoteKind>('all')
  /** Admin approval modal state. */
  const showApproveModal = ref(false)
  const approvingNoteId = ref<string | null>(null)
  const approving = ref(false)
  const pendingEdits = ref<Map<number, string>>(new Map())
  const pendingMeta = ref<Map<number, { reason: string; signature: string }>>(new Map())
  const pendingSessionEdits = ref<Map<string, string>>(new Map())
  const pendingSessionMeta = ref<Map<string, { reason: string; signature: string }>>(new Map())
  const showEditJustificationModal = ref(false)
  const selectedForm = ref<string | null>(null)
  const selectedAppointmentId = ref<string>('')
  const sidebarTab = ref<'notes' | 'forms'>('notes')

  const showNewFormModal = ref(false)
  const newFormModalSelection = ref('')

  function openNewFormVersion() {
    newFormModalSelection.value = props.forms[0]?.label ?? ''
    showNewFormModal.value = true
  }

  const newFormSubmitting = ref(false)
  const historyPanelRef = ref<{ refresh: () => void } | null>(null)

  async function confirmNewFormVersion() {
    if (!newFormModalSelection.value) return
    const formKey = FORM_LABEL_TO_KEY[newFormModalSelection.value]
    if (!formKey) return

    newFormSubmitting.value = true
    try {
      await $fetch(`/api/clients/${props.client.id}/forms/${formKey}`, {
        method: 'POST',
      })
      sidebarTab.value = 'forms'
      // Force the watcher to re-fetch by briefly clearing then resetting
      const label = newFormModalSelection.value
      selectedForm.value = null
      await nextTick()
      selectedForm.value = label
      formPanelSubTab.value = 'answers'
      showNewFormModal.value = false
      await nextTick()
      historyPanelRef.value?.refresh()
    } catch (err) {
      console.error('Failed to create new form version:', err)
      alert('Could not create new submission – check console')
    } finally {
      newFormSubmitting.value = false
    }
  }

  /** Display labels from notes-editor-data `FORM_LABELS` — must stay in sync with that API. */
  const FORM_LABEL_TO_KEY: Record<string, string> = {
    Application: 'application',
    ACE: 'ace',
    'GAD-7': 'gad',
    'PHQ-9': 'phq',
    'PCL-5': 'pcl',
  }

  watch(sidebarTab, (t) => {
    if (t !== 'forms') selectedForm.value = null
  })

  const formPanelSubTab = ref<'answers' | 'history'>('answers')

  const CLINICAL_FORM_KEYS = new Set(['ace', 'gad', 'phq', 'pcl'])
  const appointmentOptions = computed(() =>
    props.appointments
      .filter((a) => {
        const normalized = String(a.status ?? '').toUpperCase()
        return normalized !== 'CANCELED' && normalized !== 'CANCELLED'
      })
      .map((a) => ({
        label: `${a.sessionName} (${new Date(a.startTime).toLocaleDateString('en-US')})`,
        value: a.id,
      }))
  )
  const appointmentsById = computed(() => {
    const map = new Map<string, { id: string; startTime: string }>()
    for (const a of props.appointments) {
      map.set(a.id, { id: a.id, startTime: a.startTime })
    }
    return map
  })
  function canEditOnOrAfterSessionDay(sessionStartIso: string | null | undefined) {
    if (!sessionStartIso) return true
    const sessionDay = new Date(sessionStartIso)
    sessionDay.setHours(0, 0, 0, 0)
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    return today >= sessionDay
  }
  function canMarkAttendanceOnOrAfterSessionStart(sessionStartIso: string | null | undefined) {
    if (!sessionStartIso) return false
    return new Date() >= new Date(sessionStartIso)
  }
  const selectedAppointment = computed(() =>
    props.appointments.find((a) => a.id === selectedAppointmentId.value) ?? null
  )

  /** Existing note row for the selected session (if one has already been created). */
  const existingSelectedSessionNote = computed(() =>
    localSessionNotes.value.find((n) => n.appointmentId === selectedAppointmentId.value) ?? null
  )
  /** Reason is only required when re-signing a clinician-signed note. */
  const requiresEditReasonForSignSubmit = computed(
    () => existingSelectedSessionNote.value?.status === 'CLINICIAN_SIGNED'
  )

  const canEditCurrentNote = computed(
    () =>
      Boolean(selectedAppointment.value) &&
      canEditOnOrAfterSessionDay(selectedAppointment.value?.startTime ?? null)
  )
  const canMarkAttendance = computed(() =>
    canMarkAttendanceOnOrAfterSessionStart(selectedAppointment.value?.startTime ?? null)
  )
  const currentNoteLockMessage = computed(() => {
    if (!selectedAppointment.value) return 'Select a session to start or edit notes.'
    if (canEditCurrentNote.value) return ''
    const when = selectedAppointment.value?.startTime
      ? new Date(selectedAppointment.value.startTime).toLocaleDateString('en-US')
      : 'the session day'
    return `Notes are locked until ${when}. You can edit on the session day or after.`
  })
  const attendanceLockMessage = computed(() => {
    if (!selectedAppointment.value) return 'Select a session to mark present or absent.'
    if (canMarkAttendance.value) return ''
    const when = selectedAppointment.value?.startTime
      ? new Date(selectedAppointment.value.startTime).toLocaleString('en-US')
      : 'the session start time'
    return `Present/absent is locked until ${when}.`
  })
  watch(
    appointmentOptions,
    (opts) => {
      if (!selectedAppointmentId.value || !opts.some((o) => o.value === selectedAppointmentId.value)) {
        selectedAppointmentId.value = opts[0]?.value ?? ''
      }
    },
    { immediate: true }
  )
  const selectedFormKey = computed(() => {
    const label = selectedForm.value
    if (!label) return null
    return FORM_LABEL_TO_KEY[label] ?? null
  })
  const showFormHistoryTab = computed(() => {
    const k = selectedFormKey.value
    return k != null && CLINICAL_FORM_KEYS.has(k)
  })

  type FormPreviewPayload = {
    formKey: string
    formName: string
    questions: { label: string; answer: string }[]
    submitted?: boolean
    submittedAt?: string
    completedAt?: string
    score?: number | null
    severity?: string | null
  }

  const formScores = ref<Record<string, number | string | null>>({})
  const formSeverities = ref<Record<string, string | null>>({})
  const formPreviewData = ref<FormPreviewPayload | null>(null)
  const formPreviewPending = ref(false)
  const formPreviewError = ref<string | null>(null)
  const isEditingForm = ref(false)
  const editableAnswers = ref<{ label: string; answer: string }[]>([])
  let formPreviewSeq = 0

  function severityColor(label: string): string {
    const severity = formSeverities.value[label]
    if (!severity) return ''
    const s = severity.toLowerCase()
    if (s.includes('minimal') || s.includes('no exposure')) return 'text-green-600 dark:text-green-400'
    if (s.includes('mild') || s.includes('low')) return 'text-yellow-500 dark:text-yellow-400'
    if (s.includes('moderate')) return 'text-orange-500 dark:text-orange-400'
    if (s.includes('moderately severe')) return 'text-orange-600 dark:text-orange-500'
    if (s.includes('severe') || s.includes('high')) return 'text-red-600 dark:text-red-400'
    return ''
  }

  watch(selectedForm, async (label) => {
    formPanelSubTab.value = 'answers'
    if (!label) {
      formPreviewData.value = null
      formPreviewError.value = null
      formPreviewPending.value = false
      return
    }
    const formKey = FORM_LABEL_TO_KEY[label]
    if (!formKey) {
      formPreviewError.value = 'Unknown form.'
      formPreviewData.value = null
      formPreviewPending.value = false
      return
    }
    const seq = ++formPreviewSeq
    formPreviewPending.value = true
    formPreviewError.value = null
    formPreviewData.value = null
    try {
      const data = await $fetch<FormPreviewPayload>(
        `/api/clients/${props.client.id}/forms/${formKey}`
      )
      if (seq !== formPreviewSeq) return
      formPreviewData.value = data
    } catch (e: unknown) {
      if (seq !== formPreviewSeq) return
      formPreviewData.value = null
      formPreviewError.value =
        (e as { data?: { statusMessage?: string } })?.data?.statusMessage ??
        (e as Error)?.message ??
        'Could not load form data.'
    } finally {
      if (seq === formPreviewSeq) formPreviewPending.value = false
    }
  })

  watch(formPreviewData, (val) => {
    isEditingForm.value = false
    editableAnswers.value = val?.questions.map(q => ({ ...q })) ?? []
    if (val && selectedForm.value) {
      if (val.score != null) {
        formScores.value[selectedForm.value] = val.score
      }
      if (val.severity != null) {
        formSeverities.value[selectedForm.value] = val.severity
      }
    }
  })

  async function saveFormEdits() {
    const key = FORM_LABEL_TO_KEY[selectedForm.value!]
    await $fetch(`/api/clients/${props.client.id}/forms/${key}`, {
      method: 'PATCH',
      body: { answers: editableAnswers.value }
    })
    if (formPreviewData.value) {
      formPreviewData.value.questions = [...editableAnswers.value]
    }
    isEditingForm.value = false
  }

  const isEditingPreviousPanel = ref(false)
  const editingNoteId = ref<number | null>(null)
  const editingSessionNoteId = ref<string | null>(null)

  const editingDate = ref<string>('')

  const previousNoteContent = computed({
    get() {
      if (!isEditingPreviousPanel.value) return ''
      if (editingSessionNoteId.value !== null) {
        const id = editingSessionNoteId.value
        return (
          pendingSessionEdits.value.get(id) ??
          localSessionNotes.value.find((n) => n.id === id)?.content ??
          ''
        )
      }
      if (editingNoteId.value !== null) {
        return pendingEdits.value.get(editingNoteId.value) ?? selectedNoteData.value?.content ?? ''
      }
      return ''
    },
    set(val: string) {
      if (editingSessionNoteId.value !== null) {
        pendingSessionEdits.value.set(editingSessionNoteId.value, val)
        return
      }
      if (editingNoteId.value !== null) {
        pendingEdits.value.set(editingNoteId.value, val)
      }
    },
  })

  function hasPendingEdit(noteId: number) {
    return pendingEdits.value.has(noteId)
  }

  function hasPendingSessionEdit(noteId: string) {
    return pendingSessionEdits.value.has(noteId)
  }

  function discardPendingEdit(noteId: number) {
    pendingEdits.value.delete(noteId)
    pendingMeta.value.delete(noteId)
    isEditingPreviousPanel.value = false
  }

  function cancelEditingPreviousPanel() {
    isEditingPreviousPanel.value = false
  }

  const renderedNoteContent = computed(() =>
    selectedNoteData.value
      ? DOMPurify.sanitize(marked.parse(selectedNoteData.value.content) as string)
      : ''
  )

  async function saveDraftNote() {
  if (!noteContent.value.trim() || !selectedAppointmentId.value) return
  saveStatus.value = 'saving'
  try {
    await $fetch(`/api/clients/${props.client.id}/notes`, {
      method: 'POST',
      body: {
        content: noteContent.value,
        appointmentId: selectedAppointmentId.value,
        kind: currentNoteKind.value,
        action: 'draft',
      },
    })
    localStorage.setItem(`note_draft_${props.client.id}`, noteContent.value)
    lastSaved.value = new Date()
    saveStatus.value = 'saved'
  } catch (err) {
    console.error('Draft save failed:', err)
    saveStatus.value = 'error'
  }
 }

  function startEditPrevious() {
    const sd = selectedNoteData.value
    if (!sd) return
    if (sd.source === 'editor') {
      editingNoteId.value = sd.id
      editingSessionNoteId.value = null
    } else {
      const sessionRow = localSessionNotes.value.find((n) => n.id === sd.id)
      const canEdit =
        canEditOnOrAfterSessionDay(sessionRow?.appointmentStartTime) ||
        canEditOnOrAfterSessionDay(
          sessionRow?.appointmentId ? appointmentsById.value.get(sessionRow.appointmentId)?.startTime : null
        )
      if (!canEdit) {
        alert('This note is locked until the session day. You can edit on or after that date.')
        return
      }
      editingSessionNoteId.value = sd.id
      editingNoteId.value = null
      const sn = localSessionNotes.value.find(n => n.id === sd.id)
      editingAttendanceStatus.value = sn?.attendanceStatus ?? 'show'
    }
    editingDate.value = sd.date
    isEditingPreviousPanel.value = false
    showEditJustificationModal.value = true
  }

  function onEditNoteJustified(payload: ChangeJustificationPayload) {
    const sd = selectedNoteData.value
    if (!sd || !payload.reasoning?.trim() || !payload.signatureData) return

    const reason = payload.reasoning.trim()
    const signatureData = payload.signatureData

    if (sd.source === 'session') {
      pendingSessionMeta.value.set(sd.id, { reason, signature: signatureData })
      if (!pendingSessionEdits.value.has(sd.id)) {
        pendingSessionEdits.value.set(sd.id, sd.content)
      }
      editingSessionNoteId.value = sd.id
      editingNoteId.value = null

      // Load current attendance status into the edit form
      const sn = localSessionNotes.value.find(n => n.id === sd.id)
      editingAttendanceStatus.value = sn?.attendanceStatus ?? ''
    } else {
      pendingMeta.value.set(sd.id, {
        reason: payload.reasoning ?? '',
        signature: payload.signatureData,
      })
      if (!pendingEdits.value.has(sd.id)) {
        pendingEdits.value.set(sd.id, sd.content)
      }
      editingNoteId.value = sd.id
      editingSessionNoteId.value = null
    }

    isEditingPreviousPanel.value = true
    showEditJustificationModal.value = false
  }

  const isSavingPrevious = ref(false)

  const didApplyInitialFocus = ref(false)

  function applyInitialFocus() {
    const id = props.initialFocusNoteId
    if (!id || didApplyInitialFocus.value) return

    const num = Number(id)
    const isNumeric = String(num) === id && !Number.isNaN(num) && num !== 0

    if (isNumeric) {
      const note = localPreviousNotes.value.find((n) => n.id === num)
      if (note) {
        void selectNote(note)
        didApplyInitialFocus.value = true
      }
      return
    }

    const sn = localSessionNotes.value.find((n) => n.id === id)
    if (sn) {
      void selectSessionNote(sn)
      didApplyInitialFocus.value = true
    }
  }

  watch(
    [() => props.initialFocusNoteId, localPreviousNotes, localSessionNotes],
    () => nextTick(() => applyInitialFocus()),
    { deep: true, immediate: true }
  )

  async function submitAndCloseModal() {
    showSubmitModal.value = false
    if (isEditingPreviousPanel.value) {
      await submitPreviousEdit()
    }
  }

  async function onSaveSessionNoteSigned(payload: ChangeJustificationPayload) {
    await confirmSaveNote(payload.signatureData, payload.reasoning)
  }

  async function submitPreviousEdit() {
    if (editingSessionNoteId.value !== null) {
      const sid = editingSessionNoteId.value
      const draft = pendingSessionEdits.value.get(sid)
      const meta = pendingSessionMeta.value.get(sid)
      if (!draft?.trim()) return
      if (!meta?.reason.trim() || !meta?.signature.trim()) {
        alert('Reason and signature are required.')
        return
      }

      const sig = meta.signature
      const patchBody =
        sig.startsWith('data:image/png;base64,')
          ? { content: draft, reason: meta.reason, signatureData: sig }
          : { content: draft, reason: meta.reason, signature: sig }

      isSavingPrevious.value = true
      try {
        await $fetch(`/api/clients/${props.client.id}/session-notes/${sid}`, {
          method: 'PATCH',
          body: {
            content: draft,
            reason: meta.reason,
            signature: meta.signature,
            attendanceStatus: editingAttendanceStatus.value,
          },
        })

        const idx = localSessionNotes.value.findIndex((n) => n.id === sid)
        if (idx !== -1) {
          const row = localSessionNotes.value[idx]!
          localSessionNotes.value[idx] = {
            ...row,
            content: draft,
            attendanceStatus: editingAttendanceStatus.value,
          }
        }

        pendingSessionEdits.value.delete(sid)
        pendingSessionMeta.value.delete(sid)
        isEditingPreviousPanel.value = false
        editingSessionNoteId.value = null

        try {
          selectedNoteEdits.value = await $fetch(`/api/session-notes/${sid}/edits`)
        } catch {
          selectedNoteEdits.value = []
        }

        previousLastSaved.value = new Date()
        previousSaveStatus.value = 'saved'
      } catch (err) {
        console.error('Save failed:', err)
        previousSaveStatus.value = 'error'
        alert('Failed to save session note – check console')
      } finally {
        isSavingPrevious.value = false
      }
      return
    }

    if (!editingNoteId.value) return

    const draft = pendingEdits.value.get(editingNoteId.value)
    const meta = pendingMeta.value.get(editingNoteId.value)

    if (!draft?.trim()) return
    if (!meta?.reason.trim() || !meta?.signature.trim()) {
      alert('Reason and signature are required.')
      return
    }

    const sig = meta.signature
    const patchBody =
      sig.startsWith('data:image/png;base64,')
        ? { content: draft, reason: meta.reason, signatureData: sig }
        : { content: draft, reason: meta.reason, signature: sig }

    isSavingPrevious.value = true
    try {
      await $fetch(`/api/clients/${props.client.id}/session-notes/${editingNoteId.value}`, {
        method: 'PATCH',
        body: patchBody,
      })

      const noteIndex = localPreviousNotes.value.findIndex((n) => n.id === editingNoteId.value)
      if (noteIndex !== -1) {
        const existing = localPreviousNotes.value[noteIndex]!
        localPreviousNotes.value[noteIndex] = {
          id: existing.id,
          date: existing.date,
          content: draft,
          preview: draft.slice(0, 60) + (draft.length > 60 ? '...' : ''),
        }
        selectedPreviousNote.value = noteIndex
      }

      pendingEdits.value.delete(editingNoteId.value)
      pendingMeta.value.delete(editingNoteId.value)
      isEditingPreviousPanel.value = false
      editingNoteId.value = null
      previousLastSaved.value = new Date()
      previousSaveStatus.value = 'saved'
    } catch (err) {
      console.error('Save failed:', err)
      previousSaveStatus.value = 'error'
      alert('Failed to save note – check console')
    } finally {
      isSavingPrevious.value = false
    }
  }

  async function saveNote() {
    if (!noteContent.value.trim()) return
    showSaveModal.value = true
  }

  const attendanceStatus = ref('')

  const selectedNoteAttendance = computed(() => {
  if (!selectedNoteData.value || selectedNoteData.value.source !== 'session') return null
  const sn = localSessionNotes.value.find(n => n.id === selectedNoteData.value?.id)
  return sn?.attendanceStatus ?? null
  })

  const editingAttendanceStatus = ref('show')

  async function confirmSaveNote(signatureData: string, editReason?: string) {
    saveStatus.value = 'saving'
    if (!selectedAppointmentId.value) {
      alert('Please select a session before saving this note.')
      saveStatus.value = 'idle'
      return
    }

    if (requiresEditReasonForSignSubmit.value && !editReason?.trim()) {
      alert('A reason is required to update an existing note for this session.')
      saveStatus.value = 'idle'
      return
    }
    if (!canMarkAttendance.value) {
      alert('You can only mark present or absent on or after the session start time.')
      saveStatus.value = 'idle'
      return
    }

    showSaveModal.value = false

    try {
      const savedContent = noteContent.value

      const response = (await $fetch(`/api/clients/${props.client.id}/notes`, {
        method: 'POST',
        body: {
          content: savedContent,
          attendanceStatus: attendanceStatus.value,
          appointmentId: selectedAppointmentId.value,
          kind: currentNoteKind.value,
          action: 'clinician-sign',
          clinicianSignatureData: signatureData,
          ...(requiresEditReasonForSignSubmit.value && editReason?.trim()
            ? { reason: editReason.trim() }
            : {}),
        },
      })) as {
        id: string
        createdAt: string
        sessionName: string
        sessionNumber: number
        appointmentId: string | null
        kind: NoteKind
        status: NoteStatus
      }

      // Clear local draft
      localStorage.removeItem(`note_draft_${props.client.id}`)

      // Upsert in sidebar list (existing blank note becomes filled).
      const existingIdx = localSessionNotes.value.findIndex((n) => n.id === response.id)
      const row: SessionNoteRow = {
        id: response.id,
        createdAt: response.createdAt,
        content: savedContent,
        attendanceStatus: attendanceStatus.value,
        sessionName: response.sessionName,
        sessionNumber: response.sessionNumber,
        appointmentId: response.appointmentId,
        appointmentStartTime: selectedAppointment.value?.startTime ?? null,
        kind: response.kind,
        status: response.status,
      }
      if (existingIdx === -1) localSessionNotes.value.unshift(row)
      else localSessionNotes.value[existingIdx] = row

      // Clear editor → fresh current note
      noteContent.value = ''

      lastSaved.value = new Date()
      saveStatus.value = 'saved'
    } catch (err) {
      console.error('Save failed:', err)
      saveStatus.value = 'error'
      alert('Failed to save note – check console')
    }

    isEditingPreviousPanel.value = false
    editingNoteId.value = null
    editingSessionNoteId.value = null
    editingDate.value = ''
  }

  function openApproveModal() {
    if (!selectedSessionNoteId.value || !canAdminApproveSelected.value) return
    approvingNoteId.value = selectedSessionNoteId.value
    showApproveModal.value = true
  }

  async function onAdminApprove(payload: { signatureData: string; reasoning?: string }) {
    if (!approvingNoteId.value) return
    approving.value = true
    try {
      const res = (await $fetch(
        `/api/clients/${props.client.id}/session-notes/${approvingNoteId.value}/approve`,
        {
          method: 'POST',
          body: {
            adminSignatureData: payload.signatureData,
            approvalNote: payload.reasoning,
          },
        }
      )) as {
        id: string
        status: NoteStatus
        adminSignedAt: string | null
      }
      const idx = localSessionNotes.value.findIndex((n) => n.id === approvingNoteId.value)
      if (idx !== -1) {
        const row = localSessionNotes.value[idx]!
        localSessionNotes.value[idx] = {
          ...row,
          status: res.status,
          adminSignedAt: res.adminSignedAt ?? null,
        }
      }
      showApproveModal.value = false
      approvingNoteId.value = null
    } catch (err) {
      console.error('Approval failed:', err)
      alert(
        (err as { data?: { statusMessage?: string } })?.data?.statusMessage ??
          'Failed to approve note – check console'
      )
    } finally {
      approving.value = false
    }
  }

  //Auto-save and status tracking
  const saveStatus = ref<'idle' | 'saving' | 'saved' | 'error'>('idle')
  const lastSaved = ref<Date | null>(null)

  //Auto-save and status tracking for previous notes
  const previousSaveStatus = ref<'idle' | 'saving' | 'saved' | 'error'>('idle')
  const previousLastSaved = ref<Date | null>(null)

  // const selectedNoteEdits = ref<{ editedAt: string; reason: string }[]>([])

  // Only localStorage autosaves
  const saveToLocal = useDebounceFn(() => {
    localStorage.setItem(`note_draft_${props.client.id}`, noteContent.value)
    lastSaved.value = new Date()
    saveStatus.value = 'saved' // show "Saved just now" even for local
  }, 1200) // faster feedback ~1.2 seconds

  watch(noteContent, () => {
    if (!isEditingPreviousPanel.value) {
      // no auto-save during edit of previous
      saveStatus.value = 'saving'
      saveToLocal()
    }
  })

  // Load draft when component mounts
  onMounted(async () => {
    const draft = localStorage.getItem(`note_draft_${props.client.id}`)
    if (draft !== null) {
      noteContent.value = draft
      lastSaved.value = new Date() // pretend it was just saved
      saveStatus.value = 'saved'
    }
    // Prefetch scores for complete forms
    for (const form of props.forms) {
      if (form.status !== 'complete') continue
      const key = FORM_LABEL_TO_KEY[form.label]
      if (!key) continue
      try {
        const data = await $fetch<FormPreviewPayload>(
          `/api/clients/${props.client.id}/forms/${key}`
        )
        if (data.score != null) {
          formScores.value[form.label] = data.score
        }
        if (data.severity != null) {
          formSeverities.value[form.label] = data.severity
        } 
      } catch {
        // silently skip
      }
    }

  })

  function formatTime(date: Date) {
    const now = new Date()
    const diff = Math.floor((now.getTime() - date.getTime()) / 60000)
    return diff < 1 ? 'just now' : `${diff} min ago`
  }
</script>

<template>
  <div class="h-[100dvh] overflow-hidden bg-gray-50 dark:bg-gray-950">
    <div
      class="flex h-full min-h-0 flex-col overflow-hidden border-x border-gray-200 bg-white dark:border-gray-800 dark:bg-gray-900"
    >
      <!-- Sidebar overlay -->
      <div
        v-if="sidebarOpen"
        class="fixed inset-0 z-40 bg-black/30 md:hidden cursor-pointer"
        @click="sidebarOpen = false"
      />
      <!-- Header -->
      <div
        class="flex items-center justify-between border-b border-gray-200 px-6 py-4 dark:border-gray-800"
      >
        <UButton
          v-if="!sidebarOpen"
          icon="i-heroicons-bars-3"
          variant="ghost"
          color="neutral"
          size="sm"
          @click="sidebarOpen = true"
        />
        <!-- X button inside sidebar -->
        <!-- <div class="flex items-center justify-start px-4 py-4 border-b border-gray-200 dark:border-gray-800"> -->
        <UButton
          v-if="sidebarOpen"
          icon="i-heroicons-x-mark"
          variant="ghost"
          color="neutral"
          size="sm"
          class="hidden md:flex"
          @click="sidebarOpen = false"
        />
        <!-- </div> -->
        <div
          class="flex min-w-0 flex-1 items-center justify-center gap-2 px-2 text-lg font-semibold text-gray-900 dark:text-white"
        >
          <UIcon name="i-heroicons-user-circle" class="h-5 w-5 shrink-0 text-gray-400" />
          <USelect
            v-if="clientPickerOptions.length > 0"
            v-model="selectedClientPickerId"
            :items="clientPickerSelectItems"
            value-key="value"
            :placeholder="client.name"
            size="md"
            class="w-full max-w-xs min-w-0"
          />
          <span v-else class="truncate">{{ client.name }}</span>
        </div>
        <UButton
          icon="i-heroicons-x-mark"
          variant="ghost"
          color="neutral"
          size="sm"
          class="hidden md:flex"
          :to="backHref"
        />
      </div>

      <!-- Main layout -->
      <div class="flex min-h-0 flex-1 overflow-hidden">
        <!-- Sliding sidebar -->
        <div
          v-show="sidebarOpen"
          class="fixed top-0 left-0 z-50 flex h-full w-64 min-h-0 flex-col border-r border-gray-200 bg-white shadow-xl md:relative md:z-auto md:h-full md:shadow-none dark:border-gray-800 dark:bg-gray-900 overflow-hidden isolate"
        >
          <!-- X button inside sidebar-->
          <div
            class="flex items-center justify-start border-b border-gray-200 px-4 py-4 md:hidden dark:border-gray-800"
          >
            <UButton
              icon="i-heroicons-x-mark"
              variant="ghost"
              color="neutral"
              size="sm"
              @click="sidebarOpen = false"
            />
          </div>

          <!-- Tabs -->
          <div class="flex border-b border-gray-200 dark:border-gray-800">
            <button
              @click="sidebarTab = 'notes'"
              class="flex-1 py-2.5 text-xs font-semibold tracking-wider uppercase transition-colors"
              :class="
                sidebarTab === 'notes'
                  ? 'text-primary-500 border-primary-500 border-b-2'
                  : 'text-gray-400 hover:text-gray-600'
              "
            >
              Notes
            </button>
            <button
              @click="sidebarTab = 'forms'"
              class="flex-1 py-2.5 text-xs font-semibold tracking-wider uppercase transition-colors"
              :class="
                sidebarTab === 'forms'
                  ? 'text-primary-500 border-primary-500 border-b-2'
                  : 'text-gray-400 hover:text-gray-600'
              "
            >
              Forms
            </button>
          </div>

          <!-- Notes Tab -->
          <template v-if="sidebarTab === 'notes'">
            <div class="space-y-2 border-b border-gray-100 px-3 py-2 dark:border-gray-800">
              <div
                class="flex items-center gap-2 rounded-lg border border-gray-200 bg-gray-50 px-3 py-1.5 dark:border-gray-700 dark:bg-gray-800"
              >
                <UIcon
                  name="i-heroicons-magnifying-glass"
                  class="h-3.5 w-3.5 flex-shrink-0 text-gray-400"
                />
                <input
                  v-model="searchQuery"
                  type="text"
                  placeholder="Search notes..."
                  class="w-full bg-transparent text-xs text-gray-700 placeholder-gray-400 focus:outline-none dark:text-gray-300"
                />
              </div>
              <div
                class="flex gap-1 rounded-lg border border-gray-200 bg-white p-0.5 text-[11px] font-medium dark:border-gray-700 dark:bg-gray-900"
              >
                <button
                  type="button"
                  class="flex-1 rounded-md px-1.5 py-1 transition-colors"
                  :class="
                    notesKindFilter === 'all'
                      ? 'bg-primary-100 text-primary-800 dark:bg-primary-900/40 dark:text-primary-200'
                      : 'text-gray-600 hover:bg-gray-50 dark:text-gray-400 dark:hover:bg-gray-800'
                  "
                  @click="notesKindFilter = 'all'"
                >
                  All
                </button>
                <button
                  type="button"
                  class="flex-1 rounded-md px-1.5 py-1 transition-colors"
                  :class="
                    notesKindFilter === 'PROGRESS'
                      ? 'bg-primary-100 text-primary-800 dark:bg-primary-900/40 dark:text-primary-200'
                      : 'text-gray-600 hover:bg-gray-50 dark:text-gray-400 dark:hover:bg-gray-800'
                  "
                  @click="notesKindFilter = 'PROGRESS'"
                >
                  Progress
                </button>
                <button
                  type="button"
                  class="flex-1 rounded-md px-1.5 py-1 transition-colors"
                  :class="
                    notesKindFilter === 'PSYCHOTHERAPY'
                      ? 'bg-primary-100 text-primary-800 dark:bg-primary-900/40 dark:text-primary-200'
                      : 'text-gray-600 hover:bg-gray-50 dark:text-gray-400 dark:hover:bg-gray-800'
                  "
                  @click="notesKindFilter = 'PSYCHOTHERAPY'"
                >
                  Psychotherapy
                </button>
              </div>
            </div>
            <div class="min-h-0 flex-1 overflow-y-auto">
              <p
                v-if="localPreviousNotes.length > 0"
                class="px-4 py-2 text-[10px] font-semibold tracking-wide text-gray-400 uppercase"
              >
                Editor notes
              </p>
              <template v-if="filteredNotes.length > 0">
                <div
                  v-for="note in filteredNotes"
                  :key="'e-' + note.id"
                  @click="selectNote(note)"
                  class="cursor-pointer border-b border-gray-100 px-4 py-3 transition-colors dark:border-gray-800"
                  :class="
                    selectedPreviousNote === localPreviousNotes.indexOf(note)
                      ? 'bg-gray-100 dark:bg-gray-800'
                      : 'hover:bg-gray-50 dark:hover:bg-gray-800/50'
                  "
                >
                  <div class="flex items-center justify-between gap-1">
                    <p class="text-sm font-medium text-gray-700 dark:text-gray-300">
                      {{ note.date }}
                    </p>
                    <span v-if="hasPendingEdit(note.id)" title="Unsaved edit">
                      <svg
                        width="16"
                        height="16"
                        viewBox="0 0 16 16"
                        fill="none"
                        class="block text-amber-500"
                      >
                        <circle
                          cx="8"
                          cy="8"
                          r="6.5"
                          stroke="currentColor"
                          stroke-width="1.5"
                          stroke-dasharray="3 2"
                        />
                        <circle cx="8" cy="8" r="2.5" fill="currentColor" />
                      </svg>
                    </span>
                  </div>
                  <p class="mt-0.5 truncate text-xs text-gray-400">{{ note.preview }}</p>
                </div>
              </template>
              <template v-if="localSessionNotes.length > 0">
                <p
                  class="border-t border-gray-100 px-4 py-2 text-[10px] font-semibold tracking-wide text-gray-400 uppercase dark:border-gray-800"
                >
                  Session log
                </p>
                <div
                  v-for="sn in filteredSessionNotes"
                  :key="'s-' + sn.id"
                  @click="selectSessionNote(sn)"
                  class="cursor-pointer border-b border-gray-100 px-4 py-3 transition-colors dark:border-gray-800"
                  :class="
                    selectedSessionNoteId === sn.id
                      ? 'bg-gray-100 dark:bg-gray-800'
                      : 'hover:bg-gray-50 dark:hover:bg-gray-800/50'
                  "
                >
                  <div class="flex items-center justify-between gap-1">
                    <p class="text-sm font-medium text-gray-700 dark:text-gray-300">
                      {{ sn.sessionName }}
                    </p>
                    <span v-if="hasPendingSessionEdit(sn.id)" title="Unsaved edit">
                      <svg
                        width="16"
                        height="16"
                        viewBox="0 0 16 16"
                        fill="none"
                        class="block text-amber-500"
                      >
                        <circle
                          cx="8"
                          cy="8"
                          r="6.5"
                          stroke="currentColor"
                          stroke-width="1.5"
                          stroke-dasharray="3 2"
                        />
                        <circle cx="8" cy="8" r="2.5" fill="currentColor" />
                      </svg>
                    </span>
                  </div>
                  <p class="mt-0.5 truncate text-xs text-gray-400">
                    {{ new Date(sn.createdAt).toLocaleDateString('en-US') }} ·
                    {{ sn.content.slice(0, 60) }}{{ sn.content.length > 60 ? '...' : '' }}
                  </p>
                  <div class="mt-1 flex flex-wrap items-center gap-1">
                    <UBadge
                      :color="statusColor(sn.status)"
                      variant="subtle"
                      size="xs"
                    >
                      {{ STATUS_LABELS[sn.status ?? 'DRAFT'] }}
                    </UBadge>
                    <UBadge
                      v-if="sn.kind === 'PSYCHOTHERAPY'"
                      color="secondary"
                      variant="subtle"
                      size="xs"
                    >
                      Psychotherapy
                    </UBadge>
                  </div>
                </div>
              </template>
              <div
                v-if="filteredNotes.length === 0 && filteredSessionNotes.length === 0"
                class="px-4 py-6 text-center text-xs text-gray-400"
              >
                No notes found
              </div>
            </div>
          </template>

          <!-- Forms Tab -->
          <div
            v-if="sidebarTab === 'forms'"
            class="flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto p-3"
          >
            <div
              v-for="form in forms"
              :key="form.label"
              @click="selectedForm = selectedForm === form.label ? null : form.label"
              class="cursor-pointer rounded-xl border p-3 text-center text-sm font-medium transition-colors"
              :class="
                selectedForm === form.label
                  ? 'border-primary-400 bg-primary-50 dark:bg-primary-900/20 text-primary-600'
                  : form.status === 'complete'
                    ? 'border-green-200 bg-green-50 text-green-700 dark:border-green-800 dark:bg-green-900/20 dark:text-green-400'
                    : 'border-gray-200 bg-gray-50 text-gray-400 dark:border-gray-700 dark:bg-gray-800'
              "
            >
              {{ form.label }}
              <div class="mt-1 text-xs font-normal">
                <template v-if="formScores[form.label] != null">
                  Score: {{ formScores[form.label] }}
                  <span v-if="formSeverities[form.label]"> · {{ formSeverities[form.label] }}</span>
                </template>
                <template v-else>{{ form.status }}</template>
              </div>
            </div>

            <button
              @click.stop="openNewFormVersion"
              class="mt-1 flex w-full items-center justify-center gap-1.5 rounded-xl border-2 border-black-200 py-2.5 text-sm text-gray-400 transition-colors hover:border-primary-400 hover:text-primary-500 dark:border-gray-700 dark:hover:border-primary-500"
            >
              <span class="text-xl font-dark leading-none">+</span>
            </button>
          </div>
        </div>

        <!-- Right: Note Content Area -->
        <div
          class="flex min-h-0 flex-1 flex-col divide-y divide-gray-200 overflow-hidden border-l border-gray-200 md:flex-row md:divide-x md:divide-y-0 dark:divide-gray-800 dark:border-gray-800 min-w-0"
        >
          <div
            class="flex min-h-0 flex-1 flex-col divide-y divide-gray-200 overflow-hidden md:flex-row md:divide-x md:divide-y-0 dark:divide-gray-800 min-w-0"
          >
            <!-- Previous Note -->
            <div
              v-if="selectedNoteData"
              class="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden p-5 md:flex-1"
            >
              <div class="mb-3 shrink-0 flex items-start justify-between gap-2">
                <div class="min-w-0 flex-1">
                  <p class="text-sm font-medium text-gray-400">{{ selectedNoteData.date }}</p>
                  <p
                    v-if="selectedNoteData.source === 'session'"
                    class="text-primary-600 dark:text-primary-400 text-[10px] font-semibold tracking-wide uppercase"
                  >
                    Session log note
                  </p>
                  <!-- Attendance badge -->
                  <span
                    v-if="selectedNoteAttendance"
                    class="mt-1 inline-block rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase"
                    :class="selectedNoteAttendance === 'show'
                      ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                      : 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'"
                  >
                    {{ selectedNoteAttendance.replace(/-/g, ' ') }}
                  </span>
                  <div
                    v-if="selectedSessionNoteRow"
                    class="mt-2 flex flex-wrap items-center gap-1.5"
                  >
                    <UBadge
                      :color="statusColor(selectedSessionNoteRow.status)"
                      variant="subtle"
                      size="sm"
                    >
                      {{ STATUS_LABELS[selectedSessionNoteRow.status ?? 'DRAFT'] }}
                    </UBadge>
                    <UBadge
                      :color="selectedSessionNoteRow.kind === 'PSYCHOTHERAPY' ? 'secondary' : 'primary'"
                      variant="subtle"
                      size="sm"
                    >
                      {{ KIND_LABELS[selectedSessionNoteRow.kind ?? 'PROGRESS'] }}
                    </UBadge>
                    <span
                      v-if="selectedSessionNoteRow.clinicianSignedAt"
                      class="text-[10px] text-gray-500 dark:text-gray-400"
                    >
                      Clinician signed {{ new Date(selectedSessionNoteRow.clinicianSignedAt).toLocaleString('en-US') }}
                    </span>
                    <span
                      v-if="selectedSessionNoteRow.adminSignedAt"
                      class="text-[10px] text-gray-500 dark:text-gray-400"
                    >
                      · Admin approved {{ new Date(selectedSessionNoteRow.adminSignedAt).toLocaleString('en-US') }}
                    </span>
                  </div>
                  <UButton
                    v-if="canAdminApproveSelected"
                    class="mt-2"
                    color="success"
                    variant="solid"
                    size="sm"
                    icon="i-heroicons-check-badge"
                    label="Approve & sign"
                    @click="openApproveModal"
                  />
                </div>
                <button
                  @click="closeSelectedNote"
                  class="text-lg leading-none font-bold text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
                  title="Close"
                >
                  −
                </button>
              </div>

              <!-- Read only -->
              <div
                v-if="!isEditingPreviousPanel"
                class="relative min-h-0 flex-1 overflow-y-auto rounded-xl border border-gray-200 bg-gray-50 p-4 text-sm leading-relaxed text-gray-700 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-300"
              >
                <div
                  class="prose prose-sm dark:prose-invert max-w-none"
                  v-html="renderedNoteContent"
                />
                <div class="absolute right-2 bottom-2">
                  <button
                    type="button"
                    @click="startEditPrevious()"
                    class="rounded-lg bg-gray-100 px-3 py-1.5 text-xs text-gray-500 transition hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-400 dark:hover:bg-gray-700"
                  >
                    Edit
                  </button>
                </div>
              </div>

              <!-- Editable with toolbar -->
              <div v-else class="flex min-h-0 flex-1 flex-col gap-2">
                <p class="shrink-0 text-xs text-amber-600">
                  Editing previous note — save to confirm changes.
                </p>

                <!-- Attendance edit -->
                  <div class="flex items-center gap-2">
                    <span class="text-xs text-gray-500">Attendance:</span>
                    <AttendanceDropdown v-model="editingAttendanceStatus" />
                  </div>

                <!-- Make it expand and scrollable like the current note -->
                <div
                  class="min-h-0 flex-1 overflow-hidden rounded-xl border border-gray-300 bg-white dark:bg-gray-900"
                >
                  <NotesToolbar 
                    v-model="previousNoteContent" 
                    class="h-full w-full min-h-0" />
                </div>
                <div class="mt-2 shrink-0 flex justify-end gap-2">
                  <UButton
                    color="primary"
                    label="Submit changes"
                    size="sm"
                    @click="showSubmitModal = true"
                  />
                </div>
              </div>
              <!-- Edit history -->
              <div
                v-if="selectedNoteEdits.length > 0"
                class="mt-4 flex shrink-0 flex-col gap-2"
              >
                <p class="text-xs font-semibold tracking-wider text-gray-500 uppercase">
                  Edit History
                </p>
                <div
                  v-for="edit in selectedNoteEdits"
                  :key="edit.editedAt"
                  class="border-t border-gray-100 pt-2 text-xs text-gray-500 dark:border-gray-800 dark:text-gray-400"
                >
                  <p class="font-medium text-gray-700 dark:text-gray-300">
                    Edited {{ new Date(edit.editedAt).toLocaleString('en-US') }}
                  </p>
                  <p>Reason: {{ edit.reason }}</p>
                </div>
              </div>
            </div>

            <!-- Dynamic Editor Area (handles both current and previous/edit mode) -->
            <div class="flex min-w-0 flex-col p-5 md:flex-1 md:min-h-0 overflow-hidden">

              <!-- Header row: date/note-type left, attendance right -->
              <div class="mb-4 shrink-0 flex items-start justify-between gap-6">
                <div class="flex-1">
                  <p class="text-sm font-medium text-gray-400">{{ currentNote.date }}</p>
                  <div class="mt-3 max-w-sm">
                    <label class="mb-1 block text-xs font-semibold tracking-wide text-gray-500 uppercase">
                      Note type
                    </label>
                    <div
                      class="flex gap-1 rounded-lg border border-gray-200 bg-white p-0.5 text-xs font-medium dark:border-gray-700 dark:bg-gray-900"
                    >
                      <button
                        type="button"
                        class="flex-1 rounded-md px-2 py-1.5 transition-colors"
                        :class="
                          currentNoteKind === 'PROGRESS'
                            ? 'bg-primary-100 text-primary-800 dark:bg-primary-900/40 dark:text-primary-200'
                            : 'text-gray-600 hover:bg-gray-50 dark:text-gray-400 dark:hover:bg-gray-800'
                        "
                        @click="currentNoteKind = 'PROGRESS'"
                      >
                        Progress note
                      </button>
                      <button
                        type="button"
                        class="flex-1 rounded-md px-2 py-1.5 transition-colors"
                        :class="
                          currentNoteKind === 'PSYCHOTHERAPY'
                            ? 'bg-primary-100 text-primary-800 dark:bg-primary-900/40 dark:text-primary-200'
                            : 'text-gray-600 hover:bg-gray-50 dark:text-gray-400 dark:hover:bg-gray-800'
                        "
                        @click="currentNoteKind = 'PSYCHOTHERAPY'"
                      >
                        Psychotherapy note
                      </button>
                    </div>
                    <p class="mt-1 text-[11px] text-gray-500 dark:text-gray-400">
                      Psychotherapy (process) notes are stored separately and are not visible to the client.
                    </p>
                  </div>
                </div> 

                <!-- Attendance Dropdown: top-right -->
                <AttendanceDropdown v-model="attendanceStatus" />
              </div> 

              <!-- Editor / Lock message -->
              <div class="min-h-0 flex-1 flex flex-col overflow-hidden min-h-[400px] md:min-h-0">
                <ClientOnly>
                  <NotesToolbar
                    v-if="canEditCurrentNote"
                    v-model="noteContent"
                    class="h-full w-full min-h-[400px] md:min-h-0 flex-1 overflow-hidden rounded-xl border bg-white dark:bg-gray-900"
                  />
                </ClientOnly>
                <div
                  v-if="!canEditCurrentNote"
                  class="flex min-h-[280px] flex-1 items-center justify-center rounded-xl border border-amber-300 bg-amber-50/70 p-4 text-sm text-amber-800 dark:border-amber-800 dark:bg-amber-950/20 dark:text-amber-300"
                >
                  {{ currentNoteLockMessage }}
                </div>
              </div>

              <!-- Save button row -->
              <div class="mt-4 shrink-0 flex justify-end gap-2">
                <div class="flex items-center gap-2 text-xs text-gray-500">
                  <span v-if="saveStatus === 'saving'" class="text-amber-600">● Saving...</span>
                  <span v-else-if="saveStatus === 'saved' && lastSaved" class="text-green-600">
                    Saved {{ formatTime(lastSaved) }}
                  </span>
                  <span v-else-if="saveStatus === 'error'" class="text-red-600">Failed to save</span>
                </div>
                <UButton
                  v-if="noteContent.trim() && !isEditingPreviousPanel"
                  color="neutral"
                  variant="soft"
                  label="Save draft"
                  size="md"
                  icon="i-heroicons-document"
                  :disabled="!selectedAppointmentId || !canEditCurrentNote"
                  @click="saveDraftNote"
                  class="w-auto"
                />
                <UButton
                  v-if="noteContent.trim() || isEditingPreviousPanel"
                  color="primary"
                  label="Submit Note"
                  size="md"
                  icon="i-heroicons-pencil-square"
                  :disabled="
                    !isEditingPreviousPanel &&
                    (!selectedAppointmentId || !canEditCurrentNote || !canMarkAttendance)
                  "
                  @click="showSaveModal = true"
                  class="w-auto"
                />
              </div> <!-- end save row -->

              <p
                v-if="!isEditingPreviousPanel && attendanceLockMessage"
                class="mt-2 shrink-0 text-xs text-amber-600"
              >
                {{ attendanceLockMessage }}
              </p>

            </div>
          </div>

          <!-- Form Details -->
          <div
            v-if="selectedForm && sidebarTab === 'forms'"
            class="flex w-full max-w-md min-h-0 min-w-0 flex-shrink-0 flex-col border-l border-gray-200 dark:border-gray-800 md:max-h-screen md:w-96"
          >
            <div
              class="flex items-center justify-between border-b border-gray-100 px-4 py-3 dark:border-gray-800"
            >
              <h2 class="text-sm font-semibold text-gray-900 dark:text-white">
                {{ selectedForm }}
              </h2>
              <button
                type="button"
                @click="selectedForm = null"
                class="text-lg leading-none font-bold text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                title="Close"
              >
                ×
              </button>
            </div>
            <div
              v-if="showFormHistoryTab"
              class="flex gap-1 border-b border-gray-100 px-3 py-2 dark:border-gray-800"
            >
              <button
                type="button"
                class="flex-1 rounded-md px-2 py-1.5 text-xs font-medium transition-colors"
                :class="
                  formPanelSubTab === 'answers'
                    ? 'bg-primary-100 text-primary-800 dark:bg-primary-900/40 dark:text-primary-200'
                    : 'text-gray-600 hover:bg-gray-50 dark:text-gray-400 dark:hover:bg-gray-800'
                "
                @click="formPanelSubTab = 'answers'"
              >
                Answers
              </button>
              <button
                type="button"
                class="flex-1 rounded-md px-2 py-1.5 text-xs font-medium transition-colors"
                :class="
                  formPanelSubTab === 'history'
                    ? 'bg-primary-100 text-primary-800 dark:bg-primary-900/40 dark:text-primary-200'
                    : 'text-gray-600 hover:bg-gray-50 dark:text-gray-400 dark:hover:bg-gray-800'
                "
                @click="formPanelSubTab = 'history'"
              >
                History
              </button>
            </div>
            <div class="min-h-0 flex-1 overflow-y-auto px-4 py-3">
              <template v-if="!showFormHistoryTab || formPanelSubTab === 'answers'">
                <div v-if="formPreviewPending" class="flex justify-center py-8">
                  <UIcon
                    name="i-heroicons-arrow-path"
                    class="h-8 w-8 animate-spin text-primary-500"
                  />
                </div>
                <UAlert
                  v-else-if="formPreviewError"
                  color="error"
                  variant="subtle"
                  icon="i-heroicons-exclamation-triangle-20-solid"
                  :title="formPreviewError"
                  description="Try again or open the client profile to view form answers."
                />
                <div v-else-if="formPreviewData" class="space-y-3">
                  <p
                    v-if="formPreviewData.submitted != null"
                    class="text-xs text-gray-500 dark:text-gray-400"
                  >
                    {{ formPreviewData.submitted ? 'Submitted' : 'Not submitted' }}
                    <span
                      v-if="formPreviewData.submittedAt || formPreviewData.completedAt"
                      class="text-gray-400"
                    >
                      ·
                      {{
                        new Date(
                          formPreviewData.completedAt ?? formPreviewData.submittedAt ?? ''
                        ).toLocaleString('en-US')
                      }}
                    </span>
                  </p>
                  <div
                    v-if="formPreviewData.score != null || formPreviewData.severity"
                    class="flex flex-wrap gap-2 text-sm"
                  >
                    <span
                      v-if="formPreviewData.score != null"
                      class="font-medium text-gray-900 dark:text-white"
                    >
                      Score: {{ formPreviewData.score }}
                    </span>
                    <span v-if="formPreviewData.severity" :class="severityColor(selectedForm!)">
                      {{ formPreviewData.severity }}
                    </span>
                  </div>
                  <div v-if="formPreviewData.questions?.length" class="space-y-2">
                    <div
                      v-for="(q, i) in editableAnswers"
                      :key="i"
                      class="rounded-lg border border-gray-200 bg-gray-50 p-3 text-sm dark:border-gray-700 dark:bg-gray-800/80"
                    >
                      <p class="text-xs font-medium text-gray-500 dark:text-gray-400">{{ q.label }}</p>
                      <input
                        v-if="isEditingForm"
                        v-model="q.answer"
                        class="mt-1 w-full rounded border border-gray-300 bg-white px-2 py-1 text-gray-900 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100"
                      />
                      <p v-else class="mt-1 whitespace-pre-wrap text-gray-900 dark:text-gray-100">
                        {{ q.answer || '—' }}
                      </p>
                    </div>
                    <div class="mt-3 flex gap-2">
                      <UButton
                        v-if="!isEditingForm"
                        label="Edit"
                        size="xs"
                        @click="isEditingForm = true"
                      />
                      <UButton
                        v-if="isEditingForm"
                        label="Save"
                        size="xs"
                        color="primary"
                        @click="saveFormEdits"
                      />
                      <UButton
                        v-if="isEditingForm"
                        label="Cancel"
                        size="xs"
                        variant="ghost"
                        @click="isEditingForm = false"
                      />
                    </div>
                  </div>
                  <p v-else class="text-sm text-gray-500 dark:text-gray-400">No answers yet.</p>
                </div>
              </template>
              <ClinicalFormHistoryPanel
                v-else-if="selectedFormKey"
                :client-id="client.id"
                :form-key="selectedFormKey"
                ref="historyPanelRef"
                class="max-h-[min(70vh,28rem)]"
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>

  <Teleport to="body">
    <ChangeWithJustificationModal
      :open="showSaveModal"
      title="Clinician sign & submit"
      :description="
        requiresEditReasonForSignSubmit
          ? 'This session already has a note. Enter why you are changing it, then sign. The admin will be notified to counter-sign.'
          : 'Your signature submits this note for admin approval. An administrator will be notified to counter-sign.'
      "
      :submit-label="requiresEditReasonForSignSubmit ? 'Sign & resubmit for approval' : 'Sign & submit for approval'"
      :loading="saveStatus === 'saving'"
      :signature-only="!requiresEditReasonForSignSubmit"
      :requires-edit-reason="requiresEditReasonForSignSubmit"
      @close="showSaveModal = false"
      @submit="onSaveSessionNoteSigned"
    />
  </Teleport>

  <!-- Admin counter-sign modal -->
  <Teleport to="body">
    <ChangeWithJustificationModal
      :open="showApproveModal"
      title="Admin approval – final sign-off"
      description="Sign below to fully approve this note. Clinician will be notified once you approve."
      submit-label="Sign & approve"
      :loading="approving"
      signature-only
      @close="showApproveModal = false"
      @submit="onAdminApprove"
    />
  </Teleport>

  <!-- Submit Changes Modal -->
  <Teleport to="body" v-if="showSubmitModal">
    <div
      class="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4"
      @click.self="showSubmitModal = false"
    >
      <div class="w-full max-w-sm rounded-2xl bg-white p-6 shadow-xl dark:bg-gray-900">
        <h2 class="mb-2 text-lg font-semibold text-gray-900 dark:text-white">Submit Changes</h2>
        <p class="mb-6 text-sm text-gray-500 dark:text-gray-400">
          Are you sure you want to submit your changes?
        </p>
        <div class="flex justify-end gap-3">
          <button
            type="button"
            @click.prevent="showSubmitModal = false"
            class="rounded-lg bg-gray-100 px-4 py-2 text-sm text-gray-600 hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700"
          >
            Cancel
          </button>
          <button
            type="button"
            @click.prevent="submitAndCloseModal"
            class="bg-primary-500 hover:bg-primary-600 rounded-lg px-4 py-2 text-sm text-white"
          >
            Submit
          </button>
        </div>
      </div>
    </div>
  </Teleport>

  <Teleport to="body">
    <ChangeWithJustificationModal
      :open="showEditJustificationModal"
      title="Edit session note"
      description="Document why you are changing this note, then sign. You can edit the text next."
      submit-label="Continue to editor"
      requires-edit-reason
      @close="showEditJustificationModal = false"
      @submit="onEditNoteJustified"
    />
  </Teleport>
  <!-- New Form Submission Modal -->
  <Teleport to="body">
    <div
      v-if="showNewFormModal"
      class="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4"
      @click.self="showNewFormModal = false"
    >
      <div class="w-full max-w-sm rounded-2xl bg-white p-6 shadow-xl dark:bg-gray-900">
        <h2 class="mb-1 text-lg font-semibold text-gray-900 dark:text-white">New Form Submission</h2>
        <p class="mb-4 text-sm text-gray-500 dark:text-gray-400">
          Select a form to start a new submission. The current submission will move to History.
        </p>

        <!-- Form options -->
        <div class="mb-5 flex flex-col gap-2">
          <button
            v-for="form in forms"
            :key="form.label"
            @click="newFormModalSelection = form.label"
            class="flex items-center justify-between rounded-xl border px-4 py-3 text-left text-sm font-medium transition-colors"
            :class="
              newFormModalSelection === form.label
                ? 'border-primary-400 bg-primary-50 text-primary-700 dark:bg-primary-900/20 dark:text-primary-300'
                : 'border-gray-200 text-gray-700 hover:border-gray-300 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-800'
            "
          >
            <span>{{ form.label }}</span>
            <span
              v-if="newFormModalSelection === form.label"
              class="text-primary-500 text-base leading-none"
            >✓</span>
          </button>
        </div>

        <!-- Actions -->
        <div class="flex gap-3">
          <button
            type="button"
            @click="showNewFormModal = false"
            class="flex-1 rounded-lg bg-gray-100 px-4 py-2 text-sm text-gray-600 hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700"
          >
            Cancel
          </button>
          <button
            type="button"
            :disabled="!newFormModalSelection || newFormSubmitting"
            @click="confirmNewFormVersion"
            class="flex-1 rounded-lg px-4 py-2 text-sm text-white transition-colors disabled:opacity-40"
            :class="newFormModalSelection ? 'bg-primary-500 hover:bg-primary-600' : 'bg-primary-300 cursor-not-allowed'"
          >
            {{ newFormSubmitting ? 'Creating...' : 'Open Form' }}
          </button>
        </div>
      </div>
    </div>
  </Teleport>
</template>
