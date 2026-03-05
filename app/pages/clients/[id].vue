<script setup lang="ts">
  definePageMeta({ middleware: 'clients-admin' })

  type ClientStatus = 'INCOMPLETE' | 'WAITLIST' | 'ACTIVE' | 'ARCHIVED'

  type Task = {
    key: string
    name: string
    to: string
    answered: number
    total: number
    submitted: boolean
    score?: number | null
    severity?: string | null
  }

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
      key: `client-profile-${clientId.value}`,
      watch: [clientId],
      getCachedData: () => undefined,
    }
  )

  function displayName() {
    const p = profile.value
    if (!p) return ''
    if (p.lname) return `${p.fname} ${p.lname}`
    return p.fname || p.name
  }

  function statusLabel(status: ClientStatus): string {
    const labels: Record<ClientStatus, string> = {
      INCOMPLETE: 'Incomplete',
      WAITLIST: 'Waitlist',
      ACTIVE: 'Active',
      ARCHIVED: 'Archived',
    }
    return labels[status]
  }

  const toast = useToast()

  // Expandable form answers
  const expandedFormKey = ref<string | null>(null)
  const formAnswers = ref<{
    formKey: string
    formName: string
    questions: { label: string; answer: string }[]
    submitted?: boolean
    score?: number | null
    severity?: string | null
  } | null>(null)
  const formAnswersLoading = ref(false)

  async function toggleFormAnswers(formKey: string) {
    if (expandedFormKey.value === formKey) {
      expandedFormKey.value = null
      formAnswers.value = null
      return
    }
    if (!clientId.value) return
    formAnswersLoading.value = true
    expandedFormKey.value = formKey
    try {
      formAnswers.value = await $fetch(`/api/clients/${clientId.value}/forms/${formKey}`)
    } catch (e) {
      toast.add({
        title: 'Error loading answers',
        description: (e as { data?: { statusMessage?: string } })?.data?.statusMessage ?? 'Failed to load form answers',
        color: 'error',
      })
      formAnswers.value = null
    } finally {
      formAnswersLoading.value = false
    }
  }

  // Absences counter
  const absencesEditing = ref(false)
  const absencesValue = ref(0)
  const absencesSaving = ref(false)

  watch(
    () => profile.value?.missedSessions,
    (v) => {
      absencesValue.value = v ?? 0
    },
    { immediate: true }
  )

  async function saveAbsences() {
    if (!clientId.value || absencesSaving.value) return
    try {
      absencesSaving.value = true
      const res = await $fetch<{ missedSessions: number }>(`/api/clients/${clientId.value}/absences`, {
        method: 'PATCH',
        body: { missedSessions: absencesValue.value },
      })
      profile.value && (profile.value.missedSessions = res.missedSessions)
      absencesEditing.value = false
      toast.add({ title: 'Absences updated', color: 'success' })
      await refresh()
    } catch (e: unknown) {
      const msg = (e as { data?: { statusMessage?: string } })?.data?.statusMessage ?? 'Failed to update'
      toast.add({ title: 'Error', description: msg, color: 'error' })
    } finally {
      absencesSaving.value = false
    }
  }
</script>

<template>
  <main class="mx-auto max-w-5xl px-4 py-8 sm:px-6 lg:px-8">
    <div class="mb-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
      <div class="flex items-center gap-4">
        <NuxtLink
          to="/clients"
          class="inline-flex items-center gap-1.5 text-sm font-medium text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white"
        >
          <UIcon name="i-heroicons-arrow-left" class="h-4 w-4" />
          Back to Clients
        </NuxtLink>
        <div>
          <h1 class="text-2xl font-bold tracking-tight text-gray-900 sm:text-3xl dark:text-white">
            {{ displayName() || 'Client' }}
          </h1>
          <p v-if="profile?.email" class="mt-1 text-sm text-gray-600 dark:text-gray-400">
            {{ profile.email }}
          </p>
        </div>
      </div>
    </div>

    <div v-if="pending" class="space-y-6">
      <USkeleton class="h-32 w-full rounded-xl" />
      <USkeleton class="h-48 w-full rounded-xl" />
    </div>

    <UAlert
      v-else-if="error"
      icon="i-heroicons-exclamation-triangle-20-solid"
      color="error"
      variant="subtle"
      title="Error loading client"
      :description="error.message"
    >
      <template #actions>
        <UButton to="/clients" variant="soft" size="sm">Back to Clients</UButton>
      </template>
    </UAlert>

    <div v-else-if="profile" class="space-y-6">
      <!-- Summary row: status, therapy week, absences -->
      <div
        class="flex flex-wrap items-center gap-4 rounded-xl border border-gray-200 bg-white p-4 shadow-sm dark:border-gray-800 dark:bg-gray-900"
      >
        <UBadge
          :color="
            profile.status === 'ACTIVE'
              ? 'success'
              : profile.status === 'ARCHIVED'
                ? 'neutral'
                : profile.status === 'WAITLIST'
                  ? 'primary'
                  : 'warning'
          "
          variant="soft"
          size="lg"
        >
          {{ statusLabel(profile.status as ClientStatus) }}
        </UBadge>
        <span
          v-if="profile.therapyWeek !== null"
          class="text-sm text-gray-600 dark:text-gray-400"
        >
          Week {{ profile.therapyWeek }} / 26
        </span>
        <!-- Absences counter -->
        <div class="flex items-center gap-2">
          <span class="text-sm font-medium text-gray-700 dark:text-gray-300">
            Absences:
          </span>
          <template v-if="absencesEditing">
            <UInput
              v-model.number="absencesValue"
              type="number"
              :min="0"
              size="sm"
              class="w-20"
            />
            <UButton
              size="sm"
              color="primary"
              :loading="absencesSaving"
              @click="saveAbsences"
            >
              Save
            </UButton>
            <UButton size="sm" variant="ghost" @click="absencesEditing = false">
              Cancel
            </UButton>
          </template>
          <template v-else>
            <span class="text-base font-semibold text-gray-900 dark:text-white">
              {{ profile.missedSessions }}
            </span>
            <UButton
              size="xs"
              variant="ghost"
              color="neutral"
              icon="i-heroicons-pencil-square"
              aria-label="Edit absences"
              @click="absencesEditing = true"
            />
          </template>
        </div>
      </div>

      <!-- Completed forms with scores and answers -->
      <section
        class="rounded-xl border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-800 dark:bg-gray-900"
      >
        <h2 class="mb-4 flex items-center gap-2 text-base font-semibold text-gray-900 dark:text-white">
          <UIcon name="i-heroicons-clipboard-document-list" class="h-5 w-5" />
          Completed Forms
        </h2>
        <p class="mb-4 text-sm text-gray-600 dark:text-gray-400">
          Click a form to view the client's answers.
        </p>
        <div class="space-y-1">
          <div
            v-for="task in profile.tasks"
            :key="task.key"
            class="rounded-lg border border-gray-200 dark:border-gray-700"
          >
            <button
              type="button"
              class="flex w-full items-center justify-between px-4 py-3 text-left transition-colors hover:bg-gray-50 dark:hover:bg-gray-800/50"
              @click="toggleFormAnswers(task.key)"
            >
              <span class="font-medium text-gray-900 dark:text-white">{{ task.name }}</span>
              <span class="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
                {{ task.submitted ? 'Submitted' : `${task.answered}/${task.total}` }}
                <span v-if="task.submitted && task.severity"> • {{ task.severity }}</span>
                <span v-else-if="task.submitted && task.score != null"> • Score: {{ task.score }}</span>
                <UIcon
                  :name="expandedFormKey === task.key ? 'i-heroicons-chevron-up' : 'i-heroicons-chevron-down'"
                  class="h-4 w-4 shrink-0"
                />
              </span>
            </button>
            <div
              v-if="expandedFormKey === task.key"
              class="border-t border-gray-200 bg-gray-50/50 p-4 dark:border-gray-700 dark:bg-gray-800/30"
            >
              <div v-if="formAnswersLoading" class="flex justify-center py-4">
                <UIcon name="i-heroicons-arrow-path" class="h-6 w-6 animate-spin text-gray-400" />
              </div>
              <div v-else-if="formAnswers" class="space-y-3">
                <div v-if="formAnswers.score != null || formAnswers.severity" class="mb-3 flex gap-3 text-sm">
                  <span v-if="formAnswers.score != null" class="font-medium">
                    Score: {{ formAnswers.score }}
                  </span>
                  <span v-if="formAnswers.severity" class="text-gray-600 dark:text-gray-400">
                    {{ formAnswers.severity }}
                  </span>
                </div>
                <div v-if="formAnswers.questions?.length" class="max-h-64 space-y-2 overflow-y-auto">
                  <div
                    v-for="(q, i) in formAnswers.questions"
                    :key="i"
                    class="rounded border border-gray-200 bg-white p-3 text-sm dark:border-gray-700 dark:bg-gray-900"
                  >
                    <p class="text-xs font-medium text-gray-500 dark:text-gray-400">{{ q.label }}</p>
                    <p class="mt-1 text-gray-900 dark:text-gray-100">{{ q.answer || '—' }}</p>
                  </div>
                </div>
                <p v-else class="text-sm text-gray-500">No answers yet.</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      <!-- Session notes -->
      <section
        class="rounded-xl border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-800 dark:bg-gray-900"
      >
        <h2 class="mb-4 flex items-center gap-2 text-base font-semibold text-gray-900 dark:text-white">
          <UIcon name="i-heroicons-document-text" class="h-5 w-5" />
          Session Notes
        </h2>
        <div v-if="profile.sessionNotes?.length" class="space-y-3">
          <div
            v-for="note in profile.sessionNotes"
            :key="note.id"
            class="rounded-lg border border-gray-200 bg-gray-50 p-4 dark:border-gray-700 dark:bg-gray-800"
          >
            <p class="whitespace-pre-wrap text-sm text-gray-900 dark:text-gray-100">
              {{ note.content }}
            </p>
            <div class="mt-2 flex items-center justify-between">
              <p class="text-xs text-gray-500 dark:text-gray-400">
                {{ new Date(note.createdAt).toLocaleString() }}
              </p>
              <NuxtLink
                :to="`/clients/${clientId}/notes/${note.id}`"
                target="_blank"
                class="text-xs font-medium text-primary-600 hover:text-primary-700 dark:text-primary-400"
              >
                Open in new tab
              </NuxtLink>
            </div>
          </div>
        </div>
        <p v-else class="text-sm text-gray-500 dark:text-gray-400">
          No session notes yet.
        </p>
      </section>
    </div>
  </main>
</template>
