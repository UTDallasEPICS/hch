import { requireAdmin } from '../../../utils/guard'
import { createError, defineEventHandler, getHeaders, getRouterParam, setHeader } from 'h3'
import { prisma } from '../../../utils/prisma'
import { isAdmin } from '../../../utils/is-admin'
import { readFile, fileExists, getMimeType } from '../../../utils/file-upload'

export default defineEventHandler(async (event) => {

  const user = requireAdmin(event)

  const auditId = getRouterParam(event, 'id')
  if (!auditId) {
    throw createError({ statusCode: 400, statusMessage: 'Missing audit id' })
  }

  const audit = await prisma.changeAudit.findUnique({
    where: { id: auditId },
    select: { documentationPath: true, documentationName: true },
  })

  if (!audit || !audit.documentationPath) {
    throw createError({ statusCode: 404, statusMessage: 'Document not found' })
  }

  const exists = await fileExists(audit.documentationPath)
  if (!exists) {
    throw createError({ statusCode: 404, statusMessage: 'Document file not found on server' })
  }

  const fileBuffer = await readFile(audit.documentationPath)
  const filename = audit.documentationName || 'document'
  const mimeType = getMimeType(audit.documentationPath)

  setHeader(event, 'Content-Type', mimeType)
  setHeader(event, 'Content-Disposition', `attachment; filename="${filename}"`)
  setHeader(event, 'Content-Length', fileBuffer.length)

  return fileBuffer
})
