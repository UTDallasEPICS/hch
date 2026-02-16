<script setup lang="ts">
  import { authClient } from '../utils/auth-client'

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

  async function logout() {
    await authClient.signOut()
    await navigateTo('/auth', { external: true })
  }

  function progressLabel(task: { progress: number; status: string }) {
    return task.status === 'COMPLETED' ? 'COMPLETED' : `${task.progress}%`
  }
</script>

<template>
  <div class="min-h-screen bg-gray-50 dark:bg-gray-950">
    <header
      class="sticky top-0 z-50 border-b border-gray-200 bg-white/95 backdrop-blur supports-[backdrop-filter]:bg-white/80 dark:border-gray-800 dark:bg-gray-900/95 dark:supports-[backdrop-filter]:bg-gray-900/80"
    >
      <div class="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8">
        <div class="flex h-16 items-center justify-between">
          <NuxtLink
            to="/"
            class="flex items-center gap-2 text-lg font-semibold text-gray-900 dark:text-white"
          >
            <span class="text-2xl">🌱</span>
            <span>Hope. Cope. Heal.</span>
          </NuxtLink>
          <div class="flex items-center gap-3">
            <NuxtLink
              to="/"
              class="text-sm font-medium text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white"
            >
              Dashboard
            </NuxtLink>
            <UButton
              color="neutral"
              variant="ghost"
              size="sm"
              icon="i-heroicons-arrow-right-on-rectangle-20-solid"
              label="Logout"
              @click="logout"
            />
          </div>
        </div>
      </div>
    </header>

    <main class="mx-auto max-w-4xl px-4 py-8 sm:px-6 lg:px-8">
      <div class="mb-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 class="text-2xl font-bold tracking-tight text-gray-900 sm:text-3xl dark:text-white">
            Tasks
          </h1>
          <p class="mt-1 text-sm text-gray-500 dark:text-gray-400">
            Your assigned forms. Complete them to track your progress.
          </p>
        </div>
        <NuxtLink to="/forms/new">
          <UButton icon="i-heroicons-plus-20-solid" size="lg"> Add New Form </UButton>
        </NuxtLink>
      </div>

      <div v-if="pending" class="space-y-4">
        <div
          v-for="i in 3"
          :key="i"
          class="rounded-xl border border-gray-200 bg-white p-6 dark:border-gray-800 dark:bg-gray-900"
        >
          <USkeleton class="mb-3 h-6 w-2/3" />
          <USkeleton class="h-4 w-full" />
          <USkeleton class="mt-4 h-3 w-1/2" />
        </div>
      </div>

      <UAlert
        v-else-if="error"
        icon="i-heroicons-exclamation-triangle-20-solid"
        color="error"
        variant="subtle"
        title="Error loading tasks"
        :description="error.message"
      />

      <div v-else class="space-y-4">
        <div
          v-for="task in tasks"
          :key="task.id"
          class="hover:border-primary-300 dark:hover:border-primary-700 rounded-xl border border-gray-200 bg-white p-6 shadow-sm transition dark:border-gray-800 dark:bg-gray-900"
        >
          <div class="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div class="min-w-0 flex-1">
              <h2 class="truncate text-lg font-semibold text-gray-900 dark:text-white">
                {{ task.title }}
              </h2>
              <p
                v-if="task.description"
                class="mt-1 line-clamp-2 text-sm text-gray-500 dark:text-gray-400"
              >
                {{ task.description }}
              </p>
              <div class="mt-2 flex items-center gap-2">
                <span
                  class="inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium"
                  :class="
                    task.status === 'COMPLETED'
                      ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-400'
                      : 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-400'
                  "
                >
                  {{ progressLabel(task) }}
                </span>
              </div>
            </div>
            <div class="flex shrink-0 items-center gap-3">
              <div
                v-if="task.status !== 'COMPLETED'"
                class="h-2 w-24 overflow-hidden rounded-full bg-gray-200 dark:bg-gray-700"
              >
                <div
                  class="bg-primary-500 h-full rounded-full transition-all"
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
          class="rounded-xl border border-dashed border-gray-300 bg-white p-12 text-center dark:border-gray-700 dark:bg-gray-900"
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
          <h2 class="mb-4 text-lg font-semibold text-gray-900 dark:text-white">Available forms</h2>
          <div class="space-y-4">
            <div
              v-for="f in availableForms"
              :key="f.id"
              class="rounded-xl border border-gray-200 bg-white p-6 dark:border-gray-800 dark:bg-gray-900"
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
