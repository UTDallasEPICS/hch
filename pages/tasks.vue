<script setup lang="ts">
  const {
    data: tasks,
    pending,
    error,
    refresh,
  } = await useFetch('/api/tasks', {
    key: 'tasks',
  })
  const { data: allForms } = await useFetch('/api/forms')

  // Refresh tasks when navigating back to this page
  const route = useRoute()
  watch(
    () => route.path,
    (newPath) => {
      if (newPath === '/tasks') {
        refresh()
      }
    },
    { immediate: true }
  )

  const assignedSlugs = computed(
    () => new Set((tasks.value ?? []).map((t: { slug: string }) => t.slug))
  )
  const availableForms = computed(() =>
    (allForms.value ?? []).filter((f: { slug: string }) => !assignedSlugs.value.has(f.slug))
  )

  const assigningSlug = ref<string | null>(null)
  async function startForm(slug: string) {
    const form = (allForms.value as { id: string; slug: string }[] | undefined)?.find(
      (f: { slug: string }) => f.slug === slug
    )
    if (!form) return
    assigningSlug.value = slug
    try {
      await $fetch('/api/forms/assign', { method: 'POST', body: { formId: form.id } })
      await refresh()
      await navigateTo(`/forms/${slug}`)
    } finally {
      assigningSlug.value = null
    }
  }

  function progressLabel(task: { progress: number; status: string }) {
    return task.status === 'COMPLETED' ? 'COMPLETED' : `${task.progress}%`
  }
</script>

<template>
  <div class="min-h-[calc(100vh-4rem)] bg-gray-50 dark:bg-gray-900">
    <main class="mx-auto max-w-4xl px-4 py-8 sm:px-6 lg:px-8">
      <!-- Page header: stable so no layout shift on reload -->
      <div class="mb-8 flex min-h-[4.5rem] flex-col justify-end gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 class="text-2xl font-bold tracking-tight text-gray-900 sm:text-3xl dark:text-white">
            Tasks
          </h1>
          <p class="mt-1 text-sm text-gray-500 dark:text-gray-400">
            Your assigned forms. Complete them to track your progress.
          </p>
        </div>
        <NuxtLink to="/forms/new" class="shrink-0">
          <UButton icon="i-heroicons-plus-20-solid" size="lg">
            Add New Form
          </UButton>
        </NuxtLink>
      </div>

      <!-- Loading: same card layout as content to avoid shift -->
      <div v-if="pending" class="space-y-4" role="status" aria-label="Loading tasks">
        <div
          v-for="i in 3"
          :key="i"
          class="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-700 dark:bg-gray-800"
        >
          <div class="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div class="min-w-0 flex-1 space-y-2">
              <USkeleton class="h-6 w-2/3 rounded-lg" />
              <USkeleton class="h-4 w-full max-w-md rounded-lg" />
              <USkeleton class="mt-2 h-5 w-20 rounded-full" />
            </div>
            <div class="flex shrink-0 items-center gap-3">
              <USkeleton class="h-3 w-36 rounded-full" />
              <USkeleton class="h-9 w-24 rounded-lg" />
            </div>
          </div>
        </div>
      </div>

      <UAlert
        v-else-if="error"
        icon="i-heroicons-exclamation-triangle-20-solid"
        color="error"
        variant="subtle"
        title="Error loading tasks"
        :description="error.message"
        class="rounded-2xl"
      />

      <div v-else class="space-y-4">
        <div
          v-for="task in tasks"
          :key="task.id"
          class="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm transition hover:border-primary-300 hover:shadow-md dark:border-gray-700 dark:bg-gray-800 dark:hover:border-primary-600"
        >
          <div class="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div class="min-w-0 flex-1">
              <h2 class="truncate text-lg font-semibold text-gray-900 dark:text-white">
                {{ task.title }}
              </h2>
              <p
                v-if="task.description"
                class="mt-1.5 line-clamp-3 min-h-[2.5rem] break-words text-sm leading-relaxed text-gray-500 dark:text-gray-400"
              >
                {{ task.description }}
              </p>
              <div class="mt-3 flex items-center gap-2">
                <span
                  class="inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold text-white"
                  :class="
                    task.status === 'COMPLETED'
                      ? 'bg-[#059669] dark:bg-[#059669]'
                      : 'bg-[#d97706] dark:bg-[#d97706]'
                  "
                >
                  {{ progressLabel(task) }}
                </span>
              </div>
            </div>
            <div class="flex shrink-0 items-center gap-4">
              <div
                v-if="task.status !== 'COMPLETED'"
                class="h-3 w-36 overflow-hidden rounded-full border border-gray-300 bg-gray-200 dark:border-gray-600 dark:bg-gray-700"
              >
                <div
                  class="h-full rounded-full bg-primary-600 dark:bg-primary-400 shadow-sm"
                  :style="{ width: `${task.progress}%` }"
                />
              </div>
              <NuxtLink
                :to="
                  task.status === 'COMPLETED'
                    ? `/forms/${task.slug}-results`
                    : `/forms/${task.slug}`
                "
              >
                <UButton
                  :variant="task.status === 'COMPLETED' ? 'soft' : 'solid'"
                  :color="task.status === 'COMPLETED' ? 'neutral' : 'primary'"
                  size="md"
                >
                  {{ task.status === 'COMPLETED' ? 'View' : 'Continue' }}
                </UButton>
              </NuxtLink>
            </div>
          </div>
        </div>

        <div
          v-if="tasks?.length === 0 && !availableForms?.length"
          class="rounded-2xl border border-dashed border-gray-300 bg-white p-12 text-center dark:border-gray-700 dark:bg-gray-800"
        >
          <p class="text-gray-500 dark:text-gray-400">No tasks assigned yet.</p>
          <p class="mt-1 text-sm text-gray-400 dark:text-gray-500">
            Use "Add New Form" to create a form, then assign it to yourself.
          </p>
          <NuxtLink to="/forms/new" class="mt-4 inline-block">
            <UButton variant="outline">Add New Form</UButton>
          </NuxtLink>
        </div>

        <!-- Available forms (not yet assigned) -->
        <div v-if="availableForms?.length" class="mt-10">
          <h2 class="mb-4 text-lg font-semibold text-gray-900 dark:text-white">
            Available forms
          </h2>
          <div class="space-y-4">
            <div
              v-for="f in availableForms"
              :key="f.id"
              class="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-700 dark:bg-gray-800"
            >
              <div class="flex items-center justify-between">
                <div>
                  <h3 class="font-semibold text-gray-900 dark:text-white">{{ f.title }}</h3>
                  <p v-if="f.description" class="mt-1 text-sm text-gray-500 dark:text-gray-400">
                    {{ f.description }}
                  </p>
                </div>
                <UButton :loading="assigningSlug === f.slug" size="md" @click="startForm(f.slug)">
                  Start
                </UButton>
              </div>
            </div>
          </div>
        </div>
      </div>
    </main>
  </div>
</template>
