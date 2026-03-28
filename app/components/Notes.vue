<script setup lang="ts">
  import NotesToolbar from '~/components/NotesToolbar.vue'
  import ChangeWithJustificationModal from '~/components/ChangeWithJustificationModal.vue'
  import type { ChangeJustificationPayload } from '~/components/ChangeWithJustificationModal.vue'
  import { useDebounceFn } from '@vueuse/core'
  import { marked } from 'marked'
  import { useWindowSize } from '@vueuse/core'

  type SessionNoteRow = { id: string; content: string; createdAt: string }

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
      initialFocusNoteId?: string | null
      backHref?: string
    }>(),
    {
      sessionNotes: () => [],
      initialFocusNoteId: null,
      backHref: '/taskPage',
    }
  )

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
      if (!q.value) return true
      const d = new Date(sn.createdAt).toLocaleDateString('en-US').toLowerCase()
      return sn.content.toLowerCase().includes(q.value) || d.includes(q.value)
    })
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
  const pendingEdits = ref<Map<number, string>>(new Map())
  const pendingMeta = ref<Map<number, { reason: string; signature: string }>>(new Map())
  const pendingSessionEdits = ref<Map<string, string>>(new Map())
  const pendingSessionMeta = ref<Map<string, { reason: string; signature: string }>>(new Map())
  const showJustificationModal = ref(false)
  const selectedForm = ref<string | null>(null)
  const sidebarTab = ref<'notes' | 'forms'>('notes')

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
    selectedNoteData.value ? marked(selectedNoteData.value.content) : ''
  )

  function startEditPrevious() {
    const sd = selectedNoteData.value
    if (!sd) return
    if (sd.source === 'editor') {
      editingNoteId.value = sd.id
      editingSessionNoteId.value = null
    } else {
      editingSessionNoteId.value = sd.id
      editingNoteId.value = null
    }
    editingDate.value = sd.date
    isEditingPreviousPanel.value = false
    showJustificationModal.value = true
  }

  function closeJustificationModal() {
    showJustificationModal.value = false
  }

  function onJustificationSubmit(payload: ChangeJustificationPayload) {
    const sd = selectedNoteData.value
    if (!sd) return

    const reason =
      (payload.reasoning && payload.reasoning.trim()) ||
      (payload.documentation
        ? 'Justification provided via uploaded documentation (PDF/Word).'
        : '')

    if (!reason || !payload.signatureData?.trim()) {
      return
    }

    const signature = payload.signatureData

    if (sd.source === 'session') {
      pendingSessionMeta.value.set(sd.id, { reason, signature })
      if (!pendingSessionEdits.value.has(sd.id)) {
        pendingSessionEdits.value.set(sd.id, sd.content)
      }
      editingSessionNoteId.value = sd.id
      editingNoteId.value = null
    } else {
      pendingMeta.value.set(sd.id, { reason, signature })
      if (!pendingEdits.value.has(sd.id)) {
        pendingEdits.value.set(sd.id, sd.content)
      }
      editingNoteId.value = sd.id
      editingSessionNoteId.value = null
    }

    isEditingPreviousPanel.value = true
    showJustificationModal.value = false
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

      isSavingPrevious.value = true
      try {
        await $fetch(`/api/clients/${props.client.id}/session-notes/${sid}`, {
          method: 'PATCH',
          body: {
            content: draft,
            reason: meta.reason,
            signature: meta.signature,
          },
        })

        const idx = localSessionNotes.value.findIndex((n) => n.id === sid)
        if (idx !== -1) {
          const row = localSessionNotes.value[idx]!
          localSessionNotes.value[idx] = {
            ...row,
            content: draft,
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

    isSavingPrevious.value = true
    try {
      await $fetch('/api/notes/edit', {
        method: 'POST',
        body: {
          noteId: editingNoteId.value,
          clientId: props.client.id,
          content: draft,
          reason: meta.reason,
          signature: meta.signature,
        },
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
  console.log('Manual save clicked')
  if (!noteContent.value.trim()) return
  showSaveModal.value = true
}

async function confirmSaveNote() {
  showSaveModal.value = false
  saveStatus.value = 'saving'

  try {
    const savedContent = noteContent.value

    const response = await $fetch('/api/notes/create', {
      method: 'POST',
      body: {
        clientId: props.client.id,
        content: savedContent
      }
    }) as { note: { id: number; createdAt: string } }

    console.log('New note created:', response)

    // Clear local draft
    localStorage.removeItem(`note_draft_${props.client.id}`)

    // Add to previous notes list (this is what moves it to sidebar)
    localPreviousNotes.value.unshift({
      id: response.note.id,
      date: new Date(response.note.createdAt).toLocaleDateString('en-US'),
      preview: savedContent.slice(0, 60) + (savedContent.length > 60 ? '...' : ''),
      content: savedContent,
    })

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
  saveStatus.value = 'saved'  // show "Saved just now" even for local
}, 1200)  // faster feedback ~1.2 seconds

watch(noteContent, () => {
  if (!isEditingPreviousPanel.value) {   // no auto-save during edit of previous
    saveStatus.value = 'saving'
    saveToLocal()
  }
})

// Load draft when component mounts
onMounted(() => {
  const draft = localStorage.getItem(`note_draft_${props.client.id}`)
  if (draft !== null) {
    noteContent.value = draft
    lastSaved.value = new Date() // pretend it was just saved
    saveStatus.value = 'saved'
  }
})

function formatTime(date: Date) {
  const now = new Date()
  const diff = Math.floor((now.getTime() - date.getTime()) / 60000)
  return diff < 1 ? 'just now' : `${diff} min ago`
}
</script>

<template>
<div class="overflow-y-auto bg-gray-50 dark:bg-gray-950">
  <div class="min-h-screen overflow-hidden border-x border-gray-200 bg-white dark:border-gray-800 dark:bg-gray-900">

    <!-- Sidebar overlay -->
    <div
      v-if="sidebarOpen"
      class="fixed inset-0 z-40 bg-black/30 md:hidden"
      @click="sidebarOpen = false"
      />
    <!-- Header -->
    <div class="flex items-center justify-between border-b border-gray-200 px-6 py-4 dark:border-gray-800">
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
      <div class="flex items-center gap-2 text-lg font-semibold text-gray-900 dark:text-white">
        <UIcon name="i-heroicons-user-circle" class="h-5 w-5 text-gray-400" />
        <span>{{ client.name }}</span>
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
    <div class="flex min-h-screen">

    <!-- Sliding sidebar -->
    <div
      v-show="sidebarOpen"
      class="fixed top-0 left-0 z-50 h-full w-64 bg-white shadow-xl dark:bg-gray-900 flex flex-col border-r border-gray-200 dark:border-gray-800 md:relative md:shadow-none md:z-auto md:h-full"
      >
      <!-- X button inside sidebar-->
      <div class="flex items-center justify-start px-4 py-4 border-b border-gray-200 dark:border-gray-800 md:hidden">
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
          :class="sidebarTab === 'notes' ? 'text-primary-500 border-primary-500 border-b-2' : 'text-gray-400 hover:text-gray-600'"
        >Notes</button>
        <button
          @click="sidebarTab = 'forms'"
          class="flex-1 py-2.5 text-xs font-semibold tracking-wider uppercase transition-colors"
          :class="sidebarTab === 'forms' ? 'text-primary-500 border-primary-500 border-b-2' : 'text-gray-400 hover:text-gray-600'"
        >Forms</button>
      </div>

      <!-- Notes Tab -->
      <template v-if="sidebarTab === 'notes'">
        <div class="border-b border-gray-100 px-3 py-2 dark:border-gray-800">
          <div class="flex items-center gap-2 rounded-lg border border-gray-200 bg-gray-50 px-3 py-1.5 dark:border-gray-700 dark:bg-gray-800">
            <UIcon name="i-heroicons-magnifying-glass" class="h-3.5 w-3.5 flex-shrink-0 text-gray-400" />
            <input
              v-model="searchQuery"
              type="text"
              placeholder="Search notes..."
              class="w-full bg-transparent text-xs text-gray-700 placeholder-gray-400 focus:outline-none dark:text-gray-300"
            />
          </div>
        </div>
        <div class="overflow-y-auto flex-1">
          <p
            v-if="localPreviousNotes.length > 0"
            class="px-4 py-2 text-[10px] font-semibold uppercase tracking-wide text-gray-400"
          >
            Editor notes
          </p>
          <template v-if="filteredNotes.length > 0">
            <div
              v-for="note in filteredNotes"
              :key="'e-' + note.id"
              @click="selectNote(note)"
              class="cursor-pointer border-b border-gray-100 px-4 py-3 transition-colors dark:border-gray-800"
              :class="selectedPreviousNote === localPreviousNotes.indexOf(note) ? 'bg-gray-100 dark:bg-gray-800' : 'hover:bg-gray-50 dark:hover:bg-gray-800/50'"
            >
              <div class="flex items-center justify-between gap-1">
                <p class="text-sm font-medium text-gray-700 dark:text-gray-300">{{ note.date }}</p>
                <span v-if="hasPendingEdit(note.id)" title="Unsaved edit">
                  <svg width="16" height="16" viewBox="0 0 16 16" fill="none" class="text-amber-500 block">
                    <circle cx="8" cy="8" r="6.5" stroke="currentColor" stroke-width="1.5" stroke-dasharray="3 2"/>
                    <circle cx="8" cy="8" r="2.5" fill="currentColor"/>
                  </svg>
                </span>
              </div>
              <p class="mt-0.5 truncate text-xs text-gray-400">{{ note.preview }}</p>
            </div>
          </template>
          <template v-if="localSessionNotes.length > 0">
            <p
              class="border-t border-gray-100 px-4 py-2 text-[10px] font-semibold uppercase tracking-wide text-gray-400 dark:border-gray-800"
            >
              Session log
            </p>
            <div
              v-for="sn in filteredSessionNotes"
              :key="'s-' + sn.id"
              @click="selectSessionNote(sn)"
              class="cursor-pointer border-b border-gray-100 px-4 py-3 transition-colors dark:border-gray-800"
              :class="selectedSessionNoteId === sn.id ? 'bg-gray-100 dark:bg-gray-800' : 'hover:bg-gray-50 dark:hover:bg-gray-800/50'"
            >
              <div class="flex items-center justify-between gap-1">
                <p class="text-sm font-medium text-gray-700 dark:text-gray-300">
                  {{ new Date(sn.createdAt).toLocaleDateString('en-US') }}
                </p>
                <span v-if="hasPendingSessionEdit(sn.id)" title="Unsaved edit">
                  <svg width="16" height="16" viewBox="0 0 16 16" fill="none" class="text-amber-500 block">
                    <circle cx="8" cy="8" r="6.5" stroke="currentColor" stroke-width="1.5" stroke-dasharray="3 2"/>
                    <circle cx="8" cy="8" r="2.5" fill="currentColor"/>
                  </svg>
                </span>
              </div>
              <p class="mt-0.5 truncate text-xs text-gray-400">
                {{ sn.content.slice(0, 60) }}{{ sn.content.length > 60 ? '...' : '' }}
              </p>
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
      <div v-if="sidebarTab === 'forms'" class="flex flex-col gap-2 p-3 overflow-y-auto flex-1">
        <div
          v-for="form in forms"
          :key="form.label"
          @click="selectedForm = selectedForm === form.label ? null : form.label"
          class="cursor-pointer rounded-xl border p-3 text-center text-sm font-medium transition-colors"
          :class="selectedForm === form.label ? 'border-primary-400 bg-primary-50 dark:bg-primary-900/20 text-primary-600' : form.status === 'complete' ? 'border-green-200 bg-green-50 text-green-700 dark:border-green-800 dark:bg-green-900/20 dark:text-green-400' : 'border-gray-200 bg-gray-50 text-gray-400 dark:border-gray-700 dark:bg-gray-800'"
        >
          {{ form.label }}
          <div class="mt-1 text-xs font-normal">{{ form.status }}</div>
        </div>
      </div>
    </div>

        <!-- Right: Note Content Area -->
        <div
          class="flex flex-1 flex-col divide-y divide-gray-200 overflow-hidden md:flex-row md:divide-x md:divide-y-0 dark:divide-gray-800 border-l border-gray-200 dark:border-gray-800">
          <div
            class="flex flex-1 flex-col divide-y divide-gray-200 overflow-hidden md:flex-row md:divide-x md:divide-y-0 dark:divide-gray-800">
          <!-- Previous Note -->
          <div v-if="selectedNoteData" class="flex flex-col p-5 min-w-0 md:flex-1">
            <div class="mb-3 flex items-center justify-between gap-2">
              <div>
                <p class="text-sm font-medium text-gray-400">{{ selectedNoteData.date }}</p>
                <p
                  v-if="selectedNoteData.source === 'session'"
                  class="text-[10px] font-semibold uppercase tracking-wide text-primary-600 dark:text-primary-400"
                >
                  Session log note
                </p>
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
          <div v-if="!isEditingPreviousPanel" class="relative flex-1 rounded-xl border border-gray-200 bg-gray-50 p-4 text-sm leading-relaxed text-gray-700 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-300">
            <div class="prose prose-sm dark:prose-invert max-w-none" v-html="renderedNoteContent" />
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
          <div v-else class="flex flex-1 flex-col gap-2 min-h-0">
            <p class="text-xs text-amber-600">Editing previous note — save to confirm changes.</p>
            <!-- Make it expand and scrollable like the current note -->
            <div class="flex-1 min-h-[400px] border border-gray-300 rounded-xl overflow-hidden bg-white dark:bg-gray-900">
              <NotesToolbar
                v-model="previousNoteContent"
                class="h-full w-full"
              />
            </div>
            <div class="flex justify-end gap-2 mt-2">
              <UButton color="primary" label="Submit changes" size="sm" @click="showSubmitModal = true" />
            </div>
          </div>
          <!-- Edit history -->
            <div v-if="selectedNoteEdits.length > 0" class="mt-4 flex flex-col gap-2">
              <p class="text-xs font-semibold text-gray-500 uppercase tracking-wider">Edit History</p>
              <div
                v-for="edit in selectedNoteEdits"
                :key="edit.editedAt"
                class="text-xs text-gray-500 dark:text-gray-400 border-t border-gray-100 dark:border-gray-800 pt-2"
              >
                <p class="font-medium text-gray-700 dark:text-gray-300">
                  Edited {{ new Date(edit.editedAt).toLocaleString('en-US') }}
                </p>
                <p>Reason: {{ edit.reason }}</p>
              </div>
            </div>
          </div>
           
          <!-- Dynamic Editor Area (handles both current and previous/edit mode) -->
          <div class="flex flex-col p-5 min-w-0 md:flex-1 md:max-h-screen overflow-y-auto">
            <div class="mb-4 flex items-center justify-between">
              <div>
                <p class="text-sm font-medium text-gray-400">{{ currentNote.date }}</p>
                <span class="text-primary-500 text-xs font-semibold uppercase">Current</span>
                  <!-- {{ isEditingPrevious ? `Editing note from ${editingDate}` : currentNote.date }} -->
                <!-- <p v-if="isEditingPrevious" class="text-xs text-amber-600"> -->
                  <!-- Changes will be saved as a new version • Reason required -->
                <!-- </p> -->
              </div>
            <!-- <span v-if="!isEditingPrevious" class="text-primary-500 text-xs font-semibold uppercase">Current</span> -->
          </div>

          <NotesToolbar
            v-model="noteContent"
            class="flex-1 border rounded-xl overflow-hidden bg-white dark:bg-gray-900"
          />

          <!-- Save button – show only when there's content or in edit mode -->
          <div class="mt-4 flex justify-end gap-2">
            <!-- Auto-save status label -->
            <div class="text-xs flex items-center gap-2 text-gray-500">
              <span v-if="saveStatus === 'saving'" class="text-amber-600">● Saving...</span>
              <span v-else-if="saveStatus === 'saved' && lastSaved" class="text-green-600">
                Saved {{ formatTime(lastSaved) }}
              </span>
              <span v-else-if="saveStatus === 'error'" class="text-red-600">Failed to save</span>
            </div>

          <UButton
            v-if="noteContent.trim() || isEditingPreviousPanel"
            color="primary"
            label="Save Note"
            size="md"
            @click="showSaveModal = true"
            class="w-auto"
          />
        </div>
      </div>
    </div>

      <!-- Form Details -->
      <div v-if="selectedForm" class="w-64 flex-shrink-0 border-l border-gray-200 px-6 py-4 dark:border-gray-800">
        <div class="mb-3 flex items-center justify-between">
          <h2 class="text-sm font-semibold text-gray-900 dark:text-white">{{ selectedForm }}</h2>
          <button @click="selectedForm = null" class="text-lg font-bold text-gray-400 hover:text-gray-600">×</button>
        </div>
        <p class="text-sm text-gray-500 dark:text-gray-400">Form details will appear here.</p>
      </div>
      </div>
    </div>


    <!-- Save Note Modal -->
<div
  v-if="showSaveModal"
  class="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4">
  <div class="w-full max-w-sm rounded-2xl bg-white p-6 shadow-xl dark:bg-gray-900">
    <h2 class="mb-2 text-lg font-semibold text-gray-900 dark:text-white">Save Note</h2>
    <p class="mb-6 text-sm text-gray-500 dark:text-gray-400">Are you sure you want to save this note?</p>
    <div class="flex justify-end gap-3">
      <button
        @click="showSaveModal = false"
        class="rounded-lg bg-gray-100 px-4 py-2 text-sm text-gray-600 hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700"
      >
        Cancel
      </button>
      <button
        @click="confirmSaveNote()"
        class="bg-primary-500 hover:bg-primary-600 rounded-lg px-4 py-2 text-sm text-white"
      >
        Save
      </button>
    </div>
  </div>
</div>

<!-- Submit Changes Modal -->
<div
  v-if="showSubmitModal"
  class="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4">
  <div class="w-full max-w-sm rounded-2xl bg-white p-6 shadow-xl dark:bg-gray-900">
    <h2 class="mb-2 text-lg font-semibold text-gray-900 dark:text-white">Submit Changes</h2>
    <p class="mb-6 text-sm text-gray-500 dark:text-gray-400">Are you sure you want to submit your changes?</p>
    <div class="flex justify-end gap-3">
      <button
        @click="showSubmitModal = false"
        class="rounded-lg bg-gray-100 px-4 py-2 text-sm text-gray-600 hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700"
      >
        Cancel
      </button>
      <button
        @click="showSubmitModal = false; submitPreviousEdit()"
        class="bg-primary-500 hover:bg-primary-600 rounded-lg px-4 py-2 text-sm text-white"
        
      >
        Submit
      </button>
    </div>
  </div>
</div>

    <ChangeWithJustificationModal
      :open="showJustificationModal"
      title="Edit note"
      description="You must justify this change before the note editor is unlocked."
      entity-type="note"
      submit-label="Continue to editor"
      @close="closeJustificationModal"
      @submit="onJustificationSubmit"
    />
  </div>
</div>
</template>
