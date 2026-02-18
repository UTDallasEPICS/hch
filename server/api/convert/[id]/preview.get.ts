import { createReadStream, existsSync } from 'node:fs'
import { resolve, join } from 'node:path'

const UPLOADS_DIR = resolve(process.cwd(), 'server', 'uploads')

export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id')
  if (!id) throw createError({ statusCode: 400, message: 'Missing document id.' })

  // Try PDF first, then DOCX
  const pdfPath  = join(UPLOADS_DIR, `${id}.pdf`)
  const docxPath = join(UPLOADS_DIR, `${id}.docx`)

  if (existsSync(pdfPath)) {
    setResponseHeaders(event, {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `inline; filename="${id}.pdf"`,
      'Cache-Control': 'private, max-age=3600',
    })
    return sendStream(event, createReadStream(pdfPath))
  }

  if (existsSync(docxPath)) {
    setResponseHeaders(event, {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'Content-Disposition': `inline; filename="${id}.docx"`,
      'Cache-Control': 'private, max-age=3600',
    })
    return sendStream(event, createReadStream(docxPath))
  }

  throw createError({ statusCode: 404, message: 'File not found on disk.' })
})
