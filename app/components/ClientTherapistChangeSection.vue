<script setup lang="ts">
  // #182: client asks for a new therapist. They keep their current one until
  // an admin reassigns them from the clinician reassignment queue.
  type RequestState = {
    hasClinician: boolean
    requestedAt: string | null
    reason: string | null
  }

  const MAX_REASON_LENGTH = 1000
  const toast = useToast()

  const { data: state, error } = await useFetch<RequestState>('/api/client/reassignment-request', {
    getCachedData: () => undefined,
  })

  const formOpen = ref(false)
  const reason = ref('')
  const saving = ref(false)

  function errorMessage(e: unknown, fallback: string) {
    return (e as { data?: { statusMessage?: string } })?.data?.statusMessage ?? fallback
  }

  async function submit() {
    if (saving.value) return
    try {
      saving.value = true
      state.value = await $fetch<RequestState>('/api/client/reassignment-request', {
        method: 'POST',
        body: { reason: reason.value },
      })
      formOpen.value = false
      reason.value = ''
      toast.add({
        title: 'Request sent',
        description: 'An admin will match you with a new therapist.',
        color: 'success',
      })
    } catch (e: unknown) {
      toast.add({
        title: 'Error',
        description: errorMessage(e, 'Could not send request'),
        color: 'error',
      })
    } finally {
      saving.value = false
    }
  }

  async function cancel() {
    if (saving.value) return
    try {
      saving.value = true
      state.value = await $fetch<RequestState>('/api/client/reassignment-request', {
        method: 'DELETE',
      })
      toast.add({ title: 'Request cancelled', color: 'success' })
    } catch (e: unknown) {
      toast.add({
        title: 'Error',
        description: errorMessage(e, 'Could not cancel request'),
        color: 'error',
      })
    } finally {
      saving.value = false
    }
  }
</script>

<template>
  <!-- Hidden when the client has no therapist yet: they're already waiting on an admin. -->
  <section v-if="!error && state?.hasClinician" class="mt-8">
    <div class="mb-3">
      <h2 class="text-lg font-semibold text-gray-900 dark:text-white">Your therapist</h2>
      <p class="mt-0.5 text-sm text-gray-600 dark:text-gray-400">
        If your current therapist isn't the right fit, you can ask to be matched with someone else.
      </p>
    </div>

    <div
      class="rounded-xl border border-gray-200 bg-white p-5 shadow-sm dark:border-gray-800 dark:bg-gray-900"
    >
      <template v-if="state.requestedAt">
        <p class="text-sm text-gray-900 dark:text-white">
          You asked for a new therapist on
          {{ new Date(state.requestedAt).toLocaleDateString() }}.
        </p>
        <p class="mt-1 text-sm text-gray-600 dark:text-gray-400">
          You'll keep seeing your current therapist until an admin assigns your new one.
        </p>
        <UButton
          class="mt-4"
          size="sm"
          color="neutral"
          variant="soft"
          :loading="saving"
          @click="cancel"
        >
          Cancel request
        </UButton>
      </template>

      <template v-else-if="formOpen">
        <UFormField
          label="Anything you'd like us to know? (optional)"
          :hint="`${reason.length}/${MAX_REASON_LENGTH}`"
        >
          <UTextarea
            v-model="reason"
            :rows="3"
            :maxlength="MAX_REASON_LENGTH"
            class="w-full"
            placeholder="For example, what you're looking for in a therapist"
          />
        </UFormField>
        <div class="mt-4 flex flex-wrap gap-2">
          <UButton size="sm" color="primary" :loading="saving" @click="submit">
            Send request
          </UButton>
          <UButton
            size="sm"
            color="neutral"
            variant="ghost"
            :disabled="saving"
            @click="formOpen = false"
          >
            Never mind
          </UButton>
        </div>
      </template>

      <UButton v-else size="sm" color="primary" variant="soft" @click="formOpen = true">
        Request a new therapist
      </UButton>
    </div>
  </section>
</template>
