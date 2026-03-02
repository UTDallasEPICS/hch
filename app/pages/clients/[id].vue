<script setup lang="ts">
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

  type Metric = {
    form: string
    score?: number | null
    severity?: string | null
  }

  type Permissions = {
    canViewScores: boolean
    canViewNotes: boolean
    canViewPlan: boolean
  }

  type SessionNote = { id: string; content: string; createdAt: string }
  type ClientPlan = { id: string; content: string; updatedAt: string } | null

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

  // Plan edit
  const planContent = ref('')
  const planEditing = ref(false)
  const planSaving = ref(false)

  watch(
    () => profile.value?.plan,
    (plan) => {
      planContent.value = plan?.content ?? ''
    },
    { immediate: true }
  )

  async function savePlan() {
    if (!clientId.value || planSaving.value) return
    try {
      planSaving.value = true
      await $fetch(`/api/clients/${clientId.value}/plan`, {
        method: 'PUT',
        body: { content: planContent.value },
      })
      planEditing.value = false
      toast.add({ title: 'Plan saved', color: 'success' })
      await refresh()
    } catch (e: unknown) {
      const msg = (e as { data?: { statusMessage?: string } })?.data?.statusMessage ?? 'Failed to save plan'
      toast.add({ title: 'Error', description: msg, color: 'error' })
    } finally {
      planSaving.value = false
    }
  }

  // Permissions
  const permEditing = ref(false)
  const permSaving = ref(false)
  const permForm = ref<Permissions>({
    canViewScores: false,
    canViewNotes: false,
    canViewPlan: false,
  })

  watch(
    () => profile.value?.permissions,
    (p) => {
      if (p) permForm.value = { ...p }
    },
    { immediate: true }
  )

  async function savePermissions() {
    if (!clientId.value || permSaving.value) return
    try {
      permSaving.value = true
      await $fetch(`/api/clients/${clientId.value}/permissions`, {
        method: 'PATCH',
        body: permForm.value,
      })
      permEditing.value = false
      toast.add({ title: 'Permissions saved', color: 'success' })
      await refresh()
    } catch (e: unknown) {
      const msg = (e as { data?: { statusMessage?: string } })?.data?.statusMessage ?? 'Failed to save'
      toast.add({ title: 'Error', description: msg, color: 'error' })
    } finally {
      permSaving.value = false
    }
  }

  // New session note
  const newNoteContent = ref('')
  const addingNote = ref(false)

  async function addNote() {
    if (!clientId.value || !newNoteContent.value.trim() || addingNote.value) return
    try {
      addingNote.value = true
      await $fetch(`/api/clients/${clientId.value}/notes`, {
        method: 'POST',
        body: { content: newNoteContent.value.trim() },
      })
      newNoteContent.value = ''
      toast.add({ title: 'Note added', color: 'success' })
      await refresh()
    } catch (e: unknown) {
      const msg = (e as { data?: { statusMessage?: string } })?.data?.statusMessage ?? 'Failed to add note'
      toast.add({ title: 'Error', description: msg, color: 'error' })
    } finally {
      addingNote.value = false
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

      <!-- Tasks (what client sees on their task page) -->
      <section
        class="rounded-xl border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-800 dark:bg-gray-900"
      >
        <h2 class="mb-4 flex items-center gap-2 text-base font-semibold text-gray-900 dark:text-white">
          <UIcon name="i-heroicons-clipboard-document-list" class="h-5 w-5" />
          Client Tasks (what they see)
        </h2>
        <div class="space-y-3">
          <div
            v-for="task in profile.tasks"
            :key="task.key"
            class="flex items-center justify-between rounded-lg border border-gray-100 px-4 py-3 dark:border-gray-800"
          >
            <span class="font-medium text-gray-900 dark:text-white">{{ task.name }}</span>
            <div class="flex items-center gap-3">
              <span class="text-sm text-gray-600 dark:text-gray-400">
                {{ task.submitted ? 'Submitted' : `${task.answered}/${task.total}` }}
                <span v-if="task.submitted && task.severity" class="ml-1">
                  • {{ task.severity }}
                </span>
                <span v-else-if="task.submitted && task.score != null" class="ml-1">
                  • Score: {{ task.score }}
                </span>
              </span>
            </div>
          </div>
        </div>
      </section>

      <!-- Form metrics (scores) -->
      <section
        v-if="profile.metrics?.length"
        class="rounded-xl border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-800 dark:bg-gray-900"
      >
        <h2 class="mb-4 flex items-center gap-2 text-base font-semibold text-gray-900 dark:text-white">
          <UIcon name="i-heroicons-chart-bar" class="h-5 w-5" />
          Form Metrics (scores)
        </h2>
        <div class="flex flex-wrap gap-4">
          <div
            v-for="m in profile.metrics"
            :key="m.form"
            class="rounded-lg border border-gray-200 bg-gray-50 px-4 py-3 dark:border-gray-700 dark:bg-gray-800"
          >
            <span class="text-sm font-medium text-gray-600 dark:text-gray-400">{{ m.form }}</span>
            <div class="mt-1 flex items-baseline gap-2">
              <span
                v-if="m.score != null"
                class="text-lg font-bold text-gray-900 dark:text-white"
              >
                {{ m.score }}
              </span>
              <span
                v-if="m.severity"
                class="text-sm text-gray-600 dark:text-gray-400"
              >
                {{ m.severity }}
              </span>
            </div>
          </div>
        </div>
      </section>

      <!-- Permissions -->
      <section
        class="rounded-xl border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-800 dark:bg-gray-900"
      >
        <h2 class="mb-4 flex items-center gap-2 text-base font-semibold text-gray-900 dark:text-white">
          <UIcon name="i-heroicons-shield-check" class="h-5 w-5" />
          Client Permissions
        </h2>
        <p class="mb-4 text-sm text-gray-600 dark:text-gray-400">
          Control what this client can see on their dashboard.
        </p>
        <template v-if="permEditing">
          <div class="space-y-3">
            <label class="flex items-center gap-2">
              <UCheckbox v-model="permForm.canViewScores" />
              <span class="text-sm">Can view scores</span>
            </label>
            <label class="flex items-center gap-2">
              <UCheckbox v-model="permForm.canViewNotes" />
              <span class="text-sm">Can view session notes</span>
            </label>
            <label class="flex items-center gap-2">
              <UCheckbox v-model="permForm.canViewPlan" />
              <span class="text-sm">Can view plan</span>
            </label>
          </div>
          <div class="mt-4 flex gap-2">
            <UButton
              color="primary"
              :loading="permSaving"
              @click="savePermissions"
            >
              Save
            </UButton>
            <UButton variant="ghost" @click="permEditing = false">Cancel</UButton>
          </div>
        </template>
        <template v-else>
          <div class="flex flex-wrap gap-4 text-sm">
            <UBadge
              :color="profile.permissions?.canViewScores ? 'success' : 'neutral'"
              variant="soft"
            >
              Scores: {{ profile.permissions?.canViewScores ? 'Yes' : 'No' }}
            </UBadge>
            <UBadge
              :color="profile.permissions?.canViewNotes ? 'success' : 'neutral'"
              variant="soft"
            >
              Notes: {{ profile.permissions?.canViewNotes ? 'Yes' : 'No' }}
            </UBadge>
            <UBadge
              :color="profile.permissions?.canViewPlan ? 'success' : 'neutral'"
              variant="soft"
            >
              Plan: {{ profile.permissions?.canViewPlan ? 'Yes' : 'No' }}
            </UBadge>
            <UButton size="sm" variant="outline" @click="permEditing = true">
              Edit
            </UButton>
          </div>
        </template>
      </section>

      <!-- Session notes -->
      <section
        class="rounded-xl border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-800 dark:bg-gray-900"
      >
        <h2 class="mb-4 flex items-center gap-2 text-base font-semibold text-gray-900 dark:text-white">
          <UIcon name="i-heroicons-document-text" class="h-5 w-5" />
          Session Notes
        </h2>
        <div class="mb-4 flex gap-2">
          <UTextarea
            v-model="newNoteContent"
            placeholder="Add a session note..."
            :rows="2"
            class="flex-1"
          />
          <UButton
            label="Add"
            color="primary"
            :loading="addingNote"
            :disabled="!newNoteContent.trim()"
            @click="addNote"
          />
        </div>
        <div v-if="profile.sessionNotes?.length" class="space-y-3">
          <div
            v-for="note in profile.sessionNotes"
            :key="note.id"
            class="rounded-lg border border-gray-200 bg-gray-50 p-4 dark:border-gray-700 dark:bg-gray-800"
          >
            <p class="whitespace-pre-wrap text-sm text-gray-900 dark:text-gray-100">
              {{ note.content }}
            </p>
            <p class="mt-2 text-xs text-gray-500 dark:text-gray-400">
              {{ new Date(note.createdAt).toLocaleString() }}
            </p>
          </div>
        </div>
        <p v-else class="text-sm text-gray-500 dark:text-gray-400">
          No session notes yet.
        </p>
      </section>

      <!-- Client plan -->
      <section
        class="rounded-xl border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-800 dark:bg-gray-900"
      >
        <h2 class="mb-4 flex items-center gap-2 text-base font-semibold text-gray-900 dark:text-white">
          <UIcon name="i-heroicons-clipboard-document-check" class="h-5 w-5" />
          Client Plan
        </h2>
        <template v-if="planEditing">
          <UTextarea
            v-model="planContent"
            placeholder="Enter client plan..."
            :rows="6"
            class="mb-4"
          />
          <div class="flex gap-2">
            <UButton
              color="primary"
              :loading="planSaving"
              @click="savePlan"
            >
              Save
            </UButton>
            <UButton variant="ghost" @click="planEditing = false">Cancel</UButton>
          </div>
        </template>
        <template v-else>
          <div
            v-if="profile.plan?.content"
            class="rounded-lg border border-gray-200 bg-gray-50 p-4 dark:border-gray-700 dark:bg-gray-800"
          >
            <p class="whitespace-pre-wrap text-sm text-gray-900 dark:text-gray-100">
              {{ profile.plan.content }}
            </p>
            <p class="mt-2 text-xs text-gray-500 dark:text-gray-400">
              Last updated {{ new Date(profile.plan.updatedAt).toLocaleString() }}
            </p>
          </div>
          <p v-else class="mb-4 text-sm text-gray-500 dark:text-gray-400">
            No plan yet.
          </p>
          <UButton size="sm" variant="outline" @click="planEditing = true">
            {{ profile.plan ? 'Edit' : 'Create' }} Plan
          </UButton>
        </template>
      </section>
    </div>
  </main>
</template>
