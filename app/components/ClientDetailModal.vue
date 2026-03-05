<script setup lang="ts">
  type ClientStatus = 'Prospective' | 'Waitlist' | 'Active' | 'Archived'
  type Permissions = { canViewScores: boolean; canViewNotes: boolean; canViewPlan: boolean }

  const props = defineProps<{
    clientId: string | null
    open: boolean
  }>()

  const emit = defineEmits<{
    close: []
    refreshed: []
  }>()

  const profile = ref<Record<string, unknown> | null>(null)
  const pending = ref(false)
  const error = ref<Error | null>(null)

  async function loadProfile() {
    if (!props.clientId) return
    pending.value = true
    error.value = null
    try {
      profile.value = await $fetch(`/api/clients/${props.clientId}/profile`)
    } catch (e) {
      error.value = e instanceof Error ? e : new Error(String(e))
      profile.value = null
    } finally {
      pending.value = false
    }
  }

  async function refresh() {
    await loadProfile()
  }

  watch(
    () => [props.open, props.clientId] as const,
    ([open, id]) => {
      if (open && id) loadProfile()
      else {
        profile.value = null
        expandedFormKey.value = null
        formAnswers.value = null
      }
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
      Prospective: 'Prospective',
      Waitlist: 'Waitlist',
      Active: 'Active',
      Archived: 'Archived',
    }
    return labels[status]
  }

  const toast = useToast()

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
    if (!props.clientId || planSaving.value) return
    try {
      planSaving.value = true
      await $fetch(`/api/clients/${props.clientId}/plan`, {
        method: 'PUT',
        body: { content: planContent.value },
      })
      planEditing.value = false
      toast.add({ title: 'Plan saved', color: 'success' })
      await refresh()
      emit('refreshed')
    } catch (e: unknown) {
      const msg =
        (e as { data?: { statusMessage?: string } })?.data?.statusMessage ?? 'Failed to save plan'
      toast.add({ title: 'Error', description: msg, color: 'error' })
    } finally {
      planSaving.value = false
    }
  }

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
    if (!props.clientId || permSaving.value) return
    try {
      permSaving.value = true
      await $fetch(`/api/clients/${props.clientId}/permissions`, {
        method: 'PATCH',
        body: permForm.value,
      })
      permEditing.value = false
      toast.add({ title: 'Permissions saved', color: 'success' })
      await refresh()
      emit('refreshed')
    } catch (e: unknown) {
      const msg =
        (e as { data?: { statusMessage?: string } })?.data?.statusMessage ?? 'Failed to save'
      toast.add({ title: 'Error', description: msg, color: 'error' })
    } finally {
      permSaving.value = false
    }
  }

  const newNoteContent = ref('')
  const addingNote = ref(false)
  async function addNote() {
    if (!props.clientId || !newNoteContent.value.trim() || addingNote.value) return
    try {
      addingNote.value = true
      await $fetch(`/api/clients/${props.clientId}/notes`, {
        method: 'POST',
        body: { content: newNoteContent.value.trim() },
      })
      newNoteContent.value = ''
      toast.add({ title: 'Note added', color: 'success' })
      await refresh()
      emit('refreshed')
    } catch (e: unknown) {
      const msg =
        (e as { data?: { statusMessage?: string } })?.data?.statusMessage ?? 'Failed to add note'
      toast.add({ title: 'Error', description: msg, color: 'error' })
    } finally {
      addingNote.value = false
    }
  }

  const absencesEditing = ref(false)
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
    if (!props.clientId) return
    formAnswersLoading.value = true
    expandedFormKey.value = formKey
    try {
      formAnswers.value = await $fetch(`/api/clients/${props.clientId}/forms/${formKey}`)
    } catch (e) {
      toast.add({
        title: 'Error loading answers',
        description:
          (e as { data?: { statusMessage?: string } })?.data?.statusMessage ??
          'Failed to load form answers',
        color: 'error',
      })
      formAnswers.value = null
    } finally {
      formAnswersLoading.value = false
    }
  }

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
    if (!props.clientId || absencesSaving.value) return
    try {
      absencesSaving.value = true
      const res = await $fetch<{ missedSessions: number }>(
        `/api/clients/${props.clientId}/absences`,
        {
          method: 'PATCH',
          body: { missedSessions: absencesValue.value },
        }
      )
      if (profile.value) profile.value.missedSessions = res.missedSessions
      absencesEditing.value = false
      toast.add({ title: 'Absences updated', color: 'success' })
      await refresh()
      emit('refreshed')
    } catch (e: unknown) {
      const msg =
        (e as { data?: { statusMessage?: string } })?.data?.statusMessage ?? 'Failed to update'
      toast.add({ title: 'Error', description: msg, color: 'error' })
    } finally {
      absencesSaving.value = false
    }
  }
</script>

<template>
  <UModal
    :open="open"
    :title="displayName() || 'Client Details'"
    :ui="{
      content: 'max-w-3xl w-full',
      body: 'max-h-[70vh] overflow-y-auto p-6',
    }"
    @update:open="(v: boolean) => !v && emit('close')"
  >
    <template #body>
      <div v-if="!clientId" class="py-8 text-center text-gray-500">No client selected.</div>
      <div v-else-if="pending" class="space-y-4 py-4">
        <USkeleton class="h-8 w-full" />
        <USkeleton class="h-24 w-full" />
        <USkeleton class="h-32 w-full" />
      </div>
      <UAlert
        v-else-if="error"
        icon="i-heroicons-exclamation-triangle-20-solid"
        color="error"
        variant="subtle"
        title="Error loading client"
        :description="error.message"
      />
      <div v-else-if="profile" class="space-y-6">
        <!-- Summary -->
        <div
          class="flex flex-wrap items-center gap-4 rounded-lg border border-gray-200 p-4 dark:border-gray-700"
        >
          <UBadge
            :color="
              profile.status === 'Active'
                ? 'success'
                : profile.status === 'Archived'
                  ? 'neutral'
                  : profile.status === 'Waitlist'
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
          <div class="flex items-center gap-2">
            <span class="text-sm font-medium">Absences:</span>
            <template v-if="absencesEditing">
              <UInput
                v-model.number="absencesValue"
                type="number"
                :min="0"
                size="sm"
                class="w-20"
              />
              <UButton size="sm" color="primary" :loading="absencesSaving" @click="saveAbsences"
                >Save</UButton
              >
              <UButton size="sm" variant="ghost" @click="absencesEditing = false">Cancel</UButton>
            </template>
            <template v-else>
              <span class="font-semibold">{{ profile.missedSessions }}</span>
              <UButton
                size="xs"
                variant="ghost"
                icon="i-heroicons-pencil-square"
                aria-label="Edit absences"
                @click="absencesEditing = true"
              />
            </template>
          </div>
        </div>

        <!-- Tasks -->
        <section>
          <h3 class="mb-3 flex items-center gap-2 text-sm font-semibold">
            <UIcon name="i-heroicons-clipboard-document-list" class="h-4 w-4" />
            Client Tasks
          </h3>
          <p class="mb-3 text-xs text-gray-500 dark:text-gray-400">
            Click a form to view the client's answers.
          </p>
          <div class="space-y-1">
            <div
              v-for="task in profile.tasks"
              :key="task.key"
              class="rounded border border-gray-200 dark:border-gray-700"
            >
              <button
                type="button"
                class="flex w-full items-center justify-between px-3 py-2.5 text-left transition-colors hover:bg-gray-50 dark:hover:bg-gray-800/50"
                @click="toggleFormAnswers(task.key)"
              >
                <span class="font-medium">{{ task.name }}</span>
                <span class="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
                  {{ task.submitted ? 'Submitted' : `${task.answered}/${task.total}` }}
                  <span v-if="task.submitted && task.severity"> • {{ task.severity }}</span>
                  <span v-else-if="task.submitted && task.score != null">
                    • Score: {{ task.score }}</span
                  >
                  <UIcon
                    :name="
                      expandedFormKey === task.key
                        ? 'i-heroicons-chevron-up'
                        : 'i-heroicons-chevron-down'
                    "
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
                  <div
                    v-if="formAnswers.score != null || formAnswers.severity"
                    class="mb-3 flex gap-3 text-sm"
                  >
                    <span v-if="formAnswers.score != null" class="font-medium">
                      Score: {{ formAnswers.score }}
                    </span>
                    <span v-if="formAnswers.severity" class="text-gray-600 dark:text-gray-400">
                      {{ formAnswers.severity }}
                    </span>
                  </div>
                  <div
                    v-if="formAnswers.questions?.length"
                    class="max-h-64 space-y-2 overflow-y-auto"
                  >
                    <div
                      v-for="(q, i) in formAnswers.questions"
                      :key="i"
                      class="rounded border border-gray-200 bg-white p-3 text-sm dark:border-gray-700 dark:bg-gray-900"
                    >
                      <p class="text-xs font-medium text-gray-500 dark:text-gray-400">
                        {{ q.label }}
                      </p>
                      <p class="mt-1 text-gray-900 dark:text-gray-100">{{ q.answer || '—' }}</p>
                    </div>
                  </div>
                  <p v-else class="text-sm text-gray-500">No answers yet.</p>
                </div>
              </div>
            </div>
          </div>
        </section>

        <!-- Metrics -->
        <section v-if="profile.metrics?.length">
          <h3 class="mb-3 flex items-center gap-2 text-sm font-semibold">
            <UIcon name="i-heroicons-chart-bar" class="h-4 w-4" />
            Form Metrics
          </h3>
          <div class="flex flex-wrap gap-3">
            <div
              v-for="m in profile.metrics"
              :key="m.form"
              class="rounded border border-gray-200 bg-gray-50 px-3 py-2 dark:border-gray-700 dark:bg-gray-800"
            >
              <span class="text-xs font-medium text-gray-500">{{ m.form }}</span>
              <div class="flex items-baseline gap-2">
                <span v-if="m.score != null" class="text-lg font-bold">{{ m.score }}</span>
                <span v-if="m.severity" class="text-sm text-gray-600">{{ m.severity }}</span>
              </div>
            </div>
          </div>
        </section>

        <!-- Permissions -->
        <section>
          <h3 class="mb-3 flex items-center gap-2 text-sm font-semibold">
            <UIcon name="i-heroicons-shield-check" class="h-4 w-4" />
            Permissions
          </h3>
          <template v-if="permEditing">
            <div class="space-y-2">
              <label class="flex items-center gap-2"
                ><UCheckbox v-model="permForm.canViewScores" /><span class="text-sm"
                  >Scores</span
                ></label
              >
              <label class="flex items-center gap-2"
                ><UCheckbox v-model="permForm.canViewNotes" /><span class="text-sm"
                  >Notes</span
                ></label
              >
              <label class="flex items-center gap-2"
                ><UCheckbox v-model="permForm.canViewPlan" /><span class="text-sm"
                  >Plan</span
                ></label
              >
            </div>
            <div class="mt-3 flex gap-2">
              <UButton color="primary" :loading="permSaving" @click="savePermissions">Save</UButton>
              <UButton variant="ghost" @click="permEditing = false">Cancel</UButton>
            </div>
          </template>
          <template v-else>
            <div class="flex flex-wrap gap-2">
              <UBadge
                :color="profile.permissions?.canViewScores ? 'success' : 'neutral'"
                variant="soft"
                >Scores: {{ profile.permissions?.canViewScores ? 'Yes' : 'No' }}</UBadge
              >
              <UBadge
                :color="profile.permissions?.canViewNotes ? 'success' : 'neutral'"
                variant="soft"
                >Notes: {{ profile.permissions?.canViewNotes ? 'Yes' : 'No' }}</UBadge
              >
              <UBadge
                :color="profile.permissions?.canViewPlan ? 'success' : 'neutral'"
                variant="soft"
                >Plan: {{ profile.permissions?.canViewPlan ? 'Yes' : 'No' }}</UBadge
              >
              <UButton size="sm" variant="outline" @click="permEditing = true">Edit</UButton>
            </div>
          </template>
        </section>

        <!-- Session notes -->
        <section>
          <h3 class="mb-3 flex items-center gap-2 text-sm font-semibold">
            <UIcon name="i-heroicons-document-text" class="h-4 w-4" />
            Session Notes
          </h3>
          <div class="mb-3 flex gap-2">
            <UTextarea
              v-model="newNoteContent"
              placeholder="Add note..."
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
          <div v-if="profile.sessionNotes?.length" class="space-y-2">
            <div
              v-for="note in profile.sessionNotes"
              :key="note.id"
              class="rounded border border-gray-200 bg-gray-50 p-3 dark:border-gray-700 dark:bg-gray-800"
            >
              <p class="text-sm whitespace-pre-wrap">{{ note.content }}</p>
              <p class="mt-1 text-xs text-gray-500">
                {{ new Date(note.createdAt).toLocaleString() }}
              </p>
            </div>
          </div>
          <p v-else class="text-sm text-gray-500">No notes yet.</p>
        </section>

        <!-- Plan -->
        <section>
          <h3 class="mb-3 flex items-center gap-2 text-sm font-semibold">
            <UIcon name="i-heroicons-clipboard-document-check" class="h-4 w-4" />
            Client Plan
          </h3>
          <template v-if="planEditing">
            <UTextarea v-model="planContent" placeholder="Enter plan..." :rows="4" class="mb-3" />
            <div class="flex gap-2">
              <UButton color="primary" :loading="planSaving" @click="savePlan">Save</UButton>
              <UButton variant="ghost" @click="planEditing = false">Cancel</UButton>
            </div>
          </template>
          <template v-else>
            <div
              v-if="profile.plan?.content"
              class="rounded border border-gray-200 bg-gray-50 p-3 dark:border-gray-700 dark:bg-gray-800"
            >
              <p class="text-sm whitespace-pre-wrap">{{ profile.plan.content }}</p>
              <p class="mt-1 text-xs text-gray-500">
                Updated {{ new Date(profile.plan.updatedAt).toLocaleString() }}
              </p>
            </div>
            <p v-else class="mb-2 text-sm text-gray-500">No plan yet.</p>
            <UButton size="sm" variant="outline" @click="planEditing = true"
              >{{ profile.plan ? 'Edit' : 'Create' }} Plan</UButton
            >
          </template>
        </section>
      </div>
    </template>
  </UModal>
</template>
