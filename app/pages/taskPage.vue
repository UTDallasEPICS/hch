<script setup lang="ts">
  const answered = ref(0)
  const total = ref(9)
  const submitted = ref(false)
  const isSubmitting = ref(false)
  const toast = useToast()

  const canSubmit = computed(() => answered.value === total.value)

  async function loadProgress() {
    const progress = await $fetch<{ answered: number; total: number; submitted?: boolean }>(
      '/api/phq/progress'
    )

    answered.value = progress.answered
    total.value = progress.total
    submitted.value = Boolean(progress.submitted)
  }

  async function submitForms() {
    if (!canSubmit.value) return

    try {
      isSubmitting.value = true
      await $fetch('/api/phq/submit', { method: 'POST' })
      submitted.value = true
      toast.add({
        title: 'Form submitted',
        description: 'Your PHQ Form has been submitted successfully.',
        color: 'success',
      })
    } catch (error: any) {
      const description =
        error?.data?.statusMessage ||
        error?.statusMessage ||
        'Unable to submit form. Please try again.'

      toast.add({
        title: 'Submission failed',
        description,
        color: 'error',
      })
      await loadProgress()
    } finally {
      isSubmitting.value = false
    }
  }

  onMounted(async () => {
    try {
      await loadProgress()
    } catch {
      answered.value = 0
      total.value = 9
      submitted.value = false
    }
  })
</script>

<template>
  <UContainer class="py-10">
    <h1 class="text-2xl font-semibold text-gray-900 dark:text-white">Tasks to complete:</h1>
    <div
      class="mt-6 flex items-center justify-between px-5 text-sm font-medium text-gray-600 dark:text-gray-300"
    >
      <span>Form</span>
      <span>Progress</span>
    </div>
    <UButton
      class="mt-3 w-full justify-between rounded-xl px-5 py-4 text-sm font-semibold"
      color="primary"
      variant="soft"
      to="/phq"
    >
      <span>PHQ Form</span>
      <span>{{ submitted ? 'Submitted' : `${answered}/${total}` }}</span>
    </UButton>

    <div class="mt-6 flex justify-end">
      <div v-if="canSubmit" class="flex flex-col items-end gap-2">
        <p class="text-right text-sm text-red-500">
          Please verify your answers on the forms are accurate before submission.
        </p>
        <UButton
          label="Submit"
          color="primary"
          variant="solid"
          :loading="isSubmitting"
          @click="submitForms"
        />
      </div>
    </div>
  </UContainer>
</template>

