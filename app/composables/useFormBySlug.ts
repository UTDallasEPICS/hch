export function useFormBySlug(slug: Ref<string> | ComputedRef<string>) {
  const route = useRoute()
  const slugValue = computed(() => unref(slug))
  type FormQuestion = {
    id: string
    text: string
    type: string
    alias: string
    order: number
  }
  type FormPayload = {
    id: string
    title: string
    description: string | null
    slug: string
    questions: FormQuestion[]
  }
  const formEndpoint = computed(() => `/api/forms/${slugValue.value}`)
  const responsesEndpoint = computed(() => `/api/forms/${slugValue.value}/responses`)

  // Ensure slug is valid - redirect if missing (only when slug comes from route)
  watch(
    slugValue,
    (newSlug) => {
      if (!newSlug && route.path.startsWith('/forms/')) {
        navigateTo('/taskPage')
      }
    },
    { immediate: true }
  )

  const {
    data: form,
    pending: formPending,
    error: formError,
  } = useFetch<FormPayload>(formEndpoint, {
    watch: [slugValue],
    immediate: !!slugValue.value,
    server: false,
  })

  const { data: existingResponses } = useFetch<Record<string, string>>(responsesEndpoint, {
    watch: [slugValue],
    default: () => ({}),
    immediate: !!slugValue.value,
    server: false,
    getCachedData: () => undefined,
  })

  const responses = ref<Record<string, string>>({})
  const completedCount = computed(() => {
    const questions = form.value?.questions ?? []
    let count = 0

    for (const question of questions) {
      const answer = responses.value[question.alias]
      if (answer !== undefined && answer !== null && answer !== '') {
        count += 1
      }
    }

    return count
  })
  const totalCount = computed(() => form.value?.questions?.length ?? 0)
  const progressPercent = computed(() =>
    totalCount.value ? Math.round((completedCount.value / totalCount.value) * 100) : 0
  )

  let saveTimeout: ReturnType<typeof setTimeout> | null = null
  let pendingSave: Promise<void> | null = null

  async function persistResponses() {
    if (!slugValue.value) return

    await $fetch(`/api/forms/${slugValue.value}/responses`, {
      method: 'POST',
      body: { responses: responses.value },
    })
  }

  function queueSave() {
    const run = async () => {
      await persistResponses()
    }

    const next = (pendingSave ?? Promise.resolve()).catch(() => undefined).then(run)

    pendingSave = next.finally(() => {
      if (pendingSave === next) {
        pendingSave = null
      }
    })

    return next
  }

  async function flushPendingSave() {
    if (saveTimeout) {
      clearTimeout(saveTimeout)
      saveTimeout = null
      await queueSave()
    }

    if (pendingSave) {
      try {
        await pendingSave
      } catch {
        // Error already logged in queueSave
      }
    }
  }

  function setResponse(alias: string, value: string, options?: { immediate?: boolean }) {
    responses.value[alias] = value
    if (saveTimeout) clearTimeout(saveTimeout)
    if (!slugValue.value) return

    if (options?.immediate) {
      saveTimeout = null
      queueSave()
      return
    }

    saveTimeout = setTimeout(async () => {
      try {
        saveTimeout = null
        await queueSave()
      } catch (e) {
        console.error('Auto-save failed:', e)
      }
    }, 500)
  }

  function clearResponses() {
    responses.value = {}
  }

  onBeforeRouteLeave(async () => {
    await flushPendingSave()
  })

  watch(
    [existingResponses, form],
    ([newResponses, currentForm]) => {
      const normalizedResponses: Record<string, string> = {}
      const questionTypeByAlias = new Map<string, string>()

      for (const question of currentForm?.questions ?? []) {
        questionTypeByAlias.set(question.alias, question.type)
      }

      for (const [alias, value] of Object.entries(newResponses ?? {})) {
        const stringValue = typeof value === 'string' ? value : String(value ?? '')
        const questionType = questionTypeByAlias.get(alias)

        if (questionType === 'radio') {
          if (stringValue === 'true') {
            normalizedResponses[alias] = 'Yes'
            continue
          }

          if (stringValue === 'false') {
            normalizedResponses[alias] = 'No'
            continue
          }
        }

        normalizedResponses[alias] = stringValue
      }

      responses.value = normalizedResponses
    },
    { immediate: true }
  )

  const submitting = ref(false)
  const submitError = ref<string | null>(null)
  async function saveAndExit() {
    if (!form.value) {
      submitError.value = 'Form not loaded'
      return
    }

    submitting.value = true
    submitError.value = null

    try {
      await flushPendingSave()
      await persistResponses()

      await navigateTo('/taskPage')
    } catch (e: unknown) {
      if (e && typeof e === 'object' && 'data' in e) {
        const errorData = e.data as { message?: string }
        submitError.value = errorData?.message || 'Failed to save form'
      } else {
        submitError.value = e instanceof Error ? e.message : 'Failed to save form'
      }
    } finally {
      submitting.value = false
    }
  }

  async function submit() {
    if (!form.value) {
      submitError.value = 'Form not loaded'
      return
    }

    if (totalCount.value === 0 || completedCount.value !== totalCount.value) {
      submitError.value = 'Please complete all questions before submitting.'
      return
    }

    submitting.value = true
    submitError.value = null

    try {
      await flushPendingSave()
      await persistResponses()
      await $fetch(`/api/forms/${slugValue.value}/submit`, {
        method: 'POST',
      })

      await navigateTo('/taskPage')
    } catch (e: unknown) {
      if (e && typeof e === 'object' && 'data' in e) {
        const errorData = e.data as { message?: string }
        submitError.value = errorData?.message || 'Failed to save form'
      } else {
        submitError.value = e instanceof Error ? e.message : 'Failed to save form'
      }
    } finally {
      submitting.value = false
    }
  }

  return {
    slug: slugValue,
    form,
    formPending,
    formError,
    responses,
    completedCount,
    totalCount,
    progressPercent,
    setResponse,
    clearResponses,
    submitting,
    submitError,
    saveAndExit,
    submit,
  }
}
