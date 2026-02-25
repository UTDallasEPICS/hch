export async function useFormBySlug(slug: Ref<string> | ComputedRef<string>) {
  const route = useRoute()
  const slugValue = computed(() => unref(slug))

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
  } = await useFetch(
    () => {
      if (!slugValue.value) return null
      return `/api/forms/${slugValue.value}`
    },
    {
      watch: [slugValue],
      immediate: !!slugValue.value,
      server: false,
    }
  )

  const { data: existingResponses } = await useFetch(
    () => {
      if (!slugValue.value) return null
      return `/api/forms/${slugValue.value}/responses`
    },
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
    if (!form.value) return 0
    return form.value.questions.filter((q) => {
      const answer = responses.value[q.alias]
      return answer !== undefined && answer !== null && answer !== ''
    }).length
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
