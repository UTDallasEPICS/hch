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
</script>

<template>
  <div
    class="mx-auto max-w-5xl rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 shadow-lg overflow-hidden"
  >
    <!-- Header -->
    <div
      class="flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-gray-800"
    >
      <div class="flex items-center gap-2 text-gray-900 dark:text-white font-semibold text-lg">
        <UIcon name="i-heroicons-user-circle" class="w-5 h-5 text-gray-400" />
        {{ client.name }}
      </div>
      <UButton icon="i-heroicons-x-mark" variant="ghost" color="gray" size="sm" to="/taskPage" />
    </div>

    <!-- Main Panel -->
    <div class="flex divide-x divide-gray-200 dark:divide-gray-800" style="min-height: 420px">
      <!-- Left: Previous Notes List -->
      <div class="w-64 flex-shrink-0 overflow-y-auto">
        <div
          class="flex items-center gap-2 px-4 py-3 border-b border-gray-200 dark:border-gray-800 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider"
        >
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
      <div class="flex-1 flex divide-x divide-gray-200 dark:divide-gray-800 overflow-hidden">

        <!-- Previous Note (shown when selected, 50%) -->
        <div v-if="selectedNoteData" class="flex-1 p-5 overflow-y-auto">
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
          <div
            class="rounded-xl bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 p-4 text-sm text-gray-700 dark:text-gray-300 leading-relaxed min-h-40"
          >
            {{ selectedNoteData.content }}
          </div>
        </div>

        <!-- Current Note (always shown, shrinks to 50% when previous is open) -->
        <div class="flex-1 p-5 overflow-y-auto">
          <div class="flex items-center justify-between mb-3">
            <p class="text-sm font-medium text-gray-400">{{ currentNote.date }}</p>
            <span class="text-xs font-semibold text-primary-500 uppercase tracking-wide">Current</span>
          </div>
          <div
            class="rounded-xl bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 p-4 text-sm text-gray-700 dark:text-gray-300 leading-relaxed min-h-40"
          >
            {{ currentNote.content }}
          </div>
        </div>

      </div>
    </div>

    <!-- Client Forms -->
    <div class="px-6 py-5 border-t border-gray-200 dark:border-gray-800">
      <p
        class="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-3"
      >
        Client Forms
      </p>
      <div class="grid grid-cols-4 gap-3">
        <div
          v-for="form in forms"
          :key="form.label"
          class="rounded-xl border p-3 text-center text-sm font-medium transition-colors"
          :class="
            form.status === 'complete'
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
</template>