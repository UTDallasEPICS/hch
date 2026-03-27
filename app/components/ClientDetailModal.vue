<script setup lang="ts">
  type ClientStatus = 'Prospective' | 'Waitlist' | 'Active' | 'Archived'
  type Permissions = { canViewScores: boolean; canViewNotes: boolean; canViewPlan: boolean }
  type ClientTask = {
    key: string
    name: string
    to: string
    answered: number
    total: number
    submitted: boolean
    score?: number | null
    severity?: string | null
  }
  type ClientMetric = { form: string; score?: number | null; severity?: string | null }
  type ClientSessionNote = { id: string; content: string; createdAt: string }
  type ClientPlan = { id: string; content: string; updatedAt: string } | null
  type ClientProfile = {
    id: string
    fname: string
    lname: string
    name: string
    email: string
    status: ClientStatus
    therapyWeek: number | null
    missedSessions: number
    tasks: ClientTask[]
    metrics: ClientMetric[]
    permissions: Permissions
    sessionNotes: ClientSessionNote[]
    plan: ClientPlan
  }

  /** Matches `/api/clients/[id]/profile` response shape used in this modal */
  interface ClientProfile {
    fname?: string | null
    lname?: string | null
    name?: string | null
    status: ClientStatus
    therapyWeek: number | null
    missedSessions: number
    permissions: {
      canViewScores: boolean
      canViewNotes: boolean
      canViewPlan: boolean
    }
    plan?: { content?: string | null } | null
    tasks: {
      key: string
      name: string
      answered: number
      total: number
      submitted: boolean
      score?: number | null
      severity?: string | null
    }[]
    sessionNotesRequests: {
      id: string
      requestKind: string
      status: string
      createdAt: string
    }[]
    sessionNotes: { id: string; content: string; createdAt: string }[]
  }

  const props = defineProps<{
    clientId: string | null
    open: boolean
  }>()

  const emit = defineEmits<{
    close: []
    refreshed: []
  }>()

  const profile = ref<ClientProfile | null>(null)
  const pending = ref(false)
  const error = ref<Error | null>(null)
  let profileLoadSeq = 0

  async function loadProfile() {
    if (!props.clientId) return
    const seq = ++profileLoadSeq
    pending.value = true
    error.value = null
    try {
      const data = await $fetch<ClientProfile>(`/api/clients/${props.clientId}/profile`)
      if (seq !== profileLoadSeq) return
      profile.value = data
    } catch (e) {
      if (seq !== profileLoadSeq) return
      error.value = e instanceof Error ? e : new Error(String(e))
      profile.value = null
    } finally {
      if (seq === profileLoadSeq) pending.value = false
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
    const raw = p.lname ? `${p.fname} ${p.lname}` : p.fname || p.name || ''
    return capitalizeName(String(raw))
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
  const justificationModalOpen = ref(false)
  const pendingAbsenceSave = ref(false)
  watch(
    () => profile.value?.missedSessions,
    (v) => {
      absencesValue.value = v ?? 0
    },
    { immediate: true }
  )

  async function saveAbsencesWithJustification(payload: {
    reasoning?: string
    documentationBase64?: string
    documentationFilename?: string
    signatureData: string
  }) {
    if (!props.clientId || absencesSaving.value) return
    try {
      absencesSaving.value = true
      justificationModalOpen.value = false
      const res = await $fetch<{ missedSessions: number }>(
        `/api/clients/${props.clientId}/absences`,
        {
          method: 'PATCH',
          body: {
            missedSessions: absencesValue.value,
            reasoning: payload.reasoning,
            documentationBase64: payload.documentationBase64,
            documentationFilename: payload.documentationFilename,
            signatureData: payload.signatureData,
          },
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

  function onAbsencesSaveClick() {
    const hasChanged = (profile.value?.missedSessions ?? 0) !== absencesValue.value
    if (hasChanged) {
      pendingAbsenceSave.value = true
      justificationModalOpen.value = true
    } else {
      absencesEditing.value = false
    }
  }

  function closeJustificationModal() {
    justificationModalOpen.value = false
    pendingAbsenceSave.value = false
  }

  function onJustificationSubmit(payload: {
    reasoning?: string
    documentation?: File
    documentationBase64?: string
    signatureData: string
  }) {
    if (pendingAbsenceSave.value) {
      saveAbsencesWithJustification({
        reasoning: payload.reasoning,
        documentationBase64: payload.documentationBase64,
        documentationFilename: payload.documentation?.name,
        signatureData: payload.signatureData,
      })
      pendingAbsenceSave.value = false
    }
  }

  function onJustificationClose() {
    justificationModalOpen.value = false
    pendingAbsenceSave.value = false
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
              <UButton
                size="sm"
                color="primary"
                :loading="absencesSaving"
                @click="onAbsencesSaveClick"
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

        <!-- Permissions -->
        <section>
          <h3 class="mb-3 flex items-center gap-2 text-sm font-semibold">
            <UIcon name="i-heroicons-shield-check" class="h-4 w-4" />
            Client Permissions
          </h3>
          <p class="mb-3 text-xs text-gray-500 dark:text-gray-400">
            Control what this client can see on their dashboard.
          </p>
          <div class="flex flex-wrap gap-4">
            <label class="flex cursor-pointer items-center gap-2">
              <UCheckbox v-model="perms.canViewScores" />
              <span class="text-sm">View their scores</span>
            </label>

            <label class="flex cursor-pointer items-center gap-2">
              <UCheckbox v-model="perms.canViewPlan" />
              <span class="text-sm">View their plan</span>
            </label>
          </div>
          <UButton
            size="sm"
            color="primary"
            variant="soft"
            class="mt-2"
            :loading="permsSaving"
            @click="savePermissions"
          >
            Save Permissions
          </UButton>
          <p class="mt-3 text-xs text-gray-500 dark:text-gray-400">
            Clients can also request notes via the dashboard; those requests are reviewed on the
            <NuxtLink
              to="/clients/session-notes-requests"
              class="text-primary-600 dark:text-primary-400 font-medium underline"
              >session note requests</NuxtLink
            >
            page.
          </p>
        </section>

        <section v-if="profile.sessionNotesRequests?.length">
          <h3 class="mb-3 flex items-center gap-2 text-sm font-semibold">
            <UIcon name="i-heroicons-clipboard-document-list" class="h-4 w-4" />
            Session note request log
          </h3>
          <ul class="space-y-2 text-sm text-gray-600 dark:text-gray-400">
            <li
              v-for="req in profile.sessionNotesRequests"
              :key="req.id"
              class="flex flex-wrap gap-2"
            >
              <span>{{ new Date(req.createdAt).toLocaleString() }}</span>
              <span>{{ req.requestKind === 'FULL' ? 'Full' : 'Summary' }}</span>
              <UBadge
                :color="
                  req.status === 'APPROVED'
                    ? 'success'
                    : req.status === 'REJECTED'
                      ? 'error'
                      : 'warning'
                "
                variant="subtle"
                size="xs"
              >
                {{ req.status }}
              </UBadge>
            </li>
          </ul>
        </section>

        <!-- Client Tasks -->
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
              <div class="mt-2 flex flex-wrap items-center justify-between gap-2">
                <p class="text-xs text-gray-500">{{ new Date(note.createdAt).toLocaleString() }}</p>
                <div class="flex flex-wrap items-center gap-3">
                  <NuxtLink
                    :to="`/clients/${clientId}/notes/${note.id}`"
                    target="_blank"
                    class="text-primary-600 hover:text-primary-700 dark:text-primary-400 text-xs font-medium"
                  >
                    Open in new tab
                  </NuxtLink>
                  <NuxtLink
                    :to="`/clients/${clientId}/notes-editor?focus=${encodeURIComponent(note.id)}`"
                    class="text-primary-600 hover:text-primary-700 dark:text-primary-400 text-xs font-medium"
                  >
                    Edit in editor
                  </NuxtLink>
                </div>
              </div>
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
              v-if="planContent"
              class="prose prose-sm dark:prose-invert line-clamp-3 max-w-none text-sm text-gray-700 dark:text-gray-300"
              v-html="parseMarkdown(planContent)"
            />
            <p v-else class="text-sm text-gray-500 italic dark:text-gray-400">No plan yet.</p>
          </div>
          <NuxtLink
            :to="`/clients/plan/${clientId}`"
            class="text-primary-600 hover:text-primary-700 dark:text-primary-400 mt-2 inline-flex items-center gap-1.5 text-sm font-medium"
          >
            Open plan page
            <UIcon name="i-heroicons-arrow-right" class="h-4 w-4" />
          </NuxtLink>
        </section>
      </div>
    </template>

    <Teleport to="body">
      <ChangeWithJustificationModal
        :open="justificationModalOpen"
        title="Justify change"
        description="This change requires a reason or supporting documentation, and your signature."
        entity-type="absence"
        submit-label="Confirm & save absences"
        :loading="absencesSaving"
        @close="closeJustificationModal"
        @submit="onJustificationSubmit"
      >
        <template v-if="pendingAbsenceSave">
          <p class="text-sm text-gray-600 dark:text-gray-400">
            Changing absences from <strong>{{ profile?.missedSessions ?? 0 }}</strong> to
            <strong>{{ absencesValue }}</strong
            >.
          </p>
        </template>
      </ChangeWithJustificationModal>
    </Teleport>
  </UModal>

  <Teleport to="body">
    <ChangeWithJustificationModal
      :open="justificationModalOpen"
      title="Justify change"
      description="This change requires a reason or supporting documentation, and your signature."
      entity-type="absence"
      submit-label="Confirm & save absences"
      :loading="absencesSaving"
      @close="onJustificationClose"
      @submit="onJustificationSubmit"
    >
      <template v-if="pendingAbsenceSave">
        <p class="text-sm text-gray-600 dark:text-gray-400">
          Changing absences from <strong>{{ profile?.missedSessions ?? 0 }}</strong> to
          <strong>{{ absencesValue }}</strong
          >.
        </p>
      </template>
    </ChangeWithJustificationModal>
  </Teleport>
</template>
