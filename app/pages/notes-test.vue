<script setup lang="ts">
  import { capitalizeName } from '~/utils/name'

  definePageMeta({ middleware: 'clients-admin' })

  const route = useRoute()

  const { data: clientsList, pending: clientsPending } = await useFetch<
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

  const clientId = computed(() => {
    const q = route.query.client
    if (typeof q === 'string' && q.length && clientPickerOptions.value.some((o) => o.id === q)) {
      return q
    }
    return clientPickerOptions.value[0]?.id ?? ''
  })

  const { data, pending, error } = await useFetch(
    () => `/api/clients/${clientId.value}/notes-editor-data`,
    {
      key: () => `notes-test-${clientId.value}`,
      watch: [clientId],
      getCachedData: () => undefined,
    }
  )
</script>

<template>
  <div
    v-if="clientsPending"
    class="flex min-h-screen items-center justify-center bg-gray-50 dark:bg-gray-950"
  >
    <UIcon name="i-heroicons-arrow-path" class="h-8 w-8 animate-spin text-primary-500" />
  </div>
  <UAlert
    v-else-if="!clientPickerOptions.length"
    class="m-6"
    icon="i-heroicons-information-circle-20-solid"
    color="neutral"
    variant="subtle"
    title="No clients"
    description="Add at least one client to use this page."
  >
    <template #actions>
      <UButton to="/clients" variant="soft" size="sm">Go to Clients</UButton>
    </template>
  </UAlert>
  <div
    v-else-if="clientId && pending"
    class="flex min-h-screen items-center justify-center bg-gray-50 dark:bg-gray-950"
  >
    <UIcon name="i-heroicons-arrow-path" class="h-8 w-8 animate-spin text-primary-500" />
  </div>
  <UAlert
    v-else-if="error"
    class="m-6"
    icon="i-heroicons-exclamation-triangle-20-solid"
    color="error"
    variant="subtle"
    title="Could not load notes"
    :description="error.message"
  />
  <Notes
    v-else-if="data"
    :key="data.client.id"
    :client="data.client"
    :current-note="data.currentNote"
    :previous-notes="data.previousNotes"
    :session-notes="data.sessionNotes"
    :forms="data.forms"
    :client-picker-options="clientPickerOptions"
    client-picker-mode="notes-test"
    back-href="/"
  />
</template>
