import { writeFile, mkdir } from 'node:fs/promises'
import { resolve, join } from 'node:path'
import { randomUUID } from 'node:crypto'

const EXTRACT_BASE = process.env.EXTRACT_SERVICE_URL ?? 'http://localhost:8000'
const UPLOADS_DIR  = resolve(process.cwd(), 'server', 'uploads')

export default defineEventHandler(async (event) => {
  const formData = await readMultipartFormData(event)
  if (!formData || formData.length === 0) {
    throw createError({ statusCode: 400, message: 'No form data received.' })
  }

  const filePart  = formData.find((p) => p.name === 'file')
  const docIdPart = formData.find((p) => p.name === 'docId')

  // ── Google Doc ────────────────────────────────────────────────────────────
  if (docIdPart && !filePart) {
    const docId = docIdPart.data.toString().trim()
    if (!docId) throw createError({ statusCode: 400, message: 'docId is empty.' })

    const sessionId = randomUUID()
    const sourceUrl = `https://docs.google.com/document/d/${docId}`

    try {
      const pyRes = await $fetch<ExtractionResult>(`${EXTRACT_BASE}/extract/gdoc`, {
        method: 'POST',
        body: { doc_id: docId },
      })
      return {
        documentId: sessionId,
        originalName: `gdoc:${docId}`,
        mimeType: 'application/vnd.google-apps.document',
        sourceUrl,
        fields: mapFields(pyRes.fields),
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err)
      throw createError({ statusCode: 502, message: `Extraction service error: ${msg}` })
    }
  }

  // ── File upload (PDF / DOCX) ──────────────────────────────────────────────
  if (!filePart) {
    throw createError({ statusCode: 400, message: 'Provide either a `file` or `docId`.' })
  }

  const filename = filePart.filename ?? 'upload'
  const mimeType = filePart.type ?? 'application/octet-stream'
  const ext      = mimeType.includes('pdf') ? '.pdf' : '.docx'
  const sessionId = randomUUID()

  await mkdir(UPLOADS_DIR, { recursive: true })
  const savedPath = join(UPLOADS_DIR, `${sessionId}${ext}`)
  await writeFile(savedPath, filePart.data)

  try {
    const blob = new Blob([filePart.data], { type: mimeType })
    const fd   = new FormData()
    fd.append('file', blob, filename)

    const pyRes = await $fetch<ExtractionResult>(`${EXTRACT_BASE}/extract/file`, {
      method: 'POST',
      body: fd,
    })

    return {
      documentId: sessionId,
      originalName: filename,
      mimeType,
      sourceUrl: null,
      fields: mapFields(pyRes.fields),
    }
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err)
    throw createError({ statusCode: 502, message: `Extraction service error: ${msg}` })
  }
})

interface BoundingBox {
  x0: number; y0: number; x1: number; y1: number; page: number
}

interface ExtractionField {
  field_id: string
  label: string
  type: string
  options?: string[] | null
  bounding_box?: BoundingBox | null
  element_index?: number | null
  confidence: string
}

interface ExtractionResult {
  source_type: string
  source_name: string
  fields: ExtractionField[]
  warnings: string[]
}

export interface FrontendField {
  id: string
  fieldIndex: number
  label: string
  type: string
  options: string | null
  pageNumber: number | null
  boundingBox: string | null
  elementIndex: number | null
  confidence: string
  isDeleted: boolean
}

function mapFields(fields: ExtractionField[]): FrontendField[] {
  return fields.map((f, idx) => ({
    id: `field_${idx}_${Date.now()}`,
    fieldIndex: idx,
    label: f.label.replace(/[\u200b-\u200f\u202a-\u202e\ufeff]/g, '').trim(),
    type: f.type,
    options: f.options ? JSON.stringify(f.options) : null,
    pageNumber: f.bounding_box?.page ?? null,
    boundingBox: f.bounding_box ? JSON.stringify(f.bounding_box) : null,
    elementIndex: f.element_index ?? null,
    confidence: f.confidence,
    isDeleted: false,
  }))
}
