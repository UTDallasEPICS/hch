import { requireUser } from '../../../utils/guard'
import { createError, defineEventHandler, setHeader } from 'h3'
import { prisma } from '../../../utils/prisma'
import { readFile } from 'node:fs/promises'
import { join } from 'node:path'

export default defineEventHandler(async (event) => {
  const db = prisma as any

  const user = requireUser(event)

  const record = await db.physicianStatementForm.findUnique({
    where: { userId: user.id },
    select: {
      status: true,
      originalFileName: true,
      storedFileName: true,
      mimeType: true,
    },
  })

  if (!record || record.status !== 'SUBMITTED' || !record.storedFileName) {
    throw createError({ statusCode: 404, statusMessage: 'No uploaded Physician Statement found' })
  }

  const uploadsDir = join(process.cwd(), 'server', 'uploads', 'physician-statements')
  const absolutePath = join(uploadsDir, record.storedFileName)

  let fileBuffer: Buffer
  try {
    fileBuffer = await readFile(absolutePath)
  } catch {
    throw createError({ statusCode: 404, statusMessage: 'Uploaded file not found on server' })
  }

  const downloadName = record.originalFileName || 'physician-statement-uploaded.pdf'
  setHeader(event, 'Content-Type', record.mimeType || 'application/pdf')
  setHeader(event, 'Content-Disposition', `attachment; filename="${downloadName}"`)
  setHeader(event, 'Cache-Control', 'no-store')

  return fileBuffer
})
