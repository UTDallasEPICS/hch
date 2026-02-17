import { readMultipartFormData } from 'h3'
import { prisma } from '../../utils/prisma'

/** Use dynamic import to avoid createRequire + path handling that triggers Windows ESM "protocol c:" error. */
async function getPdfParse(): Promise<(data: Buffer) => Promise<{ text: string; numpages: number }>> {
  const m = await import('pdf-parse')
  return (m.default ?? m) as (data: Buffer) => Promise<{ text: string; numpages: number }>
}

function generateAlias(text: string, existingAliases: string[]): string {
  const base = text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, '')
    .trim()
    .replace(/\s+/g, '_')
    .slice(0, 30)
  let alias = base || 'question'
  let n = 0
  while (existingAliases.includes(alias)) {
    n += 1
    alias = `${base}_${n}`
  }
  return alias
}

function defaultOptions(type: string): string[] {
  if (type === 'radio') return ['Yes', 'No']
  if (type === 'checkbox') return ['Yes']
  return []
}

/** Parse extracted PDF text into questions: numbered items (1. 2. Q1.) or one per line. */
function parsePdfTextToQuestions(
  text: string
): { text: string; type?: string; options?: string[] }[] {
  const trimmed = text.trim()
  if (!trimmed) return []

  // Split by "newline + number." or "newline + Q number." so "1. Question" "2. Question" become separate
  const numberedChunks = trimmed
    .split(/\n\s*(?:\d+[.)]|Q\d+[.)]|Question\s+\d+[.)])\s+/i)
    .map((s) => s.replace(/\s+/g, ' ').trim())
    .filter(Boolean)
  if (numberedChunks.length > 1) {
    return numberedChunks.map((t) => ({ text: t, type: 'radio' as const }))
  }

  // Fallback: one question per non-empty line
  const byLine = trimmed
    .split(/\r?\n/)
    .map((l) => l.replace(/\s+/g, ' ').trim())
    .filter(Boolean)
  return byLine.map((t) => ({ text: t, type: 'radio' as const }))
}

export default defineEventHandler(async (event) => {
  const form = await readMultipartFormData(event)
  if (!form || form.length === 0) {
    throw createError({
      statusCode: 400,
      message: 'No file uploaded. Send a PDF as multipart/form-data (field: file).',
    })
  }
  const file = form.find((f) => f.name === 'file')
  const rawData = file?.data
  const filename = (file?.filename ?? '').toLowerCase()
  if (!rawData || rawData.length === 0) {
    throw createError({
      statusCode: 400,
      message: 'No file data. Use form field "file" with a PDF.',
    })
  }
  if (filename && !filename.endsWith('.pdf')) {
    throw createError({ statusCode: 400, message: 'File must be a PDF.' })
  }

  // pdf-parse 1.x accepts Buffer or Uint8Array
  const data =
    rawData instanceof Buffer
      ? rawData
      : rawData instanceof ArrayBuffer
        ? Buffer.from(rawData)
        : Buffer.from(rawData as ArrayBufferView)

  try {
    const pdfParse = await getPdfParse()
    const result = await pdfParse(data)
    const fullText =
      (result && typeof result === 'object' && 'text' in result ? result.text : '') || ''
    const questions = parsePdfTextToQuestions(fullText)
    if (questions.length === 0) {
      throw createError({
        statusCode: 400,
        message:
          'No questions could be extracted from the PDF. The PDF may be empty, image-only, or use an unsupported layout.',
      })
    }

    const existing = await prisma.question.findMany({ select: { alias: true } })
    let existingAliases = existing.map((q) => q.alias)
    const ids: string[] = []

    for (const q of questions) {
      const alias = generateAlias(q.text, existingAliases)
      existingAliases = [...existingAliases, alias]
      const type = q.type || 'radio'
      const optionsArray = q.options?.length ? q.options : defaultOptions(type)
      const question = await prisma.question.create({
        data: {
          text: q.text.trim(),
          type,
          alias,
          options: optionsArray.length > 0 ? JSON.stringify(optionsArray) : null,
        },
      })
      ids.push(question.id)
    }

    return { ids, count: ids.length }
  } catch (e: unknown) {
    if (e && typeof e === 'object' && 'statusCode' in e) throw e
    const message =
      e instanceof Error
        ? e.message
        : typeof e === 'string'
          ? e
          : 'Failed to read PDF or create questions.'
    throw createError({ statusCode: 500, message })
  }
})
