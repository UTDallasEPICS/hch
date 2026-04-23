<script setup lang="ts">
  const props = defineProps<{
    open: boolean
    loading?: boolean
  }>()

  const emit = defineEmits<{
    close: []
    submit: [
      payload: {
        requestKind: 'FULL' | 'SUMMARY'
        signatureData: string
        startDate: string | null
        endDate: string | null
      },
    ]
  }>()

  const toast = useToast()

  const requestKind = ref<'FULL' | 'SUMMARY'>('FULL')
  const declarationAccepted = ref(false)
  const signatureDataUrl = ref('')
  const signatureError = ref('')
  const startDate = ref('')
  const endDate = ref('')
  const wholeRecord = ref(true)
  const dateRangeError = ref('')

  const today = computed(() => new Date().toISOString().slice(0, 10))

  watch(
    () => props.open,
    (open) => {
      if (open) {
        requestKind.value = 'FULL'
        declarationAccepted.value = false
        signatureDataUrl.value = ''
        signatureError.value = ''
        startDate.value = ''
        endDate.value = ''
        wholeRecord.value = true
        dateRangeError.value = ''
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

    const rect = canvas.getBoundingClientRect()
    const dpr = window.devicePixelRatio || 1
    canvas.width = Math.max(1, Math.floor(rect.width * dpr))
    canvas.height = Math.max(1, Math.floor(rect.height * dpr))

    const ctx = canvas.getContext('2d')
    if (!ctx) return

    ctx.setTransform(1, 0, 0, 1, 0, 0)
    ctx.scale(dpr, dpr)
    ctx.clearRect(0, 0, rect.width, rect.height)

    sigCtx.value = ctx
    ctx.strokeStyle = '#111827'
    ctx.lineWidth = 2
    ctx.lineCap = 'round'
  }

  function getCanvasCoords(e: MouseEvent | TouchEvent): { x: number; y: number } {
    const canvas = sigCanvasRef.value
    if (!canvas) return { x: 0, y: 0 }
    const rect = canvas.getBoundingClientRect()
    const scaleX = canvas.width / rect.width
    const scaleY = canvas.height / rect.height

    if ('touches' in e) {
      const touch = e.touches[0]
      if (!touch) return { x: 0, y: 0 }
      return {
        x: ((touch.clientX - rect.left) * scaleX) / (window.devicePixelRatio || 1),
        y: ((touch.clientY - rect.top) * scaleY) / (window.devicePixelRatio || 1),
      }
    }
    return {
      x: ((e.clientX - rect.left) * scaleX) / (window.devicePixelRatio || 1),
      y: ((e.clientY - rect.top) * scaleY) / (window.devicePixelRatio || 1),
    }
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

  function validateRange(): boolean {
    dateRangeError.value = ''
    if (wholeRecord.value) return true
    if (!startDate.value || !endDate.value) {
      dateRangeError.value = 'Please select both a start and end date, or choose "entire record".'
      return false
    }
    if (startDate.value > endDate.value) {
      dateRangeError.value = 'Start date must be on or before end date.'
      return false
    }
    if (endDate.value > today.value) {
      dateRangeError.value = 'End date cannot be in the future.'
      return false
    }
    return true
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
    if (!validateRange()) {
      toast.add({
        title: 'Check the date range',
        description: dateRangeError.value || 'Date range is invalid.',
        color: 'error',
      })
      return
    }
    if (!signatureDataUrl.value) {
      signatureError.value = 'Please sign in the box'
      toast.add({
        title: 'Signature required',
        description: 'Draw your digital signature.',
        color: 'error',
      })
      return
    }
    emit('submit', {
      requestKind: requestKind.value,
      signatureData: signatureDataUrl.value,
      startDate: wholeRecord.value ? null : startDate.value || null,
      endDate: wholeRecord.value ? null : endDate.value || null,
    })
  }
</script>

<template>
  <UModal
    :open="open"
    title="Request records"
    :ui="{
      overlay: 'z-[60]',
      content: 'max-w-lg w-full z-[60]',
      body: 'max-h-[85vh] overflow-y-auto p-6',
    }"
    @update:open="(v: boolean) => !v && emit('close')"
  >
    <template #body>
      <p class="mb-4 text-sm text-gray-600 dark:text-gray-400">
        Submit a formal request for your behavioral health records. Choose full notes or a summary
        and (optionally) limit the request to a specific date range. An administrator will review
        your request within 14 calendar days.
      </p>

      <div class="mb-4 space-y-2">
        <label
          class="flex cursor-pointer items-start gap-2 rounded-lg border border-gray-200 p-3 dark:border-gray-700"
        >
          <input v-model="requestKind" type="radio" value="FULL" class="mt-1" />
          <span>
            <span class="font-medium text-gray-900 dark:text-white">Full session notes</span>
            <span class="block text-sm text-gray-600 dark:text-gray-400">
              Everything your clinician recorded for your sessions in the chosen range.
            </span>
          </span>
        </label>
        <label
          class="flex cursor-pointer items-start gap-2 rounded-lg border border-gray-200 p-3 dark:border-gray-700"
        >
          <input v-model="requestKind" type="radio" value="SUMMARY" class="mt-1" />
          <span>
            <span class="font-medium text-gray-900 dark:text-white">Summary only</span>
            <span class="block text-sm text-gray-600 dark:text-gray-400">
              A brief clinician-prepared summary (not the full clinical record).
            </span>
          </span>
        </label>
      </div>

      <div class="mb-4 rounded-lg border border-gray-200 p-3 dark:border-gray-700">
        <div class="mb-2 flex items-center justify-between gap-2">
          <span class="text-sm font-medium text-gray-900 dark:text-white">Records date range</span>
          <label class="flex items-center gap-2 text-xs text-gray-600 dark:text-gray-400">
            <UCheckbox v-model="wholeRecord" />
            <span>Entire available record</span>
          </label>
        </div>
        <div
          v-if="!wholeRecord"
          class="grid grid-cols-1 gap-3 sm:grid-cols-2"
        >
          <label class="block">
            <span class="mb-1 block text-xs font-medium text-gray-700 dark:text-gray-300">
              Start date
            </span>
            <input
              v-model="startDate"
              type="date"
              :max="today"
              class="w-full rounded-md border border-gray-300 bg-white px-2 py-1.5 text-sm text-gray-900 dark:border-gray-600 dark:bg-gray-800 dark:text-white"
            />
          </label>
          <label class="block">
            <span class="mb-1 block text-xs font-medium text-gray-700 dark:text-gray-300">
              End date
            </span>
            <input
              v-model="endDate"
              type="date"
              :max="today"
              class="w-full rounded-md border border-gray-300 bg-white px-2 py-1.5 text-sm text-gray-900 dark:border-gray-600 dark:bg-gray-800 dark:text-white"
            />
          </label>
        </div>
        <p v-if="dateRangeError" class="mt-2 text-xs text-red-600 dark:text-red-400">
          {{ dateRangeError }}
        </p>
      </div>

      <!--
        Records-request disclaimer. Generic HIPAA/records phrasing used until the
        clinic provides final verbiage.
      -->
      <div
        class="mb-4 rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs leading-relaxed text-amber-900 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-200"
      >
        <p class="mb-2 font-semibold">Records-request disclaimer</p>
        <p class="mb-2">
          I am requesting access to my own protected health information (PHI) held by this clinic
          under my right of access pursuant to 45 CFR § 164.524. I confirm the following:
        </p>
        <ul class="list-disc space-y-1 pl-5">
          <li>
            The clinic has up to <strong>fourteen (14) calendar days</strong> from my signed
            request to approve, deny, or extend this request.
          </li>
          <li>
            Records I receive may contain sensitive clinical information. I am responsible for how
            I store, share, or disclose any copy released to me.
          </li>
          <li>
            Psychotherapy (process) notes maintained separately from the medical record are not
            required to be released and may be withheld or summarized.
          </li>
          <li>
            This request and my digital signature are retained with my clinical file as a
            compliance record.
          </li>
        </ul>
      </div>

      <label class="mb-4 flex cursor-pointer items-start gap-2">
        <UCheckbox v-model="declarationAccepted" class="mt-0.5" />
        <span class="text-sm text-gray-700 dark:text-gray-300">
          I have read and agree to the disclaimer above, and my request and digital signature will
          be stored with my profile for compliance purposes.
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
          <p v-if="signatureError" class="text-sm text-red-600 dark:text-red-400">
            {{ signatureError }}
          </p>
        </div>
      </div>

      <div class="flex justify-end gap-2">
        <UButton variant="ghost" @click="emit('close')">Cancel</UButton>
        <UButton color="primary" :loading="loading" @click="handleSubmit">Submit request</UButton>
      </div>
    </template>
  </UModal>
</template>
