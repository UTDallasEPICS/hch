import { writeFile, mkdir } from 'node:fs/promises'
import { resolve, join } from 'node:path'
import { prisma } from '../../utils/prisma'

const EXTRACT_BASE = process.env.EXTRACT_SERVICE_URL ?? 'http://localhost:8000'
const UPLOADS_DIR  = resolve(process.cwd(), 'server', 'uploads')

export default defineEventHandler(async (event) => {
  const formData = await readMultipartFormData(event)
  if (!formData || formData.length === 0) {
    throw createError({ statusCode: 400, message: 'No form data received.' })
  }

  const filePart  = formData.find((p) => p.name === 'file')
  const docIdPart = formData.find((p) => p.name === 'docId')

  if (docIdPart && !filePart) {
    const docId = docIdPart.data.toString().trim()
    if (!docId) throw createError({ statusCode: 400, message: 'docId is empty.' })

    const upload = await prisma.documentUpload.create({
      data: {
        originalName: `gdoc:${docId}`,
        mimeType: 'application/vnd.google-apps.document',
        storagePath: docId,
        sourceUrl: `https://docs.google.com/document/d/${docId}`,
        status: 'extracting',
      },
    })

    try {
      const pyRes = await $fetch<ExtractionResult>(`${EXTRACT_BASE}/extract/gdoc`, {
        method: 'POST',
        body: { doc_id: docId },
      })
      await persistFields(upload.id, pyRes)
      await prisma.documentUpload.update({
        where: { id: upload.id },
        data: { status: 'review' },
      })
      return { documentId: upload.id }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err)
      await prisma.documentUpload.update({
        where: { id: upload.id },
        data: { status: 'error', errorMessage: msg },
      })
      throw createError({ statusCode: 502, message: `Extraction service error: ${msg}` })
    }
  }

  if (!filePart) {
    throw createError({ statusCode: 400, message: 'Provide either a `file` or `docId`.' })
  }

  const filename = filePart.filename ?? 'upload'
  const mimeType = filePart.type ?? 'application/octet-stream'
  const ext      = mimeType.includes('pdf') ? '.pdf' : '.docx'

  const upload = await prisma.documentUpload.create({
    data: { originalName: filename, mimeType, storagePath: '', status: 'extracting' },
  })

  await mkdir(UPLOADS_DIR, { recursive: true })
  const savedPath = join(UPLOADS_DIR, `${upload.id}${ext}`)
  await writeFile(savedPath, filePart.data)

  await prisma.documentUpload.update({
    where: { id: upload.id },
    data: { storagePath: savedPath },
  })

  try {
    const blob = new Blob([filePart.data], { type: mimeType })
    const fd   = new FormData()
    fd.append('file', blob, filename)

    const pyRes = await $fetch<ExtractionResult>(`${EXTRACT_BASE}/extract/file`, {
      method: 'POST',
      body: fd,
    })

    await persistFields(upload.id, pyRes)
    await prisma.documentUpload.update({
      where: { id: upload.id },
      data: { status: 'review' },
    })
    return { documentId: upload.id }
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err)
    await prisma.documentUpload.update({
      where: { id: upload.id },
      data: { status: 'error', errorMessage: msg },
    })
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

async function persistFields(documentId: string, result: ExtractionResult) {
  const creates = result.fields.map((f, idx) =>
    prisma.extractedField.create({
      data: {
        documentId,
        fieldIndex: idx,
        label: f.label.replace(/[\u200b-\u200f\u202a-\u202e\ufeff]/g, '').trim(),
        type: f.type,
        options: f.options ? JSON.stringify(f.options) : null,
        pageNumber: f.bounding_box?.page ?? null,
        boundingBox: f.bounding_box ? JSON.stringify(f.bounding_box) : null,
        elementIndex: f.element_index ?? null,
        confidence: f.confidence,
      },
    })
  )
  await Promise.all(creates)
}
