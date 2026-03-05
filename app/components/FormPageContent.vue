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
    clearResponses,
    submitting,
    submitError,
    submit,
  } = await useFormBySlug(slugRef)

  const { data: permissions } = await useFetch<{
    canViewScores: boolean
    canViewNotes: boolean
    canViewPlan: boolean
  }>('/api/user/permissions')
  const canViewScores = computed(() => permissions.value?.canViewScores ?? false)

  const formName = computed(() => {
    if (form.value?.title) return form.value.title
    const s = slug.value || props.slug
    if (s === 'ace-form') return 'ACE'
    return (s || 'Form').replace(/-/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())
  })
</script>

<template>
  <div class="min-h-screen bg-gray-50 dark:bg-gray-950">
    <main class="mx-auto max-w-3xl px-4 py-8 sm:px-6 lg:px-8">
      <div v-if="form && canViewScores" class="mb-6">
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
        :title="`${formName}: Error loading form`"
        :description="
          formError?.message || 'Invalid form URL. Please check the link and try again.'
        "
      />
      <div v-if="formError || !slug" class="mt-4">
        <NuxtLink to="/taskPage">
          <UButton variant="outline" size="lg">Back to Tasks</UButton>
        </NuxtLink>
      </div>

      <template v-else-if="form">
        <div class="mb-8">
          <h1 class="text-2xl font-bold tracking-tight text-gray-900 sm:text-3xl dark:text-white">
            {{ form.slug === 'ace-form' ? 'ACE Questionnaire' : form.title }}
          </h1>
          <p
            v-if="form.slug === 'ace-form'"
            class="mt-2 text-sm text-gray-600 dark:text-gray-400"
          >
            While you were growing up, during your
            <span class="font-medium">first 18 years of life</span>, answer Yes or No for each
            question.
          </p>
          <p v-else-if="form.description" class="mt-2 text-sm text-gray-600 dark:text-gray-400">
            {{ form.description }}
          </p>
        </div>

        <form class="space-y-8" @submit.prevent="submit">
          <div
            v-for="(q, index) in form.questions"
            :key="q.id"
            class="rounded-xl border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-800 dark:bg-gray-900"
          >
            <p class="font-medium text-gray-900 dark:text-white mb-3">
              {{ Number(index) + 1 }}. {{ q.text }}
            </p>
            <div v-if="q.type === 'radio'" class="flex justify-between mt-4">
              <label
                v-for="opt in ['Yes', 'No']"
                :key="opt"
                class="flex flex-col items-center gap-1"
              >
                <span class="text-sm text-gray-700 dark:text-gray-300">{{ opt }}</span>
                <input
                  type="radio"
                  :name="q.alias"
                  :value="opt"
                  :checked="responses[q.alias] === opt"
                  class="accent-primary-500 mt-1"
                  @change="setResponse(q.alias, ($event.target as HTMLInputElement).value, { immediate: true })"
                />
              </label>
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
              label="Clear Form"
              variant="outline"
              color="neutral"
              size="lg"
              :disabled="submitting"
              @click="clearResponses"
            />
            <UButton
              type="submit"
              label="Save and Exit"
              color="error"
              variant="soft"
              size="lg"
              :loading="submitting"
              :disabled="submitting"
            />
          </div>
        </form>
      </template>
    </main>
  </div>
</template>
