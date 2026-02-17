<script setup lang="ts">
  const { data: existingQuestions, refresh: refreshQuestions } = await useFetch('/api/questions')

  const formTitle = ref('')
  const formDescription = ref('')
  const selectedQuestionIds = ref<string[]>([])
  const newQuestionText = ref('')
  const newQuestionType = ref('radio')
  const newQuestionOptions = ref<string[]>(['Yes', 'No'])
  const addingQuestion = ref(false)
  const importing = ref(false)
  const importError = ref<string | null>(null)
  const importSuccess = ref<string | null>(null)
  const creating = ref(false)
  const createError = ref<string | null>(null)

  type ImportRow = { text: string; type?: string; options?: string[] }

  function parseImportedFile(content: string): ImportRow[] {
    const trim = content.trim()
    if (!trim) return []

    // JSON: array or { "questions": [...] }
    if (trim.startsWith('[') || trim.startsWith('{')) {
      try {
        const data = JSON.parse(content) as unknown
        if (Array.isArray(data)) {
          return data
            .map((q) => {
              if (q && typeof q === 'object' && 'text' in q)
                return {
                  text: String((q as { text: unknown }).text).trim(),
                  type:
                    typeof (q as { type?: unknown }).type === 'string'
                      ? (q as { type: string }).type
                      : undefined,
                  options: Array.isArray((q as { options?: unknown }).options)
                    ? (q as { options: unknown[] }).options
                        .map((o) => String(o).trim())
                        .filter(Boolean)
                    : undefined,
                }
              if (typeof q === 'string' && q.trim()) return { text: q.trim() }
              return null
            })
            .filter((q): q is ImportRow => q !== null && q.text !== '')
        }
        if (
          data &&
          typeof data === 'object' &&
          'questions' in data &&
          Array.isArray((data as { questions: unknown }).questions)
        ) {
          return parseImportedFile(JSON.stringify((data as { questions: unknown[] }).questions))
        }
      } catch {
        // fall through to CSV/text
      }
    }

    // CSV / TSV: text, optional type, optional options (pipe-separated)
    const lines = content
      .split(/\r?\n/)
      .map((l) => l.trim())
      .filter(Boolean)
    if (lines.length === 0) return []
    const sep = lines[0].includes('\t') ? '\t' : lines[0].includes(';') ? ';' : ','
    return lines
      .map((line) => {
        const parts = line.split(sep).map((p) => p.trim())
        const text = parts[0] || ''
        if (!text) return null
        const type = parts[1] || undefined
        const options = parts[2]
          ? parts[2]
              .split('|')
              .map((o) => o.trim())
              .filter(Boolean)
          : undefined
        return { text, type: type || undefined, options }
      })
      .filter((q): q is ImportRow => q !== null && q.text !== '')
  }

  async function onImportFile(event: Event) {
    const input = event.target as HTMLInputElement
    const file = input?.files?.[0]
    if (!file) return
    importError.value = null
    importSuccess.value = null
    importing.value = true
    try {
      const isPdf = file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf')
      if (isPdf) {
        const formData = new FormData()
        formData.append('file', file)
        const { ids } = await $fetch<{ ids: string[] }>('/api/questions/import-pdf', {
          method: 'POST',
          body: formData,
        })
        await refreshQuestions()
        ids.forEach((id) => {
          if (!selectedQuestionIds.value.includes(id))
            selectedQuestionIds.value = [...selectedQuestionIds.value, id]
        })
        importSuccess.value = `Imported ${ids.length} question${ids.length === 1 ? '' : 's'} from PDF and added to form.`
      } else {
        const content = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader()
          reader.onload = () => resolve(String(reader.result ?? ''))
          reader.onerror = () => reject(new Error('Could not read file'))
          reader.readAsText(file, 'UTF-8')
        })
        const questions = parseImportedFile(content)
        if (questions.length === 0) {
          importError.value =
            'No questions found in file. Use JSON ([{ "text": "..." }]), CSV (text, type, options), or one question per line.'
          return
        }
        const { ids } = await $fetch<{ ids: string[] }>('/api/questions/import', {
          method: 'POST',
          body: { questions },
        })
        await refreshQuestions()
        ids.forEach((id) => {
          if (!selectedQuestionIds.value.includes(id))
            selectedQuestionIds.value = [...selectedQuestionIds.value, id]
        })
        importSuccess.value = `Imported ${ids.length} question${ids.length === 1 ? '' : 's'} and added to form.`
      }
      input.value = ''
    } catch (e: unknown) {
      importError.value = e instanceof Error ? e.message : 'Import failed'
    } finally {
      importing.value = false
    }
  }

  const slugFromTitle = computed(() =>
    formTitle.value
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, '')
      .trim()
      .replace(/\s+/g, '-')
      .slice(0, 40)
  )

  watch(newQuestionType, (t) => {
    if (t === 'radio') newQuestionOptions.value = ['Yes', 'No']
    else if (t === 'checkbox') newQuestionOptions.value = ['Yes']
    else newQuestionOptions.value = []
  })

  const showOptionsForType = computed(
    () => newQuestionType.value === 'radio' || newQuestionType.value === 'checkbox'
  )
  const hasValidOptions = computed(
    () => !showOptionsForType.value || newQuestionOptions.value.some((o) => o.trim() !== '')
  )

  function addOption() {
    newQuestionOptions.value = [...newQuestionOptions.value, '']
  }

  function removeOption(idx: number) {
    newQuestionOptions.value = newQuestionOptions.value.filter((_, i) => i !== idx)
  }

  function updateOption(idx: number, value: string) {
    const next = [...newQuestionOptions.value]
    next[idx] = value
    newQuestionOptions.value = next
  }

  async function addNewQuestion() {
    if (!newQuestionText.value.trim()) return
    if (showOptionsForType.value && newQuestionOptions.value.every((o) => !o.trim())) return
    addingQuestion.value = true
    try {
      const body: { text: string; type: string; options?: string[] } = {
        text: newQuestionText.value.trim(),
        type: newQuestionType.value,
      }
      if (showOptionsForType.value) {
        body.options = newQuestionOptions.value.map((o) => o.trim()).filter(Boolean)
        if (body.options.length === 0)
          body.options = newQuestionType.value === 'radio' ? ['Yes', 'No'] : ['Yes']
      }
      const q = await $fetch<{ id: string }>('/api/questions/add', { method: 'POST', body })
      await refreshQuestions()
      if (!selectedQuestionIds.value.includes(q.id))
        selectedQuestionIds.value = [...selectedQuestionIds.value, q.id]
      newQuestionText.value = ''
      if (newQuestionType.value === 'radio') newQuestionOptions.value = ['Yes', 'No']
      else if (newQuestionType.value === 'checkbox') newQuestionOptions.value = ['Yes']
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
      options?: string[]
    }[]
  })

  async function createFormAndAssign() {
    createError.value = null
    if (!formTitle.value.trim()) {
      createError.value = 'Title is required.'
      return
    }
    if (!slugFromTitle.value) {
      createError.value =
        'Title must contain at least one letter or number (used for the form URL).'
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
          slug: slugFromTitle.value,
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
      class="sticky top-0 z-50 border-b border-gray-200 bg-white dark:border-gray-800 dark:bg-gray-900"
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
      <p class="mt-1 text-gray-500 dark:text-gray-400">Create a form by adding new questions.</p>

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
            :disabled="!formTitle.trim() || !slugFromTitle"
            size="lg"
            @click="createFormAndAssign"
          >
            Create form & assign to me
          </UButton>
        </div>
      </div>

      <!-- Import questions -->
      <div
        class="mt-8 rounded-xl border border-gray-200 bg-white p-6 dark:border-gray-800 dark:bg-gray-900"
      >
        <h2 class="text-lg font-semibold text-gray-900 dark:text-white">Import questions</h2>
        <p class="mt-1 text-sm text-gray-500 dark:text-gray-400">
          Upload a file (any type). PDFs are read automatically; also supports JSON, CSV/TSV, or
          plain text (one question per line).
        </p>
        <div class="mt-4 flex flex-wrap items-center gap-3">
          <label
            class="focus-within:ring-primary-500 inline-flex cursor-pointer items-center gap-2 rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 shadow-sm focus-within:ring-2 hover:bg-gray-50 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-200 dark:hover:bg-gray-700"
          >
            <input
              type="file"
              class="sr-only"
              accept="*"
              :disabled="importing"
              @change="onImportFile"
            />
            <UIcon v-if="!importing" name="i-heroicons-arrow-up-tray-20-solid" class="h-4 w-4" />
            <span>{{ importing ? 'Importing…' : 'Choose file…' }}</span>
          </label>
        </div>
        <UAlert
          v-if="importError"
          color="error"
          variant="subtle"
          :title="importError"
          class="mt-3"
        />
        <UAlert
          v-if="importSuccess"
          color="success"
          variant="subtle"
          :title="importSuccess"
          class="mt-3"
        />
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
            class="focus:border-primary-500 focus:ring-primary-500 w-40 rounded-lg border border-gray-300 bg-white px-4 py-2 text-gray-900 dark:border-gray-600 dark:bg-gray-800 dark:text-white"
          >
            <option value="radio">Yes/No (radio)</option>
            <option value="checkbox">Checkbox</option>
            <option value="text">Text</option>
          </select>
          <UButton
            :loading="addingQuestion"
            :disabled="!newQuestionText.trim() || !hasValidOptions"
            @click="addNewQuestion"
          >
            Add Question
          </UButton>
        </div>
        <!-- Options for radio/checkbox -->
        <div v-if="showOptionsForType" class="mt-4">
          <label class="block text-sm font-medium text-gray-700 dark:text-gray-300">Options</label>
          <p class="mt-0.5 text-xs text-gray-500 dark:text-gray-400">
            Add the choices for this question. Reorder by editing; first option is shown first.
          </p>
          <ul class="mt-2 space-y-2">
            <li v-for="(opt, idx) in newQuestionOptions" :key="idx" class="flex items-center gap-2">
              <input
                :value="opt"
                type="text"
                placeholder="Option label"
                class="focus:border-primary-500 focus:ring-primary-500 w-48 rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-sm text-gray-900 dark:border-gray-600 dark:bg-gray-800 dark:text-white"
                @input="updateOption(idx, ($event.target as HTMLInputElement).value)"
              />
              <UButton
                size="xs"
                variant="ghost"
                color="error"
                icon="i-heroicons-x-mark-20-solid"
                aria-label="Remove option"
                @click="removeOption(idx)"
              />
            </li>
          </ul>
          <UButton
            size="sm"
            variant="outline"
            class="mt-2"
            icon="i-heroicons-plus-20-solid"
            @click="addOption"
          >
            Add option
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
