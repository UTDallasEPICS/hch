import { createError, defineEventHandler, getHeaders, readMultipartFormData } from 'h3'
import { auth } from '../../utils/auth'
import { prisma } from '../../utils/prisma'
import { mkdir, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { randomUUID } from 'node:crypto'
import { toClientStatusLabel } from '../../utils/client-status'

const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024

function hasPdfSignature(fileBytes: Uint8Array) {
  if (fileBytes.length < 5) return false
  return (
    fileBytes[0] === 0x25 && // %
    fileBytes[1] === 0x50 && // P
    fileBytes[2] === 0x44 && // D
    fileBytes[3] === 0x46 && // F
    fileBytes[4] === 0x2d // -
  )
}

export default defineEventHandler(async (event) => {
  const requestHeaders = new Headers()
  for (const [key, value] of Object.entries(getHeaders(event))) {
    if (value !== undefined) requestHeaders.set(key, value)
  }

  const session = await auth.api.getSession({ headers: requestHeaders })
  if (!session?.user?.id) {
    throw createError({ statusCode: 401, statusMessage: 'Unauthorized' })
  }

  const clients = await prisma.$queryRawUnsafe<Array<{ status: string | null }>>(
    'SELECT status FROM "client" WHERE userId = ? LIMIT 1',
    session.user.id
  )
  const status = toClientStatusLabel(clients[0]?.status)
  if (status !== 'Prospective' && status !== 'Waitlist') {
    throw createError({
      statusCode: 403,
      statusMessage:
        'Release of Information Authorization upload is only available for prospective or waitlist clients',
    })
  }

  const parts = await readMultipartFormData(event)
  if (!parts || parts.length === 0) {
    throw createError({ statusCode: 400, statusMessage: 'No file uploaded' })
  }

  const filePart = parts.find((part) => part.name === 'file')
  if (!filePart?.data || !filePart.filename) {
    throw createError({ statusCode: 400, statusMessage: 'Missing uploaded file' })
  }

  const contentType = filePart.type || 'application/octet-stream'
  const isPdfByType = contentType.toLowerCase() === 'application/pdf'
  const isPdfByName = filePart.filename.toLowerCase().endsWith('.pdf')
  const isPdfByContent = hasPdfSignature(filePart.data)
  if ((!isPdfByType && !isPdfByName) || !isPdfByContent) {
    throw createError({ statusCode: 400, statusMessage: 'Only PDF files are allowed' })
  }

  if (filePart.data.length > MAX_FILE_SIZE_BYTES) {
    throw createError({ statusCode: 400, statusMessage: 'File must be 10MB or smaller' })
  }

  const uploadsDir = join(process.cwd(), 'server', 'uploads', 'release-of-information')
  await mkdir(uploadsDir, { recursive: true })

  const storedFileName = `${session.user.id}-${Date.now()}-${randomUUID()}.pdf`
  const absolutePath = join(uploadsDir, storedFileName)
  await writeFile(absolutePath, filePart.data)

  const now = new Date()
  await prisma.$executeRawUnsafe(
    `INSERT INTO "ReleaseOfInformationAuthorizationForm"
      ("userId", "status", "originalFileName", "storedFileName", "mimeType", "uploadedAt", "createdAt", "updatedAt")
    VALUES (?, 'SUBMITTED', ?, ?, 'application/pdf', ?, ?, ?)
    ON CONFLICT("userId") DO UPDATE SET
      "status" = 'SUBMITTED',
      "originalFileName" = excluded."originalFileName",
      "storedFileName" = excluded."storedFileName",
      "mimeType" = excluded."mimeType",
      "uploadedAt" = excluded."uploadedAt",
      "updatedAt" = excluded."updatedAt"`,
    session.user.id,
    filePart.filename,
    storedFileName,
    now,
    now,
    now
  )

  return {
    submitted: true,
    uploadedAt: now,
    originalFileName: filePart.filename,
  }
})
