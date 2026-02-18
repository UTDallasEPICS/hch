<script setup lang="ts">
// ── Types ──────────────────────────────────────────────────────────────────

interface ExtractedField {
  id: string
  fieldIndex: number
  label: string
  type: string
  options: string | null        // JSON string
  pageNumber: number | null
  boundingBox: string | null    // JSON string
  elementIndex: number | null
  confidence: 'high' | 'low'
  isDeleted: boolean
}

interface DocumentUpload {
  id: string
  originalName: string
  mimeType: string
  storagePath: string
  sourceUrl: string | null
  status: string
  errorMessage: string | null
  extractedFields: ExtractedField[]
}

// ── State ─────────────────────────────────────────────────────────────────

const route = useRoute()
const router = useRouter()
const id = route.params.id as string

const { data: doc, error: fetchError, refresh } = await useFetch<DocumentUpload>(`/api/convert/${id}`)

// Local editable copy of the fields
const fields = ref<ExtractedField[]>([])
watchEffect(() => {
  if (doc.value?.extractedFields) {
    fields.value = doc.value.extractedFields.map((f) => ({ ...f }))
  }
})

const FIELD_TYPES = ['text', 'number', 'date', 'checkbox', 'dropdown', 'radio'] as const

// Save-as-form modal
const showSaveModal = ref(false)
const formTitle = ref('')
const formSlug = ref('')
const formDescription = ref('')
const saving = ref(false)
const saveError = ref('')

// Autosave debounce
let autosaveTimer: ReturnType<typeof setTimeout> | null = null
const autosaveStatus = ref<'idle' | 'saving' | 'saved' | 'error'>('idle')

// ── Derived helpers ────────────────────────────────────────────────────────

const isPdf = computed(() => doc.value?.mimeType === 'application/pdf')
const isGdoc = computed(() => doc.value?.mimeType === 'application/vnd.google-apps.document')
const activeFields = computed(() => fields.value.filter((f) => !f.isDeleted))
const lowConfidenceCount = computed(() => activeFields.value.filter((f) => f.confidence === 'low').length)
const emptyLabelCount = computed(() => activeFields.value.filter((f) => !f.label.trim()).length)

// Preview URL is always the Nuxt API route (works for both old and new uploads)
const previewUrl = computed(() => `/api/convert/${id}/preview`)

function parsedOptions(field: ExtractedField): string[] {
  if (!field.options) return []
  try { return JSON.parse(field.options) } catch { return [] }
}

function setOptions(field: ExtractedField, raw: string) {
  const arr = raw.split(',').map((s) => s.trim()).filter(Boolean)
  field.options = arr.length ? JSON.stringify(arr) : null
  scheduleAutosave()
}

// ── Autosave ────────────────────────────────────────────────────────────────

function scheduleAutosave() {
  if (autosaveTimer) clearTimeout(autosaveTimer)
  autosaveTimer = setTimeout(doAutosave, 800)
}

async function doAutosave() {
  autosaveStatus.value = 'saving'
  try {
    await $fetch(`/api/convert/${id}`, {
      method: 'PATCH',
      body: {
        fields: fields.value.map((f) => ({
          fieldId: f.id,
          label: f.label,
          type: f.type,
          options: f.options ? JSON.parse(f.options) : null,
          isDeleted: f.isDeleted,
        })),
      },
    })
    autosaveStatus.value = 'saved'
  } catch {
    autosaveStatus.value = 'error'
  }
}

// ── Field actions ─────────────────────────────────────────────────────────

function addField() {
  const maxIdx = fields.value.reduce((m, f) => Math.max(m, f.fieldIndex), -1)
  fields.value.push({
    id: `local_${Date.now()}`,
    fieldIndex: maxIdx + 1,
    label: '',
    type: 'text',
    options: null,
    pageNumber: null,
    boundingBox: null,
    elementIndex: null,
    confidence: 'high',
    isDeleted: false,
  })
  scheduleAutosave()
}

function deleteField(field: ExtractedField) {
  field.isDeleted = true
  scheduleAutosave()
}

function restoreField(field: ExtractedField) {
  field.isDeleted = false
  scheduleAutosave()
}

// ── Save as Form ──────────────────────────────────────────────────────────

function openSaveModal() {
  formTitle.value = doc.value?.originalName.replace(/\.[^.]+$/, '').replace(/[-_]/g, ' ') ?? ''
  formSlug.value = formTitle.value.toLowerCase().replace(/\s+/g, '-')
  formDescription.value = ''
  saveError.value = ''
  showSaveModal.value = true
}

watch(formTitle, (v) => {
  formSlug.value = v.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '')
})

async function saveAsForm() {
  if (!formTitle.value || !formSlug.value) {
    saveError.value = 'Title and slug are required.'
    return
  }
  saving.value = true
  saveError.value = ''
  // Flush current edits first
  await doAutosave()
  try {
    const res = await $fetch<{ slug: string }>(`/api/convert/${id}/save`, {
      method: 'POST',
      body: { title: formTitle.value, slug: formSlug.value, description: formDescription.value },
    })
    showSaveModal.value = false
    router.push(`/forms/${res.slug}`)
  } catch (e: unknown) {
    saveError.value = (e as { data?: { message?: string } })?.data?.message ?? 'Failed to save.'
  } finally {
    saving.value = false
  }
}

const typeIcons: Record<string, string> = {
  text: 'i-lucide-text',
  number: 'i-lucide-hash',
  date: 'i-lucide-calendar',
  checkbox: 'i-lucide-check-square',
  dropdown: 'i-lucide-chevron-down-circle',
  radio: 'i-lucide-circle-dot',
}
</script>

<template>
  <div class="min-h-screen bg-gray-50 dark:bg-gray-950">

    <!-- Loading / error states -->
    <div v-if="fetchError" class="flex items-center justify-center min-h-screen">
      <p class="text-red-600 dark:text-red-400">Failed to load document: {{ fetchError.message }}</p>
    </div>

    <div v-else-if="!doc" class="flex items-center justify-center min-h-screen">
      <UIcon name="i-lucide-loader-2" class="animate-spin h-8 w-8 text-primary-500" />
    </div>

    <template v-else>

      <!-- ── Top bar ──────────────────────────────────────────────────────── -->
      <header class="sticky top-0 z-20 bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-700 px-6 py-3 flex items-center justify-between gap-4">
        <div class="flex items-center gap-3 min-w-0">
          <NuxtLink to="/admin/convert" class="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 transition-colors">
            <UIcon name="i-lucide-arrow-left" class="h-5 w-5" />
          </NuxtLink>
          <div class="min-w-0">
            <h1 class="text-base font-semibold text-gray-900 dark:text-white truncate">{{ doc.originalName }}</h1>
            <p class="text-xs text-gray-400 dark:text-gray-500">
              {{ activeFields.length }} fields
              <span v-if="lowConfidenceCount > 0" class="text-amber-600 dark:text-amber-400 ml-2">
                · {{ lowConfidenceCount }} low-confidence
              </span>
            </p>
          </div>
        </div>

        <div class="flex items-center gap-3 shrink-0">
          <!-- Autosave indicator -->
          <span class="text-xs text-gray-400 dark:text-gray-500 flex items-center gap-1">
            <UIcon v-if="autosaveStatus === 'saving'" name="i-lucide-loader-2" class="animate-spin h-3 w-3" />
            <UIcon v-else-if="autosaveStatus === 'saved'" name="i-lucide-check" class="h-3 w-3 text-green-500" />
            <UIcon v-else-if="autosaveStatus === 'error'" name="i-lucide-x" class="h-3 w-3 text-red-500" />
            {{ autosaveStatus === 'saving' ? 'Saving…' : autosaveStatus === 'saved' ? 'Saved' : autosaveStatus === 'error' ? 'Save failed' : '' }}
          </span>

          <UButton size="sm" variant="outline" icon="i-lucide-plus" @click="addField">
            Add Field
          </UButton>
          <UButton
            size="sm"
            icon="i-lucide-save"
            :disabled="doc.status === 'saved'"
            @click="openSaveModal"
          >
            {{ doc.status === 'saved' ? 'Already Saved' : 'Save as Form' }}
          </UButton>
        </div>
      </header>

      <!-- ── Main split layout ───────────────────────────────────────────── -->
      <div class="flex h-[calc(100vh-57px)]">

        <!-- LEFT: Document preview -->
        <aside class="w-1/2 border-r border-gray-200 dark:border-gray-700 overflow-auto bg-white dark:bg-gray-900">
          <div class="p-4 border-b border-gray-100 dark:border-gray-700 flex items-center gap-2">
            <UIcon name="i-lucide-file-text" class="h-4 w-4 text-gray-400 dark:text-gray-500" />
            <span class="text-sm font-medium text-gray-700 dark:text-gray-200">Source Document</span>
          </div>

          <div class="p-4">
            <!-- PDF: embedded viewer -->
            <iframe
              v-if="isPdf"
              :src="previewUrl"
              class="w-full h-full min-h-[70vh] rounded-lg border border-gray-200 dark:border-gray-700"
            />

            <!-- Google Doc: iframe to the doc URL -->
            <iframe
              v-else-if="isGdoc && doc.sourceUrl"
              :src="`${doc.sourceUrl}?embedded=true`"
              class="w-full min-h-[70vh] rounded-lg border border-gray-200 dark:border-gray-700"
            />

            <!-- DOCX: show a preview notice -->
            <div v-else class="flex flex-col items-center justify-center min-h-[40vh] text-gray-400 dark:text-gray-500 gap-3">
              <UIcon name="i-lucide-file-text" class="h-16 w-16" />
              <p class="text-sm">Live preview is not available for Word documents.</p>
              <p class="text-xs">Review the extracted fields on the right →</p>
            </div>
          </div>
        </aside>

        <!-- RIGHT: Form Builder -->
        <main class="w-1/2 overflow-auto bg-gray-50 dark:bg-gray-950">
          <div class="p-6 space-y-3">

            <!-- Warning: low-confidence fields -->
            <div v-if="lowConfidenceCount > 0"
              class="flex items-start gap-2 bg-amber-50 dark:bg-amber-950/50 border border-amber-200 dark:border-amber-700 rounded-lg px-4 py-3 text-sm text-amber-800 dark:text-amber-300">
              <UIcon name="i-lucide-alert-triangle" class="h-4 w-4 mt-0.5 shrink-0" />
              <span>
                <strong>{{ lowConfidenceCount }} field{{ lowConfidenceCount > 1 ? 's' : '' }}</strong>
                marked low-confidence — no input area was detected nearby. Review carefully.
              </span>
            </div>

            <!-- Warning: empty labels -->
            <div v-if="emptyLabelCount > 0"
              class="flex items-start gap-2 bg-red-50 dark:bg-red-950/50 border border-red-200 dark:border-red-700 rounded-lg px-4 py-3 text-sm text-red-800 dark:text-red-300">
              <UIcon name="i-lucide-pencil-line" class="h-4 w-4 mt-0.5 shrink-0" />
              <span>
                <strong>{{ emptyLabelCount }} field{{ emptyLabelCount > 1 ? 's have' : ' has' }} no label text.</strong>
                The PDF may use an unusual font encoding. Fill in the labels manually using the source document as reference.
              </span>
            </div>

            <!-- Field cards -->
            <TransitionGroup name="field-list" tag="div" class="space-y-3">
              <div
                v-for="field in fields"
                :key="field.id"
                class="rounded-xl border p-4 space-y-3 transition-all bg-white dark:bg-gray-900"
                :class="{
                  'opacity-50 border-dashed border-gray-300 dark:border-gray-600': field.isDeleted,
                  'border-red-300 dark:border-red-700 bg-red-50/30 dark:bg-red-950/20': !field.isDeleted && !field.label.trim(),
                  'border-amber-300 dark:border-amber-600 bg-amber-50 dark:bg-amber-950/30': !field.isDeleted && field.label.trim() && field.confidence === 'low',
                  'border-gray-200 dark:border-gray-700': !field.isDeleted && field.label.trim() && field.confidence !== 'low',
                }"
              >
                <!-- Deleted overlay -->
                <div v-if="field.isDeleted" class="flex items-center justify-between">
                  <span class="text-sm text-gray-400 dark:text-gray-500 line-through">{{ field.label || '(empty)' }}</span>
                  <UButton size="xs" variant="ghost" icon="i-lucide-undo-2" @click="restoreField(field)">
                    Restore
                  </UButton>
                </div>

                <!-- Active field editor -->
                <template v-else>
                  <!-- Field header row -->
                  <div class="flex items-center gap-2">
                    <span class="text-xs font-mono text-gray-400 dark:text-gray-500 w-6 text-right shrink-0">
                      {{ field.fieldIndex + 1 }}
                    </span>

                    <!-- Confidence badge -->
                    <UBadge
                      :color="field.confidence === 'high' ? 'success' : 'warning'"
                      variant="subtle"
                      size="xs"
                    >
                      {{ field.confidence }}
                    </UBadge>

                    <!-- Source location hint -->
                    <span v-if="field.pageNumber" class="text-xs text-gray-400 dark:text-gray-500 ml-auto">
                      p.{{ field.pageNumber }}
                    </span>
                    <span v-else-if="field.elementIndex != null" class="text-xs text-gray-400 dark:text-gray-500 ml-auto">
                      elem #{{ field.elementIndex }}
                    </span>

                    <button
                      class="ml-auto text-gray-300 dark:text-gray-600 hover:text-red-400 dark:hover:text-red-400 transition-colors"
                      title="Remove field"
                      @click="deleteField(field)"
                    >
                      <UIcon name="i-lucide-trash-2" class="h-4 w-4" />
                    </button>
                  </div>

                  <!-- Label edit -->
                  <div>
                    <label class="text-xs font-medium text-gray-500 dark:text-gray-400 mb-1 flex items-center gap-1">
                      Label
                      <span v-if="!field.label.trim()" class="text-red-500 dark:text-red-400 text-xs font-normal">(required — fill from source doc)</span>
                    </label>
                    <input
                      v-model="field.label"
                      type="text"
                      placeholder="Question text…"
                      class="w-full px-3 py-2 text-sm text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 border rounded-lg focus:outline-none focus:ring-2 bg-white dark:bg-gray-800"
                      :class="field.label.trim()
                        ? 'border-gray-200 dark:border-gray-600 focus:ring-primary-400'
                        : 'border-red-300 dark:border-red-600 bg-red-50 dark:bg-red-950/30 focus:ring-red-400'"
                      @input="scheduleAutosave"
                    />
                  </div>

                  <!-- Type select -->
                  <div class="flex items-center gap-3">
                    <label class="text-xs font-medium text-gray-500 dark:text-gray-400 shrink-0">Type</label>
                    <div class="flex flex-wrap gap-1.5">
                      <button
                        v-for="t in FIELD_TYPES"
                        :key="t"
                        class="flex items-center gap-1 px-2 py-1 rounded-md text-xs border transition-colors"
                        :class="field.type === t
                          ? 'bg-primary-600 text-white border-primary-600'
                          : 'bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-300 border-gray-200 dark:border-gray-600 hover:border-primary-400'"
                        @click="field.type = t; scheduleAutosave()"
                      >
                        <UIcon :name="typeIcons[t] ?? 'i-lucide-text'" class="h-3 w-3" />
                        {{ t }}
                      </button>
                    </div>
                  </div>

                  <!-- Options (shown only for choice types) -->
                  <div v-if="['checkbox', 'dropdown', 'radio'].includes(field.type)">
                    <label class="text-xs font-medium text-gray-500 dark:text-gray-400 mb-1 block">
                      Options <span class="font-normal">(comma-separated)</span>
                    </label>
                    <input
                      :value="parsedOptions(field).join(', ')"
                      type="text"
                      placeholder="Option A, Option B, Option C"
                      class="w-full px-3 py-2 text-sm text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-400"
                      @input="setOptions(field, ($event.target as HTMLInputElement).value)"
                    />
                  </div>
                </template>
              </div>
            </TransitionGroup>

            <!-- Empty state -->
            <div v-if="activeFields.length === 0" class="text-center py-12 text-gray-400 dark:text-gray-500">
              <UIcon name="i-lucide-list-x" class="h-10 w-10 mx-auto mb-2" />
              <p class="text-sm">No active fields. Add one manually or check the source document.</p>
            </div>

            <!-- Add field button (bottom) -->
            <button
              class="w-full py-3 border-2 border-dashed border-gray-200 dark:border-gray-700 rounded-xl text-sm text-gray-400 dark:text-gray-500 hover:border-primary-400 hover:text-primary-600 dark:hover:text-primary-400 transition-colors"
              @click="addField"
            >
              + Add field
            </button>

          </div>
        </main>
      </div>

    </template>

    <!-- ── Save as Form Modal ─────────────────────────────────────────────── -->
    <UModal v-model:open="showSaveModal" :ui="{ width: 'max-w-lg' }">
      <template #header>
        <h2 class="text-lg font-semibold text-gray-900 dark:text-white">Save as Form</h2>
      </template>

      <div class="p-6 space-y-4">
        <div>
          <label class="text-sm font-medium text-gray-700 dark:text-gray-200 block mb-1">Form Title *</label>
          <input
            v-model="formTitle"
            type="text"
            placeholder="e.g. Patient Intake Form"
            class="w-full px-3 py-2 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
          />
        </div>

        <div>
          <label class="text-sm font-medium text-gray-700 dark:text-gray-200 block mb-1">Slug (URL key) *</label>
          <div class="flex items-center border border-gray-300 dark:border-gray-600 rounded-lg overflow-hidden text-sm">
            <span class="px-3 py-2 bg-gray-50 dark:bg-gray-700 text-gray-400 dark:text-gray-400 border-r border-gray-300 dark:border-gray-600 shrink-0">/forms/</span>
            <input
              v-model="formSlug"
              type="text"
              placeholder="patient-intake"
              class="flex-1 px-3 py-2 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 bg-white dark:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-primary-500"
            />
          </div>
        </div>

        <div>
          <label class="text-sm font-medium text-gray-700 dark:text-gray-200 block mb-1">Description <span class="font-normal text-gray-400 dark:text-gray-500">(optional)</span></label>
          <textarea
            v-model="formDescription"
            rows="2"
            placeholder="Brief description of this form…"
            class="w-full px-3 py-2 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 resize-none"
          />
        </div>

        <p v-if="saveError" class="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
          {{ saveError }}
        </p>

        <div class="flex gap-3 justify-end pt-2">
          <UButton variant="ghost" @click="showSaveModal = false">Cancel</UButton>
          <UButton :loading="saving" @click="saveAsForm">
            Create Form
          </UButton>
        </div>
      </div>
    </UModal>

  </div>
</template>

<style scoped>
.field-list-enter-active,
.field-list-leave-active { transition: all 0.2s ease; }
.field-list-enter-from,
.field-list-leave-to { opacity: 0; transform: translateY(-6px); }
</style>
