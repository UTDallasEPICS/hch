<script setup lang="ts">
  definePageMeta({ middleware: 'clients-admin' })

  const route = useRoute()
  const clientId = computed(() => route.params.id as string)

  const {
    data: profile,
    pending,
    error,
    refresh,
  } = await useFetch(
    () => `/api/clients/${clientId.value}/profile`,
    {
      key: `client-profile-plan-${clientId.value}`,
      watch: [clientId],
      getCachedData: () => undefined,
    }
  )

  const planContent = ref('')
  const planSaving = ref(false)
  const toast = useToast()

  // Reset plan when switching to a different patient to avoid showing wrong plan
  watch(clientId, () => { planContent.value = '' })

  watch(
    () => profile.value?.plan?.content,
    (v) => { planContent.value = v ?? '' },
    { immediate: true }
  )

  // Page title shows which patient's plan is open
  useHead({
    title: () =>
      profile.value
        ? `Plan — ${[profile.value.fname, profile.value.lname].filter(Boolean).join(' ') || profile.value.name}`
        : 'Client Plan',
  })

  function displayName() {
    const p = profile.value
    if (!p) return ''
    if (p.lname) return `${p.fname} ${p.lname}`
    return p.fname || p.name
  }

  async function savePlan() {
    if (!clientId.value || planSaving.value) return
    try {
      planSaving.value = true
      const res = await $fetch<{ content: string }>(`/api/clients/${clientId.value}/plan`, {
        method: 'PUT',
        body: { content: planContent.value },
      })
      if (profile.value?.plan) profile.value.plan.content = res.content
      else if (profile.value) profile.value.plan = { content: res.content }
      toast.add({ title: 'Plan updated', color: 'success' })
      await refresh()
    } catch (e: unknown) {
      const msg = (e as { data?: { statusMessage?: string } })?.data?.statusMessage ?? 'Failed to update'
      toast.add({ title: 'Error', description: msg, color: 'error' })
    } finally {
      planSaving.value = false
    }
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
      title="Error loading plan"
      :description="error.message"
    >
      <template #actions>
        <UButton to="/clients" variant="soft" size="sm">Back to Clients</UButton>
      </template>
    </UAlert>

    <div v-else class="rounded-xl border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-800 dark:bg-gray-900">
      <div class="mb-4 rounded-lg border border-primary-200 bg-primary-50/50 px-4 py-2 dark:border-primary-800 dark:bg-primary-900/20">
        <p class="text-xs font-medium text-primary-700 dark:text-primary-400">Patient</p>
        <p class="text-lg font-semibold text-gray-900 dark:text-white">{{ displayName() || 'Unknown' }}</p>
      </div>
      <h1 class="text-xl font-semibold text-gray-900 dark:text-white">
        Treatment Plan
      </h1>
      <p class="mt-1 text-sm text-gray-500 dark:text-gray-400">
        This plan is unique to {{ displayName() || 'this patient' }}. Create or edit their treatment plan. Clients can view this if permitted.
      </p>
      <div class="mt-6">
        <UTextarea
          v-model="planContent"
          placeholder="Enter client plan..."
          :rows="16"
          class="w-full"
        />
        <UButton
          size="md"
          color="primary"
          class="mt-4"
          :loading="planSaving"
          @click="savePlan"
        >
          Save Plan
        </UButton>
      </div>
    </div>
  </main>
</template>
