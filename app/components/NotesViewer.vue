<script setup lang="ts">
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
const selectedNoteData = computed(() =>
  selectedPreviousNote.value !== null ? props.previousNotes[selectedPreviousNote.value] : null
)

function closeSelectedNote() {
  selectedPreviousNote.value = null
}

const noteContent = ref(props.currentNote.content)
const showEditModal = ref(false)
const editReason = ref('')
const signature = ref('')
const selectedForm = ref<string | null>(null)
</script>

<template>
  <div class="fixed inset-0 z-50 overflow-y-auto bg-gray-50 dark:bg-gray-950 flex items-start justify-center px-4">

    <!-- Main card -->
    <div
      class="rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 shadow-lg overflow-hidden transition-all duration-300 w-full max-w-sm md:max-w-3xl lg:max-w-5xl"
    >
      <!-- Header -->
      <div class="flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-gray-800">
        <div class="flex items-center gap-2 text-gray-900 dark:text-white font-semibold text-lg truncate">
          <UIcon name="i-heroicons-user-circle" class="w-5 h-5 text-gray-400 flex-shrink-0" />
          <span class="truncate">{{ client.name }}</span>
        </div>
        <UButton icon="i-heroicons-x-mark" variant="ghost" color="neutral" size="sm" to="/taskPage" />
      </div>

      <!-- Main Panel -->
      <div class="flex flex-col md:flex-row divide-y md:divide-y-0 md:divide-x divide-gray-200 dark:divide-gray-800" style="min-height: 420px">

        <!-- Left: Previous Notes List -->
        <div class="hidden md:block w-64 flex-shrink-0 overflow-y-auto">
          <div class="flex items-center gap-2 px-4 py-3 border-b border-gray-200 dark:border-gray-800 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
            <UIcon name="i-heroicons-calendar" class="w-4 h-4" />
            Previous Notes
          </div>
          <div
            v-for="(note, index) in previousNotes"
            :key="note.id"
            @click="selectedPreviousNote = index"
            class="cursor-pointer px-4 py-3 border-b border-gray-100 dark:border-gray-800 transition-colors"
            :class="
              selectedPreviousNote === index
                ? 'bg-gray-100 dark:bg-gray-800'
                : 'hover:bg-gray-50 dark:hover:bg-gray-800/50'
            "
          >
            <p class="text-sm font-medium text-gray-700 dark:text-gray-300">{{ note.date }}</p>
            <p class="text-xs text-gray-400 truncate mt-0.5">{{ note.preview }}</p>
          </div>
        </div>

        <!-- Right: Note Content Area -->
        <div class="flex-1 flex flex-col md:flex-row divide-y md:divide-y-0 md:divide-x divide-gray-200 dark:divide-gray-800 overflow-hidden">

          <!-- Previous Note -->
          <div v-if="selectedNoteData" class="flex-1 p-5 flex flex-col">
            <div class="flex items-center justify-between mb-3">
              <p class="text-sm font-medium text-gray-400">{{ selectedNoteData.date }}</p>
              <button
                @click="closeSelectedNote"
                class="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 text-lg font-bold leading-none"
                title="Close"
              >
                −
              </button>
            </div>
            <div class="relative flex-1 rounded-xl bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 p-4 text-sm text-gray-700 dark:text-gray-300 leading-relaxed">
              {{ selectedNoteData.content }}
              <div class="absolute bottom-2 right-2">
                <button
                  @click="showEditModal = true"
                  class="text-xs px-3 py-1.5 rounded-lg bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700 transition"
                >
                  Edit
                </button>
              </div>
            </div>
          </div>

          <!-- Current Note -->
          <div class="flex-1 p-5 flex flex-col">
            <div class="flex items-center justify-between mb-3">
              <p class="text-sm font-medium text-gray-400">{{ currentNote.date }}</p>
              <span class="text-xs font-semibold text-primary-500 uppercase tracking-wide">Current</span>
            </div>
            <textarea
              v-model="noteContent"
              class="flex-1 w-full rounded-xl bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 p-4 text-sm text-gray-700 dark:text-gray-300 leading-relaxed resize-none focus:outline-none focus:ring-2 focus:ring-primary-500"
              placeholder="Write your session note here..."
            ></textarea>
          </div>

        </div>
      </div>

      <!-- Client Forms -->
      <div class="px-6 py-5 border-t border-gray-200 dark:border-gray-800">
        <p class="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-3">
          Client Forms
        </p>
        <div class="grid grid-cols-2 md:grid-cols-4 gap-3">
          <div
            v-for="form in forms"
            :key="form.label"
            @click="selectedForm = selectedForm === form.label ? null : form.label"
            class="cursor-pointer rounded-xl border p-3 text-center text-sm font-medium transition-colors"
            :class="
              selectedForm === form.label
                ? 'border-primary-400 bg-primary-50 dark:bg-primary-900/20 text-primary-600'
                : form.status === 'complete'
                ? 'border-green-200 dark:border-green-800 bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-400'
                : 'border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-gray-400'
            "
          >
            {{ form.label }}
            <div class="text-xs mt-1 font-normal">{{ form.status }}</div>
          </div>
        </div>
      </div>
    </div>

    <!-- Form side panel -->
    <div
      v-if="selectedForm"
      class="ml-4 w-full max-w-sm md:max-w-md lg:max-w-lg rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 shadow-lg p-6 transition-all duration-300"
      style="max-height: 90vh"
    >
      <div class="flex items-center justify-between mb-4">
        <h2 class="text-lg font-semibold text-gray-900 dark:text-white">{{ selectedForm }}</h2>
        <button @click="selectedForm = null" class="text-gray-400 hover:text-gray-600 font-bold text-xl">×</button>
      </div>
      <p class="text-sm text-gray-500 dark:text-gray-400">Form details will appear here.</p>
    </div>

    <!-- Edit Modal -->
    <div v-if="showEditModal" class="fixed inset-0 bg-black/50 z-50 flex items-center justify-center px-4">
      <div class="bg-white dark:bg-gray-900 rounded-2xl shadow-xl w-full max-w-sm md:max-w-md p-6">
        <h2 class="text-lg font-semibold text-gray-900 dark:text-white mb-4">Edit Note</h2>

        <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
          Reason for editing
        </label>
        <textarea
          v-model="editReason"
          rows="3"
          placeholder="Describe why you are editing this note..."
          class="w-full rounded-lg border border-gray-300 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 p-3 text-sm text-gray-900 dark:text-white resize-none focus:outline-none focus:ring-2 focus:ring-primary-500 mb-4"
        ></textarea>

        <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
          Signature
        </label>
        <input
          v-model="signature"
          type="text"
          placeholder="Sign here..."
          class="w-full rounded-lg border border-gray-300 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 p-3 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary-500"
          style="font-family: 'Brush Script MT', cursive; font-size: 1.25rem;"
        />

        <div class="flex justify-end gap-3 mt-6">
          <button
            @click="showEditModal = false"
            class="px-4 py-2 text-sm rounded-lg bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700"
          >
            Cancel
          </button>
          <button
            @click="showEditModal = false"
            class="px-4 py-2 text-sm rounded-lg bg-primary-500 text-white hover:bg-primary-600"
          >
            Confirm Edit
          </button>
        </div>
      </div>
    </div>

  </div>
</template>