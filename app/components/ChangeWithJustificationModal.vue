<script setup lang="ts">
  /**
   * Reusable modal for edits that require:
   * - Reasoning (text) OR valid documentation (PDF/Word)
   * - Admin digital signature
   *
   * Use for: absence edits, treatment plan changes, and any future changes
   * with the same requirements.
   */

  export interface ChangeJustificationPayload {
    reasoning?: string
    documentation?: File
    documentationBase64?: string
    signatureData: string
  }

  const props = withDefaults(
    defineProps<{
      open: boolean
      title: string
      description?: string
      /** e.g. 'absence', 'treatment plan' - for display hints */
      entityType?: string
      /** Callback to encode file to base64 before emit (optional) */
      submitLabel?: string
      loading?: boolean
      /** When true, only a digital signature is required (no reasoning or upload). */
      signatureOnly?: boolean
      /**
       * When true (and not signatureOnly), requires written reasoning and signature — no document upload.
       * Use for session note edits and similar.
       */
      requiresEditReason?: boolean
    }>(),
    {
      description: '',
      entityType: '',
      submitLabel: 'Confirm & Submit',
      loading: false,
      signatureOnly: false,
      requiresEditReason: false,
    }
  )

  const emit = defineEmits<{
    close: []
    submit: [payload: ChangeJustificationPayload]
  }>()

  const toast = useToast()

  const reasoning = ref('')
  const documentationFile = ref<File | null>(null)
  const documentationError = ref('')
  const signatureDataUrl = ref('')
  const signatureError = ref('')

  // Reset on open
  watch(
    () => props.open,
    (open) => {
      if (open) {
        reasoning.value = ''
        documentationFile.value = null
        documentationError.value = ''
        signatureDataUrl.value = ''
        signatureError.value = ''
      }
    }
  )

  const ACCEPTED_TYPES = [
    'application/pdf',
    'application/msword', // .doc
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document', // .docx
  ]

  const ACCEPTED_EXT = ['.pdf', '.doc', '.docx']

  function isAcceptedFile(file: File): boolean {
    return (
      ACCEPTED_TYPES.includes(file.type) ||
      ACCEPTED_EXT.some((ext) => file.name.toLowerCase().endsWith(ext))
    )
  }

  function onFileChange(e: Event) {
    const input = e.target as HTMLInputElement
    const file = input.files?.[0]
    documentationError.value = ''
    if (!file) {
      documentationFile.value = null
      return
    }
    if (!isAcceptedFile(file)) {
      documentationError.value = 'Please upload a PDF or Word document (.pdf, .doc, .docx)'
      documentationFile.value = null
      input.value = ''
      return
    }
    const maxSize = 10 * 1024 * 1024 // 10MB
    if (file.size > maxSize) {
      documentationError.value = 'File must be under 10MB'
      documentationFile.value = null
      input.value = ''
      return
    }
    documentationFile.value = file
  }

  function clearDocumentation() {
    documentationFile.value = null
    documentationError.value = ''
    if (docUploadRef.value) docUploadRef.value.value = ''
  }

  function hasJustification(): boolean {
    if (props.signatureOnly) return true
    if (props.requiresEditReason) return !!String(reasoning.value).trim()
    const hasReasoning = !!String(reasoning.value).trim()
    const hasDoc = !!documentationFile.value
    return hasReasoning || hasDoc
  }

  function hasValidSignature(): boolean {
    //return !!signatureDataUrl.value
    return !!signatureDataUrl.value && sigName.value.trim().length > 0
  }

  const docUploadRef = ref<HTMLInputElement | null>(null)
 
  // Font signature
  const SIG_FONTS = [
    { label: 'Classic', value: 'Dancing Script' },
    { label: 'Elegant', value: 'Great Vibes' },
    { label: 'Bold', value: 'Pacifico' },
    { label: 'Refined', value: 'Pinyon Script' },
    { label: 'Modern', value: 'Sacramento' },
  ]
  const sigName = ref('')
  const sigCredentials = ref('')
  const sigFont = ref('Dancing Script')
  const justSavedSig = ref(false)
  const savedSignature = ref<{ name: string; credentials: string; font: string } | null>(null)

  onMounted(() => {
    const saved = localStorage.getItem('epics_signature')
    if (saved) try { savedSignature.value = JSON.parse(saved) } catch {}
  })

  function updateSignatureData() {
    if (!sigName.value.trim()) { signatureDataUrl.value = ''; return }
    signatureDataUrl.value = JSON.stringify({
      type: 'font-signature',
      name: sigName.value.trim(),
      credentials: sigCredentials.value.trim(),
      font: sigFont.value,
    })
  }

  watch([sigName, sigCredentials, sigFont], updateSignatureData)

  function applySignature() {
    if (!savedSignature.value) return
    sigName.value = savedSignature.value.name
    sigCredentials.value = savedSignature.value.credentials
    sigFont.value = savedSignature.value.font
  }

  function saveDefaultSignature() {
    if (!sigName.value.trim()) return
    const sig = { name: sigName.value.trim(), credentials: sigCredentials.value.trim(), font: sigFont.value }
    savedSignature.value = sig
    localStorage.setItem('epics_signature', JSON.stringify(sig))
    justSavedSig.value = true
    setTimeout(() => { justSavedSig.value = false }, 2000)
  }

  async function fileToBase64(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader()
      reader.onload = () => resolve(String(reader.result))
      reader.onerror = reject
      reader.readAsDataURL(file)
    })
  }

  async function handleSubmit() {
    if (props.requiresEditReason && !String(reasoning.value).trim()) {
      toast.add({ title: 'Please provide a reason for this edit', color: 'error' })
      return
    }
    if (!props.signatureOnly && !props.requiresEditReason && !hasJustification()) {
      toast.add({ title: 'Please provide reasoning or upload documentation', color: 'error' })
      return
    }
    if (!hasValidSignature()) {
      signatureError.value = 'Please provide your signature'
      toast.add({ title: 'Please provide your digital signature', color: 'error' })
      return
    }

    let documentationBase64: string | undefined
    if (documentationFile.value) {
      try {
        documentationBase64 = await fileToBase64(documentationFile.value)
      } catch (e) {
        toast.add({ title: 'Failed to read document', color: 'error' })
        return
      }
    }

    emit('submit', {
      reasoning: String(reasoning.value).trim() || undefined,
      documentation: documentationFile.value ?? undefined,
      documentationBase64,
      signatureData: signatureDataUrl.value,
    })
  }
</script>

<template>
  <UModal
    :open="open"
    :title="title"
    :ui="{
      overlay: 'z-[200]',
      content: 'max-w-2xl w-full z-[210]',
      body: 'max-h-[85vh] overflow-y-auto p-6',
    }"
    @update:open="(v: boolean) => !v && emit('close')"
  >
    <template #body>
      <p v-if="description" class="mb-4 text-sm text-gray-500 dark:text-gray-400">
        {{ description }}
      </p>
      <p
        v-if="!signatureOnly && requiresEditReason"
        class="mb-4 text-sm font-medium text-gray-700 dark:text-gray-300"
      >
        Enter a reason for this edit and your digital signature below.
      </p>
      <p
        v-else-if="!signatureOnly"
        class="mb-4 text-sm font-medium text-gray-700 dark:text-gray-300"
      >
        For {{ entityType || 'this change' }}, you must provide <strong>either</strong> written
        reasoning <strong>or</strong> valid documentation (PDF/Word), and sign below.
      </p>

      <!-- Slot for any custom content (e.g. summary of what's changing) -->
      <div v-if="$slots.default" class="mb-4">
        <slot />
      </div>

      <template v-if="!signatureOnly">
        <!-- Reasoning -->
        <div class="mb-4">
          <label class="mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-300">
            <template v-if="requiresEditReason">
              Reason for edit <span class="text-red-500">*</span>
            </template>
            <template v-else> Reasoning (required if no document) </template>
          </label>
          <UTextarea
            v-model="reasoning"
            placeholder="Explain the reason for this change..."
            :rows="4"
            class="w-full"
          />
        </div>

        <!-- Or separator -->
        <p v-if="!requiresEditReason" class="mb-3 text-center text-sm text-gray-500">— or —</p>

        <!-- Documentation upload -->
        <div v-if="!requiresEditReason" class="mb-4">
          <label class="mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-300">
            Documentation (required if no reasoning)
          </label>
          <p class="mb-2 text-xs text-gray-500 dark:text-gray-400">
            PDF or Word document (.pdf, .doc, .docx) — max 10MB
          </p>
          <input
            ref="docUploadRef"
            type="file"
            accept=".pdf,.doc,.docx,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
            class="hidden"
            @change="onFileChange"
          />
          <div class="flex flex-wrap items-center gap-2">
            <UButton
              variant="outline"
              size="sm"
              icon="i-heroicons-document-plus"
              @click="docUploadRef?.click?.()"
            >
              Choose file
            </UButton>
            <span
              v-if="documentationFile"
              class="flex items-center gap-2 rounded-md border border-gray-200 bg-gray-50 px-2 py-1 text-sm dark:border-gray-700 dark:bg-gray-800"
            >
              <UIcon name="i-heroicons-document" class="h-4 w-4 text-gray-500" />
              {{ documentationFile.name }}
              <button
                type="button"
                class="text-gray-400 hover:text-red-600"
                aria-label="Remove file"
                @click="clearDocumentation"
              >
                <UIcon name="i-heroicons-x-mark" class="h-4 w-4" />
              </button>
            </span>
          </div>
          <p v-if="documentationError" class="mt-1 text-sm text-red-600 dark:text-red-400">
            {{ documentationError }}
          </p>
        </div>
      </template>
    
      <!-- Font-based signature -->
      <div class="mb-6">
        <label class="mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-300">
          Clinician signature <span class="text-red-500">*</span>
        </label>

        <!-- Saved signature apply banner -->
        <div
          v-if="savedSignature"
          class="mb-3 flex items-center justify-between rounded-xl border border-primary-200 bg-primary-50 px-3 py-2.5 dark:border-primary-800 dark:bg-primary-900/20"
        >
          <div class="min-w-0">
            <p class="text-xs font-semibold text-primary-700 dark:text-primary-300">Saved signature</p>
            <p class="mt-0.5 truncate text-xs text-primary-600 dark:text-primary-400">
              {{ savedSignature.name }}<span v-if="savedSignature.credentials">, {{ savedSignature.credentials }}</span>
            </p>
          </div>
          <button
            type="button"
            @click="applySignature"
            class="ml-3 shrink-0 rounded-lg bg-primary-500 px-3 py-1.5 text-xs font-semibold text-white hover:bg-primary-600 transition-colors"
          >
            Apply
          </button>
        </div>

        <!-- Two-column: inputs left, preview right -->
        <div class="grid grid-cols-2 gap-4">

          <!-- Left: inputs -->
          <div class="space-y-3">
            <!-- Name -->
            <div>
              <label class="mb-1 block text-xs font-medium text-gray-500 dark:text-gray-400">
                Name <span class="text-red-500">*</span>
              </label>
              <input
                v-model="sigName"
                type="text"
                placeholder="Full name"
                class="w-full rounded-xl border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-900 placeholder-gray-400 focus:border-primary-400 focus:outline-none focus:ring-2 focus:ring-primary-100 dark:border-gray-700 dark:bg-gray-800 dark:text-white dark:placeholder-gray-500"
              />
            </div>

            <!-- Credentials -->
            <div>
              <label class="mb-1 block text-xs font-medium text-gray-500 dark:text-gray-400">Credentials</label>
              <input
                v-model="sigCredentials"
                type="text"
                placeholder="e.g. LCSW, LPC"
                class="w-full rounded-xl border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-900 placeholder-gray-400 focus:border-primary-400 focus:outline-none focus:ring-2 focus:ring-primary-100 dark:border-gray-700 dark:bg-gray-800 dark:text-white dark:placeholder-gray-500"
              />
            </div>

            <!-- Font dropdown -->
            <div>
              <label class="mb-1 block text-xs font-medium text-gray-500 dark:text-gray-400">Signature font</label>
              <select
                v-model="sigFont"
                class="w-full rounded-xl border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-900 focus:border-primary-400 focus:outline-none focus:ring-2 focus:ring-primary-100 dark:border-gray-700 dark:bg-gray-800 dark:text-white"
              >
                <option v-for="font in SIG_FONTS" :key="font.value" :value="font.value">
                  {{ font.label }}
                </option>
              </select>
            </div>

            <!-- Save default -->
            <button
              type="button"
              @click="saveDefaultSignature"
              :disabled="!sigName.trim()"
              class="flex items-center gap-1.5 text-xs font-medium transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
              :class="justSavedSig ? 'text-green-600 dark:text-green-400' : 'text-primary-600 hover:text-primary-700 dark:text-primary-400'"
            >
              {{ justSavedSig ? '✓ Saved!' : 'Save as default signature' }}
            </button>
          </div>

          <!-- Right: preview -->
          <div class="flex flex-col">
            <p class="mb-1 text-xs font-medium text-gray-500 dark:text-gray-400">Preview</p>
            <div class="flex-1 rounded-2xl border border-gray-200 bg-gray-50 p-4 dark:border-gray-700 dark:bg-gray-800/50">
              
              <!-- Name in selected font -->
              <div
                :style="{ fontFamily: `'${sigFont}', cursive`, fontSize: '28px', lineHeight: '1.3' }"
                class="break-words text-gray-800 dark:text-gray-100"
              >
                {{ sigName || 'Your Name' }}
              </div>

              <!-- Signed by / credentials / date in normal font -->
              <div class="mt-3 space-y-1">
                <p class="text-xs font-medium text-gray-900 dark:text-white">
                  Signed by {{ sigName || '—' }}
                </p>
                <p class="text-xs font-medium text-gray-900 dark:text-white">
                  {{ sigCredentials || '—' }}
                </p>
                <p class="text-xs font-medium text-gray-600 dark:text-white">
                  {{ new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric', hour: 'numeric', minute: '2-digit' }) }}
                </p>
              </div>
            </div>
          </div>

        </div>

        <p v-if="signatureError" class="mt-2 text-sm text-red-600 dark:text-red-400">
          {{ signatureError }}
        </p>
      </div>
      
        <!-- Actions -->
        <div class="flex justify-end gap-2">
          <UButton variant="ghost" @click="emit('close')">Cancel</UButton>
          <UButton color="primary" :loading="loading" @click="handleSubmit">
            {{ submitLabel }}
          </UButton>
        </div>
    </template>
  </UModal>
</template>

<style scoped>
@import url('https://fonts.googleapis.com/css2?family=Dancing+Script:wght@600&family=Great+Vibes&family=Pacifico&family=Pinyon+Script&family=Sacramento&display=swap');
</style>
