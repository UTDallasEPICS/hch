<script setup lang="ts">
  import { capitalizeName } from '~/utils/name'

  definePageMeta({ middleware: 'clients-admin' })

  const route = useRoute()
  const clientId = computed(() => route.params.id as string)
  const noteId = computed(() => route.params.noteId as string)

  const {
    data: profile,
    pending,
    error,
  } = await useFetch(
    () => `/api/clients/${clientId.value}/profile`,
    {
      key: `client-profile-notes-${clientId.value}`,
      watch: [clientId],
      getCachedData: () => undefined,
    }
  )

  const note = computed(() => {
    const notes = profile.value?.sessionNotes ?? []
    return notes.find((n: { id: string }) => n.id === noteId.value)
  })

  function displayName() {
    const p = profile.value
    if (!p) return ''
    const raw = p.lname ? `${p.fname} ${p.lname}` : (p.fname || p.name || '')
    return capitalizeName(raw)
  }
</script>

<template>
  <main class="mx-auto max-w-3xl px-4 py-8 sm:px-6 lg:px-8">
    <div class="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
      <NuxtLink
        to="/clients"
        class="inline-flex items-center gap-1.5 text-sm font-medium text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white"
      >
        <UIcon name="i-heroicons-arrow-left" class="h-4 w-4" />
        Back to Clients
      </NuxtLink>
    </div>

    <div v-if="pending" class="space-y-4">
      <USkeleton class="h-8 w-48" />
      <USkeleton class="h-4 w-32" />
      <USkeleton class="h-64 w-full" />
    </div>

    <UAlert
      v-else-if="error"
      icon="i-heroicons-exclamation-triangle-20-solid"
      color="error"
      variant="subtle"
      title="Error loading note"
      :description="error.message"
    >
      <template #actions>
        <UButton to="/clients" variant="soft" size="sm">Back to Clients</UButton>
      </template>
    </UAlert>

    <div v-else-if="!note" class="rounded-xl border border-gray-200 bg-white p-8 dark:border-gray-800 dark:bg-gray-900">
      <p class="text-gray-500 dark:text-gray-400">Note not found.</p>
      <UButton to="/clients" variant="soft" size="sm" class="mt-4">
        Back to Clients
      </UButton>
    </div>

    <div v-else class="rounded-xl border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-800 dark:bg-gray-900">
      <h1 class="text-xl font-semibold text-gray-900 dark:text-white">
        Session Note — {{ displayName() }}
      </h1>
      <p class="mt-1 text-sm text-gray-500 dark:text-gray-400">
        {{ new Date(note.createdAt).toLocaleString() }}
      </p>
      <div class="mt-6 rounded-lg border border-gray-200 bg-gray-50 p-4 dark:border-gray-700 dark:bg-gray-800">
        <p class="whitespace-pre-wrap text-gray-900 dark:text-gray-100">{{ note.content }}</p>
      </div>
    </div>
  </main>
</template>
