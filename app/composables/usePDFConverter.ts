import type { ExtractedQuestion } from '~/types/pdf-form'

export interface UsePDFConverterOptions {
  onExtracted?: (questions: ExtractedQuestion[]) => void
}

export interface UsePDFConverterReturn {
  /** Upload and convert a PDF file to form questions */
  convert: (file: File) => Promise<void>
  /** Extracted questions (with needsReview flags for ambiguous fields) */
  extractedQuestions: Ref<ExtractedQuestion[]>
  /** Whether conversion is in progress */
  isConverting: Ref<boolean>
  /** Error message if conversion failed */
  error: Ref<string | null>
  /** Clear extracted questions and error */
  reset: () => void
}

/**
 * Vue composable for PDF-to-Form conversion.
 * Handles: PDF upload → render to base64 images → Vision API → structured questions.
 * Use with a form builder state; extracted questions include needsReview for ambiguous fields.
 */
export function usePDFConverter(
  options: UsePDFConverterOptions = {}
): UsePDFConverterReturn {
  const extractedQuestions = ref<ExtractedQuestion[]>([])
  const isConverting = ref(false)
  const error = ref<string | null>(null)

  const { onExtracted } = options

  function reset() {
    extractedQuestions.value = []
    error.value = null
  }

  async function convert(file: File) {
    if (!file.type.includes('pdf')) {
      error.value = 'Please select a PDF file'
      return
    }

    isConverting.value = true
    error.value = null

    try {
      const { pdfToBase64Images } = await import('~/utils/pdf-to-images')
      const images = await pdfToBase64Images(file, { scale: 2, maxPages: 20 })

      const { questions } = await $fetch<{ questions: unknown[] }>(
        '/api/pdf/analyze',
        {
          method: 'POST',
          body: { images },
        }
      )

      const normalized = (questions as ExtractedQuestion[]).map((q) => ({
        ...q,
        id: q.id || crypto.randomUUID(),
        type: mapType(q.type),
        needsReview: q.needsReview ?? false,
      }))

      extractedQuestions.value = normalized
      onExtracted?.(normalized)
    } catch (e: unknown) {
      const err = e as { data?: { message?: string }; message?: string }
      error.value =
        err?.data?.message ?? err?.message ?? 'PDF conversion failed. Please try again.'
    } finally {
      isConverting.value = false
    }
  }

  return {
    convert,
    extractedQuestions,
    isConverting,
    error,
    reset,
  }
}

function mapType(t: string | undefined): ExtractedQuestion['type'] {
  const valid: ExtractedQuestion['type'][] = [
    'radio',
    'radio_other',
    'checkbox',
    'checkbox_other',
    'short_answer',
    'long_paragraph',
    'multiple_choice_grid',
    'checkbox_grid',
  ]
  const lower = (t ?? 'radio').toLowerCase()
  if (valid.includes(lower as ExtractedQuestion['type'])) {
    return lower as ExtractedQuestion['type']
  }
  if (lower === 'radio-with-other') return 'radio_other'
  if (lower === 'checkbox-with-other') return 'checkbox_other'
  return 'radio'
}
