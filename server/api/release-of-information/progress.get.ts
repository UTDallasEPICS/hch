import { createError, defineEventHandler, getHeaders } from 'h3'
import { auth } from '../../utils/auth'
import { prisma } from '../../utils/prisma'

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
    Array<{ status: string | null; uploadedAt: Date | null; originalFileName: string | null }>
  >(
    'SELECT status, uploadedAt, originalFileName FROM "ReleaseOfInformationAuthorizationForm" WHERE userId = ? LIMIT 1',
    session.user.id
  )
  const record = records[0] ?? null

  return {
    submitted: record?.status === 'SUBMITTED',
    uploadedAt: record?.uploadedAt ?? null,
    originalFileName: record?.originalFileName ?? null,
    templateUrl: '/release-of-information-authorization-form.pdf',
    uploadedFileUrl: record?.status === 'SUBMITTED' ? '/api/release-of-information/download' : null,
  }
})
