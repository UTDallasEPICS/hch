<script setup lang="ts">
  const { data: existingQuestions, refresh: refreshQuestions } = await useFetch('/api/questions')

  const formTitle = ref('')
  const formDescription = ref('')
  const formSlug = ref('')
  const selectedQuestionIds = ref<string[]>([])
  const newQuestionText = ref('')
  const newQuestionType = ref('radio')
  const addingQuestion = ref(false)
  const creating = ref(false)
  const createError = ref<string | null>(null)

  // Options for radio/checkbox types (array of strings)
  const newQuestionOptions = ref<string[]>([''])
  // "Other" option flag for radio/checkbox with Other
  const newQuestionHasOther = ref(false)
  // Grid types: rows and columns
  const newQuestionGridRows = ref<string[]>([''])
  const newQuestionGridCols = ref<string[]>([''])

  // Form attachments (PDF files)
  const formAttachments = ref<File[]>([])
  const attachmentInputRef = ref<HTMLInputElement | null>(null)

  const slugFromTitle = computed(() =>
    formTitle.value
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, '')
      .trim()
      .replace(/\s+/g, '-')
      .slice(0, 40)
  )

  const QUESTION_TYPES = [
    { value: 'radio', label: 'Radio (Single Choice)' },
    { value: 'radio_other', label: 'Radio with "Other" option' },
    { value: 'checkbox', label: 'Checkbox (Multiple Choice)' },
    { value: 'checkbox_other', label: 'Checkbox with "Other" option' },
    { value: 'short_answer', label: 'Short Answer' },
    { value: 'long_paragraph', label: 'Long Paragraph' },
    { value: 'multiple_choice_grid', label: 'Multiple Choice Grid' },
    { value: 'checkbox_grid', label: 'Checkbox Grid' },
  ] as const

  const needsOptions = computed(
    () =>
      newQuestionType.value === 'radio' ||
      newQuestionType.value === 'radio_other' ||
      newQuestionType.value === 'checkbox' ||
      newQuestionType.value === 'checkbox_other'
  )

  const needsGrid = computed(
    () =>
      newQuestionType.value === 'multiple_choice_grid' ||
      newQuestionType.value === 'checkbox_grid'
  )

  watch(formTitle, (t) => {
    if (!formSlug.value || formSlug.value === slugFromTitle.value)
      formSlug.value = slugFromTitle.value
  })

  watch(newQuestionType, (type) => {
    if (
      type === 'radio' ||
      type === 'radio_other' ||
      type === 'checkbox' ||
      type === 'checkbox_other'
    ) {
      newQuestionHasOther.value = type === 'radio_other' || type === 'checkbox_other'
      if (newQuestionOptions.value.length === 0 || newQuestionOptions.value.every((o) => !o.trim()))
        newQuestionOptions.value = ['']
    } else if (type === 'multiple_choice_grid' || type === 'checkbox_grid') {
      if (newQuestionGridRows.value.length === 0) newQuestionGridRows.value = ['']
      if (newQuestionGridCols.value.length === 0) newQuestionGridCols.value = ['']
    }
  })

  function addOption() {
    newQuestionOptions.value = [...newQuestionOptions.value, '']
  }

  function removeOption(index: number) {
    if (newQuestionOptions.value.length <= 1) return
    newQuestionOptions.value = newQuestionOptions.value.filter((_, i) => i !== index)
  }

  function updateOption(index: number, val: string) {
    const arr = [...newQuestionOptions.value]
    arr[index] = val
    newQuestionOptions.value = arr
  }

  function addGridRow() {
    newQuestionGridRows.value = [...newQuestionGridRows.value, '']
  }

  function removeGridRow(index: number) {
    if (newQuestionGridRows.value.length <= 1) return
    newQuestionGridRows.value = newQuestionGridRows.value.filter((_, i) => i !== index)
  }

  function updateGridRow(index: number, val: string) {
    const arr = [...newQuestionGridRows.value]
    arr[index] = val
    newQuestionGridRows.value = arr
  }

  function addGridCol() {
    newQuestionGridCols.value = [...newQuestionGridCols.value, '']
  }

  function removeGridCol(index: number) {
    if (newQuestionGridCols.value.length <= 1) return
    newQuestionGridCols.value = newQuestionGridCols.value.filter((_, i) => i !== index)
  }

  function updateGridCol(index: number, val: string) {
    const arr = [...newQuestionGridCols.value]
    arr[index] = val
    newQuestionGridCols.value = arr
  }

  function onAttachmentChange(e: Event) {
    const input = e.target as HTMLInputElement
    if (input.files) {
      const pdfs = Array.from(input.files).filter((f) => f.type === 'application/pdf')
      formAttachments.value = [...formAttachments.value, ...pdfs]
    }
    input.value = ''
  }

  function clearAttachment(index: number) {
    formAttachments.value = formAttachments.value.filter((_, i) => i !== index)
  }

  function clearAllAttachments() {
    formAttachments.value = []
  }

  async function addNewQuestion() {
    if (!newQuestionText.value.trim()) return
    const options = newQuestionOptions.value.filter((o) => o.trim())
    const rows = newQuestionGridRows.value.filter((r) => r.trim())
    const cols = newQuestionGridCols.value.filter((c) => c.trim())

    const hasOther =
      newQuestionType.value === 'radio_other' || newQuestionType.value === 'checkbox_other'

    addingQuestion.value = true
    try {
      const body: Record<string, unknown> = {
        text: newQuestionText.value.trim(),
        type: newQuestionType.value,
      }
      if (hasOther) body.hasOther = true
      if (options.length) body.options = options
      if (rows.length) body.gridRows = rows
      if (cols.length) body.gridCols = cols

      const q = await $fetch<{ id: string }>('/api/questions/add', {
        method: 'POST',
        body,
      })
      await refreshQuestions()
      if (!selectedQuestionIds.value.includes(q.id))
        selectedQuestionIds.value = [...selectedQuestionIds.value, q.id]
      newQuestionText.value = ''
      newQuestionOptions.value = ['']
      newQuestionHasOther.value = false
      newQuestionGridRows.value = ['']
      newQuestionGridCols.value = ['']
    } finally {
      addingQuestion.value = false
    }
  }

  function toggleQuestion(id: string) {
    const i = selectedQuestionIds.value.indexOf(id)
    if (i === -1) selectedQuestionIds.value = [...selectedQuestionIds.value, id]
    else selectedQuestionIds.value = selectedQuestionIds.value.filter((x) => x !== id)
  }

  function moveQuestion(id: string, dir: number) {
    const idx = selectedQuestionIds.value.indexOf(id)
    if (idx === -1) return
    const next = idx + dir
    if (next < 0 || next >= selectedQuestionIds.value.length) return
    const arr = [...selectedQuestionIds.value]
    ;[arr[idx], arr[next]] = [arr[next], arr[idx]]
    selectedQuestionIds.value = arr
  }

  const orderedSelected = computed(() => {
    const list = existingQuestions.value ?? []
    return selectedQuestionIds.value.map((id) => list.find((q) => q.id === id)).filter(Boolean) as {
      id: string
      text: string
      type: string
      alias: string
    }[]
  })

  async function createFormAndAssign() {
    createError.value = null
    if (!formTitle.value.trim() || !formSlug.value.trim()) {
      createError.value = 'Title and slug are required.'
      return
    }
    creating.value = true
    try {
      const forms = await $fetch<{ id: string; slug: string }[]>('/api/forms')
      const newForm = await $fetch<{ id: string }>('/api/forms', {
        method: 'POST',
        body: {
          title: formTitle.value.trim(),
          description: formDescription.value.trim() || undefined,
          slug: formSlug.value.trim().toLowerCase().replace(/\s+/g, '-'),
          questionIds: selectedQuestionIds.value,
        },
      })
      await $fetch('/api/forms/assign', { method: 'POST', body: { formId: newForm.id } })
      await navigateTo('/tasks')
    } catch (e: unknown) {
      createError.value = e instanceof Error ? e.message : 'Failed to create form'
    } finally {
      creating.value = false
    }
  }
</script>

<template>
  <div class="min-h-screen bg-gray-50 dark:bg-gray-950">
    <header
      class="sticky top-0 z-50 border-b border-gray-200 bg-white/95 backdrop-blur dark:border-gray-800 dark:bg-gray-900/95"
    >
      <div class="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8">
        <div class="flex h-16 items-center justify-between">
          <NuxtLink
            to="/tasks"
            class="text-sm font-medium text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white"
          >
            ← Back to Tasks
          </NuxtLink>
        </div>
      </div>
    </header>

    <main class="mx-auto max-w-4xl px-4 py-8 sm:px-6 lg:px-8">
      <h1 class="text-2xl font-bold tracking-tight text-gray-900 sm:text-3xl dark:text-white">
        Add New Form
      </h1>
      <p class="mt-1 text-gray-500 dark:text-gray-400">
        Create a form by adding new questions.
      </p>

      <!-- Form metadata -->
      <div
        class="mt-8 rounded-xl border border-gray-200 bg-white p-6 dark:border-gray-800 dark:bg-gray-900"
      >
        <h2 class="text-lg font-semibold text-gray-900 dark:text-white">Form details</h2>
        <div class="mt-4 space-y-4">
          <div>
            <label class="block text-sm font-medium text-gray-700 dark:text-gray-300">Title</label>
            <input
              v-model="formTitle"
              type="text"
              placeholder="e.g. ACE Questionnaire"
              class="focus:border-primary-500 focus:ring-primary-500 mt-1 w-full rounded-lg border border-gray-300 bg-white px-4 py-2 text-gray-900 shadow-sm dark:border-gray-600 dark:bg-gray-800 dark:text-white"
            />
          </div>
          <div>
            <label class="block text-sm font-medium text-gray-700 dark:text-gray-300"
              >Description (optional)</label
            >
            <textarea
              v-model="formDescription"
              rows="2"
              placeholder="Brief description of the form"
              class="focus:border-primary-500 focus:ring-primary-500 mt-1 w-full rounded-lg border border-gray-300 bg-white px-4 py-2 text-gray-900 shadow-sm dark:border-gray-600 dark:bg-gray-800 dark:text-white"
            />
          </div>
          <div>
            <label class="block text-sm font-medium text-gray-700 dark:text-gray-300"
              >URL slug</label
            >
            <input
              v-model="formSlug"
              type="text"
              placeholder="ace-form"
              class="focus:border-primary-500 focus:ring-primary-500 mt-1 w-full rounded-lg border border-gray-300 bg-white px-4 py-2 text-gray-900 shadow-sm dark:border-gray-600 dark:bg-gray-800 dark:text-white"
            />
          </div>
        </div>
        <UAlert
          v-if="createError"
          color="error"
          variant="subtle"
          :title="createError"
          class="mt-4"
        />
        <div class="mt-6">
          <UButton
            :loading="creating"
            :disabled="!formTitle.trim() || !formSlug.trim()"
            size="lg"
            @click="createFormAndAssign"
          >
            Create form & assign to me
          </UButton>
        </div>
      </div>

      <!-- New question inline -->
      <div
        class="mt-8 rounded-xl border border-gray-200 bg-white p-6 dark:border-gray-800 dark:bg-gray-900"
      >
        <h2 class="text-lg font-semibold text-gray-900 dark:text-white">Add a new question</h2>
        <p class="mt-1 text-sm text-gray-500 dark:text-gray-400">
          It will be added to the master list and can be used in any form.
        </p>
        <div class="mt-4 flex flex-wrap gap-3">
          <input
            v-model="newQuestionText"
            type="text"
            placeholder="Question text"
            class="focus:border-primary-500 focus:ring-primary-500 min-w-[200px] flex-1 rounded-lg border border-gray-300 bg-white px-4 py-2 text-gray-900 shadow-sm dark:border-gray-600 dark:bg-gray-800 dark:text-white"
            @keydown.enter.prevent="addNewQuestion"
          />
          <select
            v-model="newQuestionType"
            class="focus:border-primary-500 focus:ring-primary-500 w-56 rounded-lg border border-gray-300 bg-white px-4 py-2 text-gray-900 dark:border-gray-600 dark:bg-gray-800 dark:text-white"
          >
            <option
              v-for="opt in QUESTION_TYPES"
              :key="opt.value"
              :value="opt.value"
            >
              {{ opt.label }}
            </option>
          </select>
          <UButton
            :loading="addingQuestion"
            :disabled="!newQuestionText.trim()"
            @click="addNewQuestion"
          >
            Add Question
          </UButton>
        </div>

        <!-- Dynamic config: Radio/Checkbox options -->
        <div
          v-if="needsOptions"
          class="mt-6 rounded-lg border border-gray-200 bg-gray-50 p-4 dark:border-gray-700 dark:bg-gray-800/50"
        >
          <p class="mb-3 text-sm font-medium text-gray-700 dark:text-gray-300">
            Options (for single or multiple choice)
          </p>
          <div class="space-y-2">
            <div
              v-for="(opt, idx) in newQuestionOptions"
              :key="idx"
              class="flex items-center gap-2"
            >
              <input
                :value="opt"
                type="text"
                :placeholder="`Option ${idx + 1}`"
                class="focus:border-primary-500 focus:ring-primary-500 flex-1 rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 dark:border-gray-600 dark:bg-gray-800 dark:text-white"
                @input="updateOption(idx, ($event.target as HTMLInputElement).value)"
              />
              <UButton
                size="xs"
                variant="ghost"
                color="error"
                icon="i-heroicons-x-mark-20-solid"
                :disabled="newQuestionOptions.length <= 1"
                @click="removeOption(idx)"
              />
            </div>
            <UButton size="sm" @click="addOption">
              Add Option
            </UButton>
          </div>
          <p
            v-if="newQuestionType === 'radio_other' || newQuestionType === 'checkbox_other'"
            class="mt-2 text-xs text-gray-500 dark:text-gray-400"
          >
            "Other" option will be rendered as an extra text input at the end.
          </p>
        </div>

        <!-- Dynamic config: Grid rows & columns -->
        <div
          v-else-if="needsGrid"
          class="mt-6 space-y-4 rounded-lg border border-gray-200 bg-gray-50 p-4 dark:border-gray-700 dark:bg-gray-800/50"
        >
          <div>
            <p class="mb-2 text-sm font-medium text-gray-700 dark:text-gray-300">Row labels</p>
            <div class="space-y-2">
              <div
                v-for="(row, idx) in newQuestionGridRows"
                :key="'row-' + idx"
                class="flex items-center gap-2"
              >
                <input
                  :value="row"
                  type="text"
                  :placeholder="`Row ${idx + 1}`"
                  class="focus:border-primary-500 focus:ring-primary-500 flex-1 rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 dark:border-gray-600 dark:bg-gray-800 dark:text-white"
                  @input="updateGridRow(idx, ($event.target as HTMLInputElement).value)"
                />
                <UButton
                  size="xs"
                  variant="ghost"
                  color="error"
                  icon="i-heroicons-x-mark-20-solid"
                  :disabled="newQuestionGridRows.length <= 1"
                  @click="removeGridRow(idx)"
                />
              </div>
              <UButton size="sm" @click="addGridRow">
                Add Row
              </UButton>
            </div>
          </div>
          <div>
            <p class="mb-2 text-sm font-medium text-gray-700 dark:text-gray-300">Column labels</p>
            <div class="space-y-2">
              <div
                v-for="(col, idx) in newQuestionGridCols"
                :key="'col-' + idx"
                class="flex items-center gap-2"
              >
                <input
                  :value="col"
                  type="text"
                  :placeholder="`Column ${idx + 1}`"
                  class="focus:border-primary-500 focus:ring-primary-500 flex-1 rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 dark:border-gray-600 dark:bg-gray-800 dark:text-white"
                  @input="updateGridCol(idx, ($event.target as HTMLInputElement).value)"
                />
                <UButton
                  size="xs"
                  variant="ghost"
                  color="error"
                  icon="i-heroicons-x-mark-20-solid"
                  :disabled="newQuestionGridCols.length <= 1"
                  @click="removeGridCol(idx)"
                />
              </div>
              <UButton size="sm" @click="addGridCol">
                Add Column
              </UButton>
            </div>
          </div>
        </div>

        <!-- Preview for short answer / long paragraph -->
        <div
          v-else-if="
            newQuestionType === 'short_answer' || newQuestionType === 'long_paragraph'
          "
          class="mt-6 rounded-lg border border-gray-200 bg-gray-50 p-4 dark:border-gray-700 dark:bg-gray-800/50"
        >
          <p class="mb-2 text-sm text-gray-600 dark:text-gray-400">
            {{ newQuestionType === 'short_answer' ? 'Short answer: single-line text input' : 'Long paragraph: multi-line textarea' }}
          </p>
        </div>
      </div>

      <!-- Form Attachments (PDF Upload) -->
      <div
        class="mt-8 rounded-xl border border-gray-200 bg-white p-6 dark:border-gray-800 dark:bg-gray-900"
      >
        <h2 class="text-lg font-semibold text-gray-900 dark:text-white">Form Attachments</h2>
        <p class="mt-1 text-sm text-gray-500 dark:text-gray-400">
          Upload PDF files to associate with this form. Accepted for medical/counseling documentation.
        </p>
        <div class="mt-4">
          <input
            ref="attachmentInputRef"
            type="file"
            accept=".pdf,application/pdf"
            multiple
            class="hidden"
            @change="onAttachmentChange"
          />
          <UButton
            @click="attachmentInputRef?.click()"
          >
            Upload PDF
          </UButton>
        </div>
        <div v-if="formAttachments.length" class="mt-4 space-y-2">
          <div
            v-for="(file, idx) in formAttachments"
            :key="idx"
            class="flex items-center justify-between rounded-lg border border-gray-200 px-4 py-3 dark:border-gray-700"
          >
            <span class="text-sm text-gray-900 dark:text-white">{{ file.name }}</span>
            <UButton
              size="xs"
              variant="ghost"
              color="error"
              icon="i-heroicons-x-mark-20-solid"
              @click="clearAttachment(idx)"
            >
              Clear File
            </UButton>
          </div>
          <UButton
            size="sm"
            variant="outline"
            color="error"
            @click="clearAllAttachments"
          >
            Clear All Files
          </UButton>
        </div>
      </div>

      <!-- Selected order -->
      <div
        v-if="orderedSelected.length"
        class="mt-8 rounded-xl border border-gray-200 bg-white p-6 dark:border-gray-800 dark:bg-gray-900"
      >
        <h2 class="text-lg font-semibold text-gray-900 dark:text-white">
          Order of questions in form
        </h2>
        <ul class="mt-4 space-y-2">
          <li
            v-for="(q, idx) in orderedSelected"
            :key="q.id"
            class="flex items-center justify-between rounded-lg border border-gray-200 px-4 py-3 dark:border-gray-700"
          >
            <span class="text-sm text-gray-900 dark:text-white">{{ idx + 1 }}. {{ q.text }}</span>
            <div class="flex gap-1">
              <UButton
                size="xs"
                variant="ghost"
                icon="i-heroicons-arrow-up-20-solid"
                :disabled="idx === 0"
                @click="moveQuestion(q.id, -1)"
              />
              <UButton
                size="xs"
                variant="ghost"
                icon="i-heroicons-arrow-down-20-solid"
                :disabled="idx === orderedSelected.length - 1"
                @click="moveQuestion(q.id, 1)"
              />
              <UButton
                size="xs"
                variant="ghost"
                color="error"
                icon="i-heroicons-x-mark-20-solid"
                @click="toggleQuestion(q.id)"
              />
            </div>
          </li>
        </ul>
      </div>
    </main>
  </div>
</template>
