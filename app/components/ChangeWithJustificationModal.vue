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
  }>(),
  { description: '', entityType: '', submitLabel: 'Confirm & Submit', loading: false }
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
      nextTick(() => initSignatureCanvas())
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
  return ACCEPTED_TYPES.includes(file.type) || ACCEPTED_EXT.some((ext) => file.name.toLowerCase().endsWith(ext))
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
  const hasReasoning = !!String(reasoning.value).trim()
  const hasDoc = !!documentationFile.value
  return hasReasoning || hasDoc
}

function hasValidSignature(): boolean {
  return !!signatureDataUrl.value
}

// Signature pad (canvas-based)
const sigCanvasRef = ref<HTMLCanvasElement | null>(null)
const docUploadRef = ref<HTMLInputElement | null>(null)
const isDrawing = ref(false)
const sigCtx = ref<CanvasRenderingContext2D | null>(null)

function initSignatureCanvas() {
  const canvas = sigCanvasRef.value
  if (!canvas) return
  const ctx = canvas.getContext('2d')
  if (!ctx) return
  sigCtx.value = ctx
  ctx.strokeStyle = '#111827'
  ctx.lineWidth = 2
  ctx.lineCap = 'round'
}

function getCanvasCoords(e: MouseEvent | TouchEvent): { x: number; y: number } {
  const canvas = sigCanvasRef.value
  if (!canvas) return { x: 0, y: 0 }
  const rect = canvas.getBoundingClientRect()
  if ('touches' in e) {
    const touch = e.touches[0]
    if (!touch) return { x: 0, y: 0 }
    return { x: touch.clientX - rect.left, y: touch.clientY - rect.top }
  }
  return { x: e.clientX - rect.left, y: e.clientY - rect.top }
}

function startDrawing(e: MouseEvent | TouchEvent) {
  e.preventDefault()
  const { x, y } = getCanvasCoords(e)
  sigCtx.value?.beginPath()
  sigCtx.value?.moveTo(x, y)
  isDrawing.value = true
  signatureError.value = ''
}

function draw(e: MouseEvent | TouchEvent) {
  e.preventDefault()
  if (!isDrawing.value) return
  const { x, y } = getCanvasCoords(e)
  sigCtx.value?.lineTo(x, y)
  sigCtx.value?.stroke()
}

function stopDrawing() {
  isDrawing.value = false
  const canvas = sigCanvasRef.value
  if (canvas) {
    signatureDataUrl.value = canvas.toDataURL('image/png')
  }
}

function clearSignature() {
  const canvas = sigCanvasRef.value
  const ctx = sigCtx.value
  if (!canvas || !ctx) return
  ctx.clearRect(0, 0, canvas.width, canvas.height)
  signatureDataUrl.value = ''
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
  if (!hasJustification()) {
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
      overlay: 'z-[60]',
      content: 'max-w-xl w-full z-[60]',
      body: 'max-h-[85vh] overflow-y-auto p-6',
    }"
    @update:open="(v: boolean) => !v && emit('close')"
  >
    <template #body>
      <p v-if="description" class="mb-4 text-sm text-gray-500 dark:text-gray-400">
        {{ description }}
      </p>
      <p class="mb-4 text-sm font-medium text-gray-700 dark:text-gray-300">
        For {{ entityType || 'this change' }}, you must provide <strong>either</strong> written
        reasoning <strong>or</strong> valid documentation (PDF/Word), and sign below.
      </p>

      <!-- Slot for any custom content (e.g. summary of what's changing) -->
      <div v-if="$slots.default" class="mb-4">
        <slot />
      </div>

      <!-- Reasoning -->
      <div class="mb-4">
        <label class="mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-300">
          Reasoning (required if no document)
        </label>
        <UTextarea
          v-model="reasoning"
          placeholder="Explain the reason for this change..."
          :rows="4"
          class="w-full"
        />
      </div>

      <!-- Or separator -->
      <p class="mb-3 text-center text-sm text-gray-500">— or —</p>

      <!-- Documentation upload -->
      <div class="mb-4">
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

      <!-- Digital signature -->
      <div class="mb-6">
        <label class="mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-300">
          Admin signature <span class="text-red-500">*</span>
        </label>
        <p class="mb-2 text-xs text-gray-500 dark:text-gray-400">
          Sign in the box below using your mouse or touchscreen.
        </p>
        <div
          class="relative h-32 w-full overflow-hidden rounded-lg border-2 border-dashed border-gray-300 bg-white dark:border-gray-600 dark:bg-gray-800"
          :class="{ 'border-red-400': signatureError }"
        >
          <canvas
            ref="sigCanvasRef"
            class="block h-32 w-full cursor-crosshair touch-none"
            width="400"
            height="128"
            @mousedown="startDrawing"
            @mousemove="draw"
            @mouseup="stopDrawing"
            @mouseleave="stopDrawing"
            @touchstart.prevent="startDrawing"
            @touchmove.prevent="draw"
            @touchend.prevent="stopDrawing"
          />
          <div
            v-if="!signatureDataUrl"
            class="pointer-events-none absolute inset-0 flex items-center justify-center text-sm text-gray-400"
          >
            Draw your signature here
          </div>
        </div>
        <div class="mt-1 flex items-center gap-2">
          <UButton variant="ghost" size="xs" @click="clearSignature">Clear signature</UButton>
          <p v-if="signatureError" class="text-sm text-red-600 dark:text-red-400">
            {{ signatureError }}
          </p>
        </div>
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
