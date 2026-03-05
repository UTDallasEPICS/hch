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

  const record = await prisma.physicianStatementForm.findUnique({
    where: { userId: session.user.id },
    select: {
      status: true,
      uploadedAt: true,
      originalFileName: true,
    },
  })

  return {
    submitted: record?.status === 'SUBMITTED',
    uploadedAt: record?.uploadedAt ?? null,
    originalFileName: record?.originalFileName ?? null,
    templateUrl: '/physician-statement-form.pdf',
    uploadedFileUrl: record?.status === 'SUBMITTED' ? '/api/physician-statement/download' : null,
  }
})
