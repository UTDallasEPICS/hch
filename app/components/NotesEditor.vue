<script setup lang="ts">
  import NotesToolbar from '~/components/NotesToolbar.vue'
  import { useDebounceFn } from '@vueuse/core'
  import { marked } from 'marked'

  const props = defineProps<{
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
  }>()

  const selectedPreviousNote = ref<number | null>(null)
  const localPreviousNotes = ref([...props.previousNotes])
  const selectedNoteData = computed(() =>
    selectedPreviousNote.value !== null ? localPreviousNotes.value[selectedPreviousNote.value] : null
  )

  const searchQuery = ref('')
  const filteredNotes = computed(() =>
    localPreviousNotes.value.filter(
      (note) =>
        note.date.toLowerCase().includes(searchQuery.value.toLowerCase()) ||
        note.preview.toLowerCase().includes(searchQuery.value.toLowerCase()) ||
        note.content.toLowerCase().includes(searchQuery.value.toLowerCase())
    )
  )

  function closeSelectedNote() {
    selectedPreviousNote.value = null
  }

  const noteContent = ref(props.currentNote.content || '')
  const showEditModal = ref(false)
  const editReason = ref('')
  const signature = ref('')
  const selectedForm = ref<string | null>(null)
  const sidebarTab = ref<'notes' | 'forms'>('notes')

  const editor = ref<InstanceType<typeof NotesToolbar> | null>(null)
  const isEditingPrevious = ref(false)
  const editingNoteId = ref<number | null>(null)
  const editingDate = ref<string>('')

  const renderedNoteContent = computed(() =>
  selectedNoteData.value ? marked(selectedNoteData.value.content) : ''
  ) 
    
  // Function to start editing a previous note
  function startEditPrevious(note: typeof props.previousNotes[0]) {
    selectedPreviousNote.value = localPreviousNotes.value.indexOf(note)
    editReason.value = ''
    signature.value = ''
    showEditModal.value = true
    editingNoteId.value = note.id
    editingDate.value = note.date
  }

  function confirmEdit() {
    if (!editingNoteId.value) return

    if (!editReason.value.trim() || !signature.value.trim()) {
      alert('Please provide reason and signature')
      return
    }

    // Load the previous note content into editor
    const noteToEdit = props.previousNotes.find(n => n.id === editingNoteId.value)
    if (noteToEdit) {
      noteContent.value = noteToEdit.content
      isEditingPrevious.value = true
    }

    showEditModal.value = false

    console.log('Edit confirmed:', { 
      noteId: editingNoteId.value, 
      reason: editReason.value, 
      signature: signature.value })
  }

  async function saveNote() {
  console.log('Manual save clicked')

  try {
    if (isEditingPrevious.value && editingNoteId.value) {
      //Editing previous note 
      await $fetch('/api/notes/edit', {
        method: 'POST',
        body: {
          noteId: editingNoteId.value,
          clientId: props.client.id,
          content: noteContent.value,
          reason: editReason.value || '',
          signature: signature.value || ''
        }
      })
      console.log('Previous note edited and history saved')
      
      // Update local notes so UI reflects the change immediately
      const noteIndex = localPreviousNotes.value.findIndex(n => n.id === editingNoteId.value)
      if (noteIndex !== -1) {
        const existing = localPreviousNotes.value[noteIndex]!
        localPreviousNotes.value[noteIndex] = {  
          id: existing.id,
          date: existing.date,
          content: noteContent.value,
          preview: noteContent.value.slice(0, 60) + '...'
      }
      selectedPreviousNote.value = noteIndex
    }
    noteContent.value = '' // clear editor
    } else {
      //New current note 
      await $fetch('/api/notes/create', {
        method: 'POST',
        body: {
          clientId: props.client.id,
          content: noteContent.value
        }
      })
      console.log('New note created')
      noteContent.value = '' //clear editor after save
    }

    // Success feedback
    lastSaved.value = new Date()
    saveStatus.value = 'saved'

  } catch (err) {
    console.error('Save failed:', err)
    saveStatus.value = 'error'
    alert('Failed to save note – check console')
  }

  isEditingPrevious.value = false
  editingNoteId.value = null
  editingDate.value = ''
  editReason.value = ''
  signature.value = ''
}

//Auto-save and status tracking
const saveStatus = ref<'idle' | 'saving' | 'saved' | 'error'>('idle')
const lastSaved = ref<Date | null>(null)

// Debounced auto-save (only for current note, not during edit mode)
const autoSave = useDebounceFn(async () => {
  if (isEditingPrevious.value || !noteContent.value.trim()) return

  saveStatus.value = 'saving'
  try {
    await $fetch('/api/notes/create', {
      method: 'POST',
      body: {
        clientId: props.client.id,
        content: noteContent.value
      }
    })
    lastSaved.value = new Date()
    saveStatus.value = 'saved'
  } catch (err) {
    console.error('Auto-save failed:', err)
    saveStatus.value = 'error'
  }
}, 2500) // saves 2.5 seconds after you stop typing

// Auto-save watcher
watch(noteContent, () => {
  if (!isEditingPrevious.value) {
    saveStatus.value = 'saving'
    autoSave()
  }
})

function formatTime(date: Date) {
  const now = new Date()
  const diff = Math.floor((now.getTime() - date.getTime()) / 60000)
  return diff < 1 ? 'just now' : `${diff} min ago`
}
</script>

<template>
  <div class="fixed inset-0 z-50 overflow-y-auto bg-gray-50 dark:bg-gray-950">
    <!-- Main card -->
    <div
      class="min-h-screen overflow-hidden border-x border-gray-200 bg-white dark:border-gray-800 dark:bg-gray-900"
    >
      <!-- Header -->
      <div
        class="flex items-center justify-between border-b border-gray-200 px-6 py-4 dark:border-gray-800"
      >
        <div
          class="flex items-center gap-2 truncate text-lg font-semibold text-gray-900 dark:text-white"
        >
          <UIcon name="i-heroicons-user-circle" class="h-5 w-5 flex-shrink-0 text-gray-400" />
          <span class="truncate">{{ client.name }}</span>
        </div>
        <UButton
          icon="i-heroicons-x-mark"
          variant="ghost"
          color="neutral"
          size="sm"
          to="/taskPage"
        />
      </div>

      <!-- Main Panel -->
      <div
        class="flex flex-col divide-y divide-gray-200 md:flex-row md:divide-x md:divide-y-0 dark:divide-gray-800"
        style="min-height: 600px"
      >
        <!-- Left: Sidebar -->
        <div class="hidden w-64 flex-shrink-0 overflow-y-auto md:block">
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
            <!-- Search -->
            <div class="border-b border-gray-100 px-3 py-2 dark:border-gray-800">
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
            </div>
            <!-- Notes List -->
            <template v-if="filteredNotes.length > 0">
              <div
                v-for="note in filteredNotes"
                :key="note.id"
                @click="selectedPreviousNote = localPreviousNotes.indexOf(note)"
                class="cursor-pointer border-b border-gray-100 px-4 py-3 transition-colors dark:border-gray-800"
                :class="
                  selectedPreviousNote === localPreviousNotes.indexOf(note)
                    ? 'bg-gray-100 dark:bg-gray-800'
                    : 'hover:bg-gray-50 dark:hover:bg-gray-800/50'
                "
              >
                <p class="text-sm font-medium text-gray-700 dark:text-gray-300">{{ note.date }}</p>
                <p class="mt-0.5 truncate text-xs text-gray-400">{{ note.preview }}</p>
              </div>
            </template>
            <div v-else class="px-4 py-6 text-center text-xs text-gray-400">No notes found</div>
          </template>

          <!-- Forms Tab -->
          <div v-if="sidebarTab === 'forms'" class="flex flex-col gap-2 p-3">
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
              <div class="mt-1 text-xs font-normal">{{ form.status }}</div>
            </div>
          </div>
        </div>

        <!-- Right: Note Content Area -->
        <div
          class="flex flex-1 flex-col divide-y divide-gray-200 overflow-hidden md:flex-row md:divide-x md:divide-y-0 dark:divide-gray-800"
        >
          <!-- Previous Note -->
          <div v-if="selectedNoteData" class="flex flex-1 flex-col p-5">
            <div class="mb-3 flex items-center justify-between">
              <p class="text-sm font-medium text-gray-400">{{ selectedNoteData.date }}</p>
              <button
                @click="closeSelectedNote"
                class="text-lg leading-none font-bold text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
                title="Close"
              >
                −
              </button>
            </div>
            <div
              class="relative flex-1 rounded-xl border border-gray-200 bg-gray-50 p-4 text-sm leading-relaxed text-gray-700 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-300"
            >
              <div class="prose prose-sm dark:prose-invert max-w-none" v-html="renderedNoteContent" />
              <div class="absolute right-2 bottom-2">
                <button
                  @click="startEditPrevious(selectedNoteData)"
                  class="rounded-lg bg-gray-100 px-3 py-1.5 text-xs text-gray-500 transition hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-400 dark:hover:bg-gray-700"
                >
                  Edit
                </button>
              </div>
            </div>
          </div>
           
          <!-- Dynamic Editor Area (handles both current and previous/edit mode) -->
          <div class="flex flex-1 flex-col p-5">
            <div class="mb-4 flex items-center justify-between">
              <div>
                <p class="text-sm font-medium text-gray-400">
                  {{ isEditingPrevious ? `Editing note from ${editingDate}` : currentNote.date }}
                </p>
                <p v-if="isEditingPrevious" class="text-xs text-amber-600">
                  Changes will be saved as a new version • Reason required
                </p>
              </div>
            <span v-if="!isEditingPrevious" class="text-primary-500 text-xs font-semibold uppercase">Current</span>
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
            v-if="noteContent.trim() || isEditingPrevious"
            color="primary"
            label="Save Note"
            size="md"
            @click="saveNote"
            class="w-full md:w-auto"
          />
        </div>
      </div>
    </div>

      <!-- Form Details -->
      <div v-if="selectedForm" class="border-t border-gray-200 px-6 py-4 dark:border-gray-800">
        <div class="mb-3 flex items-center justify-between">
          <h2 class="text-sm font-semibold text-gray-900 dark:text-white">{{ selectedForm }}</h2>
          <button
            @click="selectedForm = null"
            class="text-lg font-bold text-gray-400 hover:text-gray-600"
          >
            ×
          </button>
        </div>
        <p class="text-sm text-gray-500 dark:text-gray-400">Form details will appear here.</p>
      </div>

    <!-- Edit Modal -->
    <div
      v-if="showEditModal"
      class="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4"
    >
      <div class="w-full max-w-sm rounded-2xl bg-white p-6 shadow-xl md:max-w-md dark:bg-gray-900">
        <h2 class="mb-4 text-lg font-semibold text-gray-900 dark:text-white">Edit Note</h2>

        <label class="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">
          Reason for editing
        </label>
        <textarea
          v-model="editReason"
          rows="3"
          placeholder="Describe why you are editing this note..."
          class="focus:ring-primary-500 mb-4 w-full resize-none rounded-lg border border-gray-300 bg-gray-50 p-3 text-sm text-gray-900 focus:ring-2 focus:outline-none dark:border-gray-700 dark:bg-gray-800 dark:text-white"
        ></textarea>

        <label class="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">
          Signature
        </label>
        <input
          v-model="signature"
          type="text"
          placeholder="Sign here..."
          class="focus:ring-primary-500 w-full rounded-lg border border-gray-300 bg-gray-50 p-3 text-gray-900 focus:ring-2 focus:outline-none dark:border-gray-700 dark:bg-gray-800 dark:text-white"
          style="font-family: 'Brush Script MT', cursive; font-size: 1.25rem"
        />

        <div class="mt-6 flex justify-end gap-3">
          <button
            @click="showEditModal = false"
            class="rounded-lg bg-gray-100 px-4 py-2 text-sm text-gray-600 hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700"
          >
            Cancel
          </button>
          <button
            @click="confirmEdit"
            class="bg-primary-500 hover:bg-primary-600 rounded-lg px-4 py-2 text-sm text-white"
          >
            Confirm Edit
          </button>
          </div>
        </div>
      </div>
    </div>
  </div>
  </div>
</template>
