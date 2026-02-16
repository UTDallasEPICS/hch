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

  const slugFromTitle = computed(() =>
    formTitle.value
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, '')
      .trim()
      .replace(/\s+/g, '-')
      .slice(0, 40)
  )

  watch(formTitle, (t) => {
    if (!formSlug.value || formSlug.value === slugFromTitle.value)
      formSlug.value = slugFromTitle.value
  })

  async function addNewQuestion() {
    if (!newQuestionText.value.trim()) return
    addingQuestion.value = true
    try {
      const q = await $fetch<{ id: string }>('/api/questions/add', {
        method: 'POST',
        body: { text: newQuestionText.value.trim(), type: newQuestionType.value },
      })
      await refreshQuestions()
      if (!selectedQuestionIds.value.includes(q.id))
        selectedQuestionIds.value = [...selectedQuestionIds.value, q.id]
      newQuestionText.value = ''
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
      <p class="mt-1 text-gray-500 dark:text-gray-400">
        Create a form by choosing existing questions or adding new ones.
      </p>

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
            <option value="text">Text</option>
          </select>
          <UButton
            :loading="addingQuestion"
            :disabled="!newQuestionText.trim()"
            @click="addNewQuestion"
          >
            Add Question
          </UButton>
        </div>
      </div>

      <!-- Existing questions -->
      <div
        class="mt-8 rounded-xl border border-gray-200 bg-white p-6 dark:border-gray-800 dark:bg-gray-900"
      >
        <h2 class="text-lg font-semibold text-gray-900 dark:text-white">Existing questions</h2>
        <p class="mt-1 text-sm text-gray-500 dark:text-gray-400">
          Click to include in this form. Order is used as displayed below.
        </p>
        <ul class="mt-4 space-y-2">
          <li
            v-for="q in existingQuestions"
            :key="q.id"
            class="flex items-center justify-between rounded-lg border border-gray-200 px-4 py-3 dark:border-gray-700"
          >
            <label class="flex cursor-pointer items-center gap-3">
              <input
                type="checkbox"
                :checked="selectedQuestionIds.includes(q.id)"
                class="text-primary-600 focus:ring-primary-500 h-4 w-4 rounded border-gray-300"
                @change="toggleQuestion(q.id)"
              />
              <span class="text-sm text-gray-900 dark:text-white">{{ q.text }}</span>
              <UBadge size="xs" variant="subtle">{{ q.type }}</UBadge>
            </label>
          </li>
          <li v-if="!existingQuestions?.length" class="py-4 text-center text-sm text-gray-500">
            No questions yet. Add one above.
          </li>
        </ul>
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
    </main>
  </div>
</template>
