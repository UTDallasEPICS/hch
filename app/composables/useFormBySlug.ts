export async function useFormBySlug(slug: Ref<string> | ComputedRef<string>) {
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
  } = await useFetch<FormPayload>(
    formEndpoint,
    {
      watch: [slugValue],
      immediate: !!slugValue.value,
      server: false,
    }
  )

  const { data: existingResponses } = await useFetch<Record<string, string>>(
    responsesEndpoint,
    {
      watch: [slugValue],
      default: () => ({}),
      immediate: !!slugValue.value,
      server: false,
      getCachedData: () => undefined,
    }
  )

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

    pendingSave = next
      .catch((e) => {
        console.error('Save failed:', e)
      })
      .then(() => {
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

  onBeforeRouteLeave(async () => {
    await flushPendingSave()
  })

  watch(
    existingResponses,
    (newResponses) => {
      responses.value = { ...(newResponses ?? {}) }
    },
    { immediate: true }
  )

  const submitting = ref(false)
  const submitError = ref<string | null>(null)
  async function submit() {
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
    submitting,
    submitError,
    submit,
  }
}
