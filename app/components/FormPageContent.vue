<script setup lang="ts">
  const props = defineProps<{ slug: string }>()
  const slugRef = computed(() => props.slug)
  const {
    form,
    formPending,
    formError,
    slug,
    responses,
    completedCount,
    totalCount,
    progressPercent,
    setResponse,
    submitting,
    submitError,
    saveAndExit,
    submit,
  } = useFormBySlug(slugRef)

  const isComplete = computed(
    () => totalCount.value > 0 && completedCount.value === totalCount.value
  )

  function toggleRadioResponse(alias: string, option: string) {
    const current = responses.value[alias]
    setResponse(alias, current === option ? '' : option, { immediate: true })
  }
</script>

<template>
  <div class="min-h-screen bg-gray-50 dark:bg-gray-950">
    <main class="mx-auto max-w-3xl px-4 py-8 sm:px-6 lg:px-8">
      <div v-if="form && !(form.slug === 'ace-form' && isComplete)" class="mb-6">
        <div class="flex items-center justify-between text-sm">
          <span class="font-medium text-gray-700 dark:text-gray-300"
            >{{ progressPercent }}% Complete</span
          >
          <span class="text-gray-500 dark:text-gray-400"
            >{{ completedCount }} of {{ totalCount }} answered</span
          >
        </div>
        <div class="mt-2 h-2 w-full overflow-hidden rounded-full bg-gray-200 dark:bg-gray-700">
          <div
            class="bg-primary-500 h-full rounded-full transition-all duration-300"
            :style="{ width: `${progressPercent}%` }"
          />
        </div>
      </div>

      <div v-if="formPending" class="space-y-6">
        <USkeleton class="h-8 w-2/3" />
        <USkeleton class="h-4 w-full" />
        <USkeleton v-for="i in 5" :key="i" class="h-20 w-full" />
      </div>

      <UAlert
        v-else-if="formError || !slug"
        icon="i-heroicons-exclamation-triangle-20-solid"
        color="error"
        variant="subtle"
        title="Form not found"
        :description="
          formError?.message || 'Invalid form URL. Please check the link and try again.'
        "
      >
        <template #actions>
          <UButton to="/taskPage" variant="outline" size="sm"> Go to Tasks </UButton>
        </template>
      </UAlert>

      <template v-else-if="form">
        <div class="mb-8">
          <h1 class="text-2xl font-bold tracking-tight text-gray-900 sm:text-3xl dark:text-white">
            {{ form.title }}
          </h1>
          <p v-if="form.description" class="mt-2 text-gray-600 dark:text-gray-400">
            {{ form.description }}
          </p>
        </div>

        <form class="space-y-8" @submit.prevent="submit">
          <div
            v-if="form.slug === 'ace-form'"
            class="border-primary-200 bg-primary-50 dark:border-primary-800 dark:bg-primary-900/20 mb-6 rounded-lg border p-4"
          >
            <p class="text-primary-900 dark:text-primary-200 text-sm font-medium">
              While you were growing up, during your first 18 years of life:
            </p>
          </div>

          <div
            v-for="(q, index) in form.questions"
            :key="q.id"
            class="rounded-xl border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-800 dark:bg-gray-900"
          >
            <fieldset>
              <legend class="text-base font-medium text-gray-900 dark:text-white">
                {{ Number(index) + 1 }}. {{ q.text }}
              </legend>
              <div v-if="q.type === 'radio'" class="mt-4 flex flex-wrap gap-3">
                <button
                  v-for="opt in ['Yes', 'No']"
                  :key="opt"
                  type="button"
                  class="relative flex cursor-pointer items-center rounded-lg border px-4 py-3 transition"
                  :class="
                    responses[q.alias] === opt
                      ? 'border-primary-600 bg-primary-100 ring-primary-400/60 text-primary-900 dark:border-primary-500 dark:bg-primary-900/40 dark:text-primary-100 dark:ring-primary-500/50 ring-2'
                      : 'border-gray-200 text-gray-700 hover:border-gray-300 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-200 dark:hover:border-gray-600 dark:hover:bg-gray-800/60'
                  "
                  @click="toggleRadioResponse(q.alias, opt)"
                >
                  <span class="text-sm font-semibold">{{ opt }}</span>
                </button>
              </div>
              <div v-else class="mt-4">
                <input
                  :value="responses[q.alias]"
                  type="text"
                  :name="q.alias"
                  class="focus:border-primary-500 focus:ring-primary-500 w-full rounded-lg border border-gray-300 bg-white px-4 py-2.5 text-gray-900 shadow-sm dark:border-gray-600 dark:bg-gray-800 dark:text-white"
                  placeholder="Your answer"
                  @input="setResponse(q.alias, ($event.target as HTMLInputElement).value)"
                />
              </div>
            </fieldset>
          </div>

          <UAlert
            v-if="submitError"
            color="error"
            variant="subtle"
            :title="submitError"
            class="mb-4"
          />

          <div class="flex justify-end gap-3">
            <UButton
              type="button"
              size="lg"
              :loading="submitting"
              :disabled="submitting"
              color="error"
              variant="soft"
              @click="saveAndExit"
            >
              Save and Exit
            </UButton>
            <UButton
              v-if="isComplete"
              type="submit"
              size="lg"
              :loading="submitting"
              :disabled="submitting"
            >
              Submit
            </UButton>
          </div>
        </form>
      </template>
    </main>
  </div>
</template>
