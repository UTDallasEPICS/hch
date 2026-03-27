<script setup lang="ts">
  const props = defineProps<{
    open: boolean
    loading?: boolean
  }>()

  const emit = defineEmits<{
    close: []
    submit: [payload: { requestKind: 'FULL' | 'SUMMARY'; signatureData: string }]
  }>()

  const toast = useToast()

  const requestKind = ref<'FULL' | 'SUMMARY'>('FULL')
  const declarationAccepted = ref(false)
  const signatureDataUrl = ref('')
  const signatureError = ref('')

  watch(
    () => props.open,
    (open) => {
      if (open) {
        requestKind.value = 'FULL'
        declarationAccepted.value = false
        signatureDataUrl.value = ''
        signatureError.value = ''
        nextTick(() => initSignatureCanvas())
      }
    }
  )

  const sigCanvasRef = ref<HTMLCanvasElement | null>(null)
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

  function buildDeclarationText(): string {
    const kind =
      requestKind.value === 'FULL'
        ? 'the full session notes as recorded by my clinician'
        : 'a summary of my session notes (not the full clinical record)'
    return (
      `I understand I am requesting access to my behavioral health session records. ` +
      `I specifically request ${kind}. ` +
      `I confirm that I am the person making this request and that my digital signature below attests to that fact.`
    )
  }

  function handleSubmit() {
    if (!declarationAccepted.value) {
      toast.add({
        title: 'Confirmation required',
        description: 'Please confirm the statement above before submitting.',
        color: 'error',
      })
      return
    }
    if (!signatureDataUrl.value) {
      signatureError.value = 'Please sign in the box'
      toast.add({ title: 'Signature required', description: 'Draw your digital signature.', color: 'error' })
      return
    }
    emit('submit', {
      requestKind: requestKind.value,
      signatureData: signatureDataUrl.value,
    })
  }
</script>

<template>
  <UModal
    :open="open"
    title="Request session notes"
    :ui="{
      overlay: 'z-[60]',
      content: 'max-w-lg w-full z-[60]',
      body: 'max-h-[85vh] overflow-y-auto p-6',
    }"
    @update:open="(v: boolean) => !v && emit('close')"
  >
    <template #body>
      <p class="mb-4 text-sm text-gray-600 dark:text-gray-400">
        Choose whether you want the full notes your clinician entered, or a shorter summary. An
        administrator will review your request. You must sign below to submit.
      </p>

      <div class="mb-4 space-y-2">
        <label class="flex cursor-pointer items-start gap-2 rounded-lg border border-gray-200 p-3 dark:border-gray-700">
          <input v-model="requestKind" type="radio" value="FULL" class="mt-1" />
          <span>
            <span class="font-medium text-gray-900 dark:text-white">Full session notes</span>
            <span class="block text-sm text-gray-600 dark:text-gray-400">
              Everything your clinician recorded for your sessions.
            </span>
          </span>
        </label>
        <label class="flex cursor-pointer items-start gap-2 rounded-lg border border-gray-200 p-3 dark:border-gray-700">
          <input v-model="requestKind" type="radio" value="SUMMARY" class="mt-1" />
          <span>
            <span class="font-medium text-gray-900 dark:text-white">Summary only</span>
            <span class="block text-sm text-gray-600 dark:text-gray-400">
              A brief summary prepared when your request is approved (not the full record).
            </span>
          </span>
        </label>
      </div>

      <label class="mb-4 flex cursor-pointer items-start gap-2">
        <UCheckbox v-model="declarationAccepted" class="mt-0.5" />
        <span class="text-sm text-gray-700 dark:text-gray-300">
          I have read and agree that my request and digital signature will be stored with my profile
          for compliance purposes.
        </span>
      </label>

      <div class="mb-6">
        <label class="mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-300">
          Digital signature <span class="text-red-500">*</span>
        </label>
        <p class="mb-2 text-xs text-gray-500 dark:text-gray-400">
          Sign below to confirm you are requesting access as described above.
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
            Sign here
          </div>
        </div>
        <div class="mt-1 flex items-center gap-2">
          <UButton variant="ghost" size="xs" @click="clearSignature">Clear</UButton>
          <p v-if="signatureError" class="text-sm text-red-600 dark:text-red-400">{{ signatureError }}</p>
        </div>
      </div>

      <div class="flex justify-end gap-2">
        <UButton variant="ghost" @click="emit('close')">Cancel</UButton>
        <UButton color="primary" :loading="loading" @click="handleSubmit">Submit request</UButton>
      </div>
    </template>
  </UModal>
</template>
