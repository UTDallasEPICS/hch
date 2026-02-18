/**
 * GET /api/convert/:id/preview
 *
 * Streams the originally uploaded PDF or DOCX back to the browser
 * so the correction UI can embed it in an <iframe>.
 */

import { createReadStream, existsSync } from 'node:fs'
import { prisma } from '../../../utils/prisma'

export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id')
  if (!id) throw createError({ statusCode: 400, message: 'Missing document id.' })

  const doc = await prisma.documentUpload.findUnique({
    where: { id },
    select: { storagePath: true, mimeType: true, originalName: true },
  })

  if (!doc) throw createError({ statusCode: 404, message: 'Document not found.' })

  // Google Docs have no local file — redirect to the doc URL instead
  if (doc.mimeType === 'application/vnd.google-apps.document') {
    throw createError({ statusCode: 404, message: 'No local file for Google Doc sources.' })
  }

  if (!doc.storagePath || !existsSync(doc.storagePath)) {
    throw createError({
      statusCode: 404,
      message: 'File not found on disk. It may have been uploaded before file-saving was enabled.',
    })
  }

  const contentType = doc.mimeType.includes('pdf')
    ? 'application/pdf'
    : 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'

  setResponseHeaders(event, {
    'Content-Type': contentType,
    'Content-Disposition': `inline; filename="${doc.originalName}"`,
    'Cache-Control': 'private, max-age=3600',
  })

  return sendStream(event, createReadStream(doc.storagePath))
})
