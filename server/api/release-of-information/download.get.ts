import { createError, defineEventHandler, getHeaders, setHeader } from 'h3'
import { auth } from '../../utils/auth'
import { prisma } from '../../utils/prisma'
import { readFile } from 'node:fs/promises'
import { join } from 'node:path'

export default defineEventHandler(async (event) => {
  const requestHeaders = new Headers()
  for (const [key, value] of Object.entries(getHeaders(event))) {
    if (value !== undefined) requestHeaders.set(key, value)
  }

  const session = await auth.api.getSession({ headers: requestHeaders })
  if (!session?.user?.id) {
    throw createError({ statusCode: 401, statusMessage: 'Unauthorized' })
  }

  const records = await prisma.$queryRawUnsafe<
    Array<{
      status: string | null
      originalFileName: string | null
      storedFileName: string | null
      mimeType: string | null
    }>
  >(
    'SELECT status, originalFileName, storedFileName, mimeType FROM "ReleaseOfInformationAuthorizationForm" WHERE userId = ? LIMIT 1',
    session.user.id
  )
  const record = records[0] ?? null

  if (!record || record.status !== 'SUBMITTED' || !record.storedFileName) {
    throw createError({ statusCode: 404, statusMessage: 'No uploaded ROI form found' })
  }

  const uploadsDir = join(process.cwd(), 'server', 'uploads', 'release-of-information')
  const absolutePath = join(uploadsDir, record.storedFileName)

  let fileBuffer: Buffer
  try {
    fileBuffer = await readFile(absolutePath)
  } catch {
    throw createError({ statusCode: 404, statusMessage: 'Uploaded file not found on server' })
  }

  const downloadName =
    record.originalFileName || 'release-of-information-authorization-uploaded.pdf'
  setHeader(event, 'Content-Type', record.mimeType || 'application/pdf')
  setHeader(event, 'Content-Disposition', `attachment; filename="${downloadName}"`)
  setHeader(event, 'Cache-Control', 'no-store')

  return fileBuffer
})
