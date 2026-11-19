<script setup lang="ts">
  import type { FormError } from '@nuxt/ui'
  import { apiErrorMessage, formatHistoryDate, toDateInputValue } from '~/utils/history-dates'

  // Same limits as server/utils/medical-history.ts. The server stays the source of truth.
  const TEXT_MAX = 200
  const NOTES_MAX = 2000

  type Medication = {
    id: string
    name: string
    dosage: string
    frequency: string
    prescriber: string | null
    startDate: string
    endDate: string | null
    notes: string | null
  }

  const toast = useToast()

  const items = ref<Medication[]>([])
  const pending = ref(true)
  const loadError = ref('')

  async function load() {
    try {
      // The API already returns newest first (by start date).
      items.value = await $fetch<Medication[]>('/api/client/medication-history')
      loadError.value = ''
    } catch (err) {
      loadError.value = apiErrorMessage(err)
    } finally {
      pending.value = false
    }
  }

  onMounted(load)

  // Add and edit share one form. editingId is null when adding.
  const emptyForm = () => ({
    name: '',
    dosage: '',
    frequency: '',
    prescriber: '',
    startDate: '',
    endDate: '',
    notes: '',
  })
  const form = reactive(emptyForm())
  const formOpen = ref(false)
  const editingId = ref<string | null>(null)
  const saving = ref(false)
  const formError = ref('')

  function openAdd() {
    Object.assign(form, emptyForm())
    editingId.value = null
    formError.value = ''
    formOpen.value = true
  }

  function openEdit(m: Medication) {
    Object.assign(form, {
      name: m.name,
      dosage: m.dosage,
      frequency: m.frequency,
      prescriber: m.prescriber ?? '',
      startDate: toDateInputValue(m.startDate),
      endDate: toDateInputValue(m.endDate),
      notes: m.notes ?? '',
    })
    editingId.value = m.id
    formError.value = ''
    formOpen.value = true
  }

  // Instant feedback that mirrors the server rules. UForm shows each message
  // under the field with the matching `name`.
  function validate(): FormError[] {
    const errors: FormError[] = []
    if (!form.name.trim()) errors.push({ name: 'name', message: 'Name is required' })
    if (!form.dosage.trim()) errors.push({ name: 'dosage', message: 'Dosage is required' })
    if (!form.frequency.trim()) {
      errors.push({ name: 'frequency', message: 'Frequency is required' })
    }
    if (!form.startDate) errors.push({ name: 'startDate', message: 'Start date is required' })
    // "YYYY-MM-DD" strings sort the same way as the dates they represent.
    if (form.startDate && form.endDate && form.endDate < form.startDate) {
      errors.push({ name: 'endDate', message: 'End date cannot be before start date' })
    }
    return errors
  }

  async function save() {
    const isEdit = editingId.value !== null
    saving.value = true
    formError.value = ''
    const body = {
      name: form.name.trim(),
      dosage: form.dosage.trim(),
      frequency: form.frequency.trim(),
      prescriber: form.prescriber.trim() || null,
      startDate: form.startDate,
      endDate: form.endDate || null,
      notes: form.notes.trim() || null,
    }
    try {
      if (isEdit) {
        await $fetch(`/api/client/medication-history/${editingId.value}`, {
          method: 'PATCH',
          body,
        })
      } else {
        await $fetch('/api/client/medication-history', { method: 'POST', body })
      }
      formOpen.value = false
      toast.add({ title: isEdit ? 'Medication updated' : 'Medication added', color: 'success' })
      await load()
    } catch (err) {
      formError.value = apiErrorMessage(err)
    } finally {
      saving.value = false
    }
  }

  const deleteTarget = ref<Medication | null>(null)
  const deleting = ref(false)
  const deleteError = ref('')

  function askDelete(m: Medication) {
    deleteTarget.value = m
    deleteError.value = ''
  }

  async function confirmDelete() {
    if (!deleteTarget.value) return
    deleting.value = true
    deleteError.value = ''
    try {
      await $fetch(`/api/client/medication-history/${deleteTarget.value.id}`, {
        method: 'DELETE',
      })
      deleteTarget.value = null
      toast.add({ title: 'Medication removed', color: 'success' })
      await load()
    } catch (err) {
      deleteError.value = apiErrorMessage(err)
    } finally {
      deleting.value = false
    }
  }
</script>

<template>
  <section>
    <div class="mb-3 flex flex-wrap items-start justify-between gap-3">
      <div>
        <h2 class="text-lg font-semibold text-gray-900 dark:text-white">Medications</h2>
        <p class="mt-0.5 text-sm text-gray-600 dark:text-gray-400">
          Medicines you take now or have taken before.
        </p>
      </div>
      <UButton
        color="primary"
        icon="i-heroicons-plus-20-solid"
        label="Add medication"
        :disabled="pending || !!loadError"
        @click="openAdd"
      />
    </div>

    <div v-if="pending" class="space-y-2">
      <USkeleton class="h-20 w-full" />
      <USkeleton class="h-20 w-full" />
    </div>

    <UAlert
      v-else-if="loadError"
      color="error"
      variant="subtle"
      title="Could not load your medications"
      :description="loadError"
    >
      <template #actions>
        <UButton label="Try again" size="sm" variant="soft" @click="load" />
      </template>
    </UAlert>

    <div
      v-else-if="!items.length"
      class="rounded-lg border border-dashed border-gray-200 p-6 text-center text-sm text-gray-600 dark:border-gray-700 dark:text-gray-400"
    >
      No medications added yet.
    </div>

    <ul v-else class="space-y-3">
      <li
        v-for="m in items"
        :key="m.id"
        class="rounded-xl border border-gray-200 bg-white p-4 dark:border-gray-800 dark:bg-gray-900"
      >
        <div class="flex flex-wrap items-start justify-between gap-3">
          <div class="min-w-0">
            <p class="font-medium break-words text-gray-900 dark:text-white">{{ m.name }}</p>
            <p class="mt-1 text-sm text-gray-700 dark:text-gray-300">
              {{ m.dosage }} · {{ m.frequency }}
            </p>
            <p class="mt-1 text-sm text-gray-600 dark:text-gray-400">
              {{ formatHistoryDate(m.startDate) }} –
              {{ m.endDate ? formatHistoryDate(m.endDate) : 'Current' }}
            </p>
            <p v-if="m.prescriber" class="mt-1 text-sm text-gray-600 dark:text-gray-400">
              Prescribed by {{ m.prescriber }}
            </p>
            <p
              v-if="m.notes"
              class="mt-2 text-sm break-words whitespace-pre-wrap text-gray-600 dark:text-gray-400"
            >
              {{ m.notes }}
            </p>
          </div>
          <div class="flex shrink-0 gap-2">
            <UButton
              size="sm"
              variant="soft"
              color="primary"
              label="Edit"
              icon="i-heroicons-pencil-square-20-solid"
              @click="openEdit(m)"
            />
            <UButton
              size="sm"
              variant="soft"
              color="error"
              label="Remove"
              icon="i-heroicons-trash-20-solid"
              @click="askDelete(m)"
            />
          </div>
        </div>
      </li>
    </ul>

    <UModal
      :open="formOpen"
      :title="editingId ? 'Edit medication' : 'Add medication'"
      :ui="{ content: 'max-w-lg w-full' }"
      @update:open="(v: boolean) => !v && (formOpen = false)"
    >
      <template #body>
        <UForm :state="form" :validate="validate" class="space-y-4" @submit="save">
          <UFormField label="Medication name" name="name" required>
            <UInput v-model="form.name" :maxlength="TEXT_MAX" class="w-full" />
          </UFormField>
          <div class="grid gap-3 sm:grid-cols-2">
            <UFormField label="Dosage" name="dosage" required>
              <UInput
                v-model="form.dosage"
                :maxlength="TEXT_MAX"
                placeholder="For example, 50 mg"
                class="w-full"
              />
            </UFormField>
            <UFormField label="How often" name="frequency" required>
              <UInput
                v-model="form.frequency"
                :maxlength="TEXT_MAX"
                placeholder="For example, once a day"
                class="w-full"
              />
            </UFormField>
          </div>
          <UFormField label="Prescriber (optional)" name="prescriber">
            <UInput v-model="form.prescriber" :maxlength="TEXT_MAX" class="w-full" />
          </UFormField>
          <div class="grid gap-3 sm:grid-cols-2">
            <UFormField label="Start date" name="startDate" required>
              <UInput v-model="form.startDate" type="date" class="w-full" />
            </UFormField>
            <UFormField
              label="End date (optional)"
              name="endDate"
              help="Leave blank if you still take it."
            >
              <UInput
                v-model="form.endDate"
                type="date"
                :min="form.startDate || undefined"
                class="w-full"
              />
            </UFormField>
          </div>
          <UFormField label="Notes (optional)" name="notes">
            <UTextarea v-model="form.notes" :maxlength="NOTES_MAX" :rows="3" class="w-full" />
          </UFormField>

          <UAlert v-if="formError" color="error" variant="subtle" :description="formError" />

          <div class="flex justify-end gap-2">
            <UButton variant="ghost" :disabled="saving" @click="formOpen = false">Cancel</UButton>
            <UButton type="submit" color="primary" :loading="saving" :disabled="saving">
              {{ editingId ? 'Save changes' : 'Add medication' }}
            </UButton>
          </div>
        </UForm>
      </template>
    </UModal>

    <UModal
      :open="deleteTarget !== null"
      title="Remove medication"
      :ui="{ content: 'max-w-md w-full' }"
      @update:open="(v: boolean) => !v && !deleting && (deleteTarget = null)"
    >
      <template #body>
        <div class="space-y-4">
          <p class="text-sm text-gray-700 dark:text-gray-300">
            Remove <span class="font-medium">{{ deleteTarget?.name }}</span> from your list? This
            can't be undone.
          </p>
          <UAlert v-if="deleteError" color="error" variant="subtle" :description="deleteError" />
          <div class="flex justify-end gap-2">
            <UButton variant="ghost" :disabled="deleting" @click="deleteTarget = null">
              Cancel
            </UButton>
            <UButton color="error" :loading="deleting" :disabled="deleting" @click="confirmDelete">
              Remove
            </UButton>
          </div>
        </div>
      </template>
    </UModal>
  </section>
</template>
