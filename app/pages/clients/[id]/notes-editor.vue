<script setup lang="ts">
  definePageMeta({ middleware: 'clients-admin' })

  const route = useRoute()
  const clientId = computed(() => route.params.id as string)
  const focusNoteId = computed(() => {
    const q = route.query.focus
    return typeof q === 'string' && q.length > 0 ? q : null
  })

  const { data, pending, error } = await useFetch(
    () => `/api/clients/${clientId.value}/notes-editor-data`,
    {
      key: () => `notes-editor-${clientId.value}`,
      watch: [clientId],
      getCachedData: () => undefined,
    }
  )
</script>

<template>
  <div v-if="pending" class="flex min-h-screen items-center justify-center bg-gray-50 dark:bg-gray-950">
    <UIcon name="i-heroicons-arrow-path" class="h-8 w-8 animate-spin text-primary-500" />
  </div>
  <UAlert
    v-else-if="error"
    class="m-6"
    icon="i-heroicons-exclamation-triangle-20-solid"
    color="error"
    variant="subtle"
    title="Could not load notes editor"
    :description="error.message"
  >
    <template #actions>
      <UButton to="/clients" variant="soft" size="sm">Back to Clients</UButton>
    </template>
  </UAlert>
  <Notes
    v-else-if="data"
    :client="data.client"
    :current-note="data.currentNote"
    :previous-notes="data.previousNotes"
    :session-notes="data.sessionNotes"
    :forms="data.forms"
    back-href="/clients"
    :initial-focus-note-id="focusNoteId"
  />
</template>
