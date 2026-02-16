export async function useFormBySlug(slug: Ref<string> | ComputedRef<string>) {
  const route = useRoute()
  const slugValue = computed(() => unref(slug))

  // Ensure slug is valid - redirect if missing (only when slug comes from route)
  watch(
    slugValue,
    (newSlug) => {
      if (!newSlug && route.path.startsWith('/forms/')) {
        navigateTo('/tasks')
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
    }
  )

  const { data: formStatus } = await useFetch(
    () => {
      if (!slugValue.value) return null
      return `/api/forms/${slugValue.value}/status`
    },
    {
      watch: [slugValue],
      default: () => ({ isCompleted: false, completedAt: null }),
      immediate: !!slugValue.value,
      server: false,
    }
  )

  const responses = ref<Record<string, string>>(existingResponses.value || {})
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

  function setResponse(alias: string, value: string) {
    responses.value[alias] = value
    if (saveTimeout) clearTimeout(saveTimeout)
    if (!slugValue.value) return
    saveTimeout = setTimeout(async () => {
      try {
        await $fetch(`/api/forms/${slugValue.value}/responses`, {
          method: 'POST',
          body: { responses: responses.value },
        })
      } catch (e) {
        console.error('Auto-save failed:', e)
      }
    }, 500)
  }

  watch(
    existingResponses,
    (newResponses) => {
      if (newResponses && Object.keys(newResponses).length > 0) {
        responses.value = { ...newResponses }
      }
    },
    { immediate: true }
  )

  const submitting = ref(false)
  const submitError = ref<string | null>(null)
  const showIncompleteModal = ref(false)
  const showIncompleteBanner = ref(false)
  const unansweredCount = computed(() => totalCount.value - completedCount.value)

  // Hide banner when user completes all questions (e.g. after seeing the warning)
  watch(unansweredCount, (count) => {
    if (count === 0) showIncompleteBanner.value = false
  })

  function dismissIncompleteBanner() {
    showIncompleteBanner.value = false
  }

  async function submit() {
    if (!form.value) {
      submitError.value = 'Form not loaded'
      return
    }
    if (totalCount.value !== completedCount.value) {
      showIncompleteBanner.value = true
      if (import.meta.client) {
        window.scrollTo({ top: 0, behavior: 'smooth' })
      }
      return
    }
    submitting.value = true
    submitError.value = null
    try {
      if (saveTimeout) clearTimeout(saveTimeout)
      const allResponses: Record<string, string> = {}
      let missingQuestion: string | null = null
      for (const q of form.value.questions) {
        const answer = responses.value[q.alias]
        if (!answer || answer === '') {
          missingQuestion = q.text
          break
        }
        allResponses[q.alias] = answer
      }
      if (missingQuestion) {
        submitError.value = `Please answer: "${missingQuestion}"`
        submitting.value = false
        return
      }
      const res = await $fetch('/api/forms/submit', {
        method: 'POST',
        body: { formSlug: form.value.slug, responses: allResponses },
      })
      if (res && (res as { ok?: boolean }).ok) {
        await navigateTo(`/forms/${slugValue.value}-results`)
      } else {
        submitError.value = 'Submission failed. Please try again.'
      }
    } catch (e: unknown) {
      if (e && typeof e === 'object' && 'data' in e) {
        const errorData = e.data as { message?: string }
        submitError.value = errorData?.message || 'Failed to submit form'
      } else {
        submitError.value = e instanceof Error ? e.message : 'Failed to submit form'
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
    formStatus,
    responses,
    completedCount,
    totalCount,
    progressPercent,
    setResponse,
    submitting,
    submitError,
    showIncompleteModal,
    showIncompleteBanner,
    unansweredCount,
    dismissIncompleteBanner,
    submit,
  }
}
