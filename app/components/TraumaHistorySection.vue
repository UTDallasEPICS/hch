<script setup lang="ts">
  import type { FormError } from '@nuxt/ui'
  import {
    apiErrorMessage,
    formatHistoryDate,
    toDateInputValue,
    todayDateInputValue,
  } from '~/utils/history-dates'

  // Same limits as server/utils/medical-history.ts. The server stays the source of truth.
  const CATEGORY_MAX = 200
  const DESCRIPTION_MAX = 2000

  type TraumaEntry = {
    id: string
    category: string
    description: string
    approximateDate: string | null
  }

  const toast = useToast()

  const items = ref<TraumaEntry[]>([])
  const pending = ref(true)
  const loadError = ref('')

  async function load() {
    try {
      items.value = await $fetch<TraumaEntry[]>('/api/client/trauma-history')
      loadError.value = ''
    } catch (err) {
      loadError.value = apiErrorMessage(err)
    } finally {
      pending.value = false
    }
  }

  onMounted(load)

  // Add and edit share one form. editingId is null when adding.
  const emptyForm = () => ({ category: '', description: '', approximateDate: '' })
  const form = reactive(emptyForm())
  const formOpen = ref(false)
  const editingId = ref<string | null>(null)
  const saving = ref(false)
  const formError = ref('')
  // Set when the form opens, so the date picker can't go past today.
  const today = ref('')

  function openAdd() {
    Object.assign(form, emptyForm())
    editingId.value = null
    formError.value = ''
    today.value = todayDateInputValue()
    formOpen.value = true
  }

  function openEdit(entry: TraumaEntry) {
    Object.assign(form, {
      category: entry.category,
      description: entry.description,
      approximateDate: toDateInputValue(entry.approximateDate),
    })
    editingId.value = entry.id
    formError.value = ''
    today.value = todayDateInputValue()
    formOpen.value = true
  }

  // Instant feedback that mirrors the server rules.
  function validate(): FormError[] {
    const errors: FormError[] = []
    if (!form.category.trim()) {
      errors.push({ name: 'category', message: 'Please add a short category' })
    }
    if (!form.description.trim()) {
      errors.push({ name: 'description', message: 'Please add a description' })
    }
    if (form.approximateDate && form.approximateDate > todayDateInputValue()) {
      errors.push({ name: 'approximateDate', message: 'The date cannot be in the future' })
    }
    return errors
  }

  async function save() {
    const isEdit = editingId.value !== null
    saving.value = true
    formError.value = ''
    const body = {
      category: form.category.trim(),
      description: form.description.trim(),
      approximateDate: form.approximateDate || null,
    }
    try {
      if (isEdit) {
        await $fetch(`/api/client/trauma-history/${editingId.value}`, { method: 'PATCH', body })
      } else {
        await $fetch('/api/client/trauma-history', { method: 'POST', body })
      }
      formOpen.value = false
      toast.add({ title: isEdit ? 'Entry updated' : 'Entry saved', color: 'success' })
      await load()
    } catch (err) {
      formError.value = apiErrorMessage(err)
    } finally {
      saving.value = false
    }
  }

  const deleteTarget = ref<TraumaEntry | null>(null)
  const deleting = ref(false)
  const deleteError = ref('')

  function askDelete(entry: TraumaEntry) {
    deleteTarget.value = entry
    deleteError.value = ''
  }

  async function confirmDelete() {
    if (!deleteTarget.value) return
    deleting.value = true
    deleteError.value = ''
    try {
      await $fetch(`/api/client/trauma-history/${deleteTarget.value.id}`, { method: 'DELETE' })
      deleteTarget.value = null
      toast.add({ title: 'Entry removed', color: 'success' })
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
        <h2 class="text-lg font-semibold text-gray-900 dark:text-white">Trauma history</h2>
        <p class="mt-0.5 text-sm text-gray-600 dark:text-gray-400">
          Share only what you're comfortable sharing. You can change or remove an entry at any time.
        </p>
      </div>
      <UButton
        color="primary"
        icon="i-heroicons-plus-20-solid"
        label="Add entry"
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
      title="Could not load your trauma history"
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
      No entries added yet.
    </div>

    <ul v-else class="space-y-3">
      <li
        v-for="entry in items"
        :key="entry.id"
        class="rounded-xl border border-gray-200 bg-white p-4 dark:border-gray-800 dark:bg-gray-900"
      >
        <div class="flex flex-wrap items-start justify-between gap-3">
          <div class="min-w-0">
            <p class="font-medium break-words text-gray-900 dark:text-white">
              {{ entry.category }}
            </p>
            <p v-if="entry.approximateDate" class="mt-1 text-sm text-gray-600 dark:text-gray-400">
              Around {{ formatHistoryDate(entry.approximateDate) }}
            </p>
            <p
              class="mt-2 text-sm break-words whitespace-pre-wrap text-gray-700 dark:text-gray-300"
            >
              {{ entry.description }}
            </p>
          </div>
          <div class="flex shrink-0 gap-2">
            <UButton
              size="sm"
              variant="soft"
              color="primary"
              label="Edit"
              icon="i-heroicons-pencil-square-20-solid"
              @click="openEdit(entry)"
            />
            <UButton
              size="sm"
              variant="soft"
              color="error"
              label="Remove"
              icon="i-heroicons-trash-20-solid"
              @click="askDelete(entry)"
            />
          </div>
        </div>
      </li>
    </ul>

    <UModal
      :open="formOpen"
      :title="editingId ? 'Edit entry' : 'Add entry'"
      :ui="{ content: 'max-w-lg w-full' }"
      @update:open="(v: boolean) => !v && (formOpen = false)"
    >
      <template #body>
        <UForm :state="form" :validate="validate" class="space-y-4" @submit="save">
          <UFormField
            label="Category"
            name="category"
            required
            help="A few words, for example: accident, loss, illness."
          >
            <UInput v-model="form.category" :maxlength="CATEGORY_MAX" class="w-full" />
          </UFormField>
          <UFormField label="Description" name="description" required>
            <UTextarea
              v-model="form.description"
              :maxlength="DESCRIPTION_MAX"
              :rows="4"
              placeholder="As much or as little detail as you like"
              class="w-full"
            />
          </UFormField>
          <UFormField
            label="Approximate date (optional)"
            name="approximateDate"
            help="An estimate is fine."
          >
            <UInput v-model="form.approximateDate" type="date" :max="today" class="w-full" />
          </UFormField>

          <UAlert v-if="formError" color="error" variant="subtle" :description="formError" />

          <div class="flex justify-end gap-2">
            <UButton variant="ghost" :disabled="saving" @click="formOpen = false">Cancel</UButton>
            <UButton type="submit" color="primary" :loading="saving" :disabled="saving">
              {{ editingId ? 'Save changes' : 'Save entry' }}
            </UButton>
          </div>
        </UForm>
      </template>
    </UModal>

    <UModal
      :open="deleteTarget !== null"
      title="Remove entry"
      :ui="{ content: 'max-w-md w-full' }"
      @update:open="(v: boolean) => !v && !deleting && (deleteTarget = null)"
    >
      <template #body>
        <div class="space-y-4">
          <p class="text-sm text-gray-700 dark:text-gray-300">
            Remove this entry? This can't be undone.
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
