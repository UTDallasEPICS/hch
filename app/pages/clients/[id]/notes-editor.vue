<script setup lang="ts">
  import { capitalizeName } from '~/utils/name'

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

  const { data: clientsList } = await useFetch<
    { id: string; fname: string; lname: string; name: string }[]
  >('/api/clients', {
    getCachedData: () => undefined,
  })

  const clientPickerOptions = computed(() => {
    const list = clientsList.value
    if (!list?.length) return []
    return [...list]
      .map((c) => {
        const raw = c.lname ? `${c.fname} ${c.lname}` : c.fname || c.name || ''
        const label = capitalizeName(raw) || c.name?.trim() || 'Client'
        return { id: c.id, label }
      })
      .sort((a, b) => a.label.localeCompare(b.label, undefined, { sensitivity: 'base' }))
  })
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
    :key="data.client.id"
    :client="data.client"
    :current-note="data.currentNote"
    :previous-notes="data.previousNotes"
    :session-notes="data.sessionNotes"
    :forms="data.forms"
    :client-picker-options="clientPickerOptions"
    back-href="/clients"
    :initial-focus-note-id="focusNoteId"
  />
</template>
