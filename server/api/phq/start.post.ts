import { createError, defineEventHandler, getHeaders } from 'h3'
import { auth } from '../../utils/auth'
import { prisma } from '../../utils/prisma'
import { isAdmin } from '../../utils/is-admin'
import { getClientPermissions } from '../../utils/client-permissions'

export default defineEventHandler(async (event) => {
  const requestHeaders = new Headers()
  for (const [key, value] of Object.entries(getHeaders(event))) {
    if (value !== undefined) {
      requestHeaders.set(key, value)
    }
  }

  const session = await auth.api.getSession({
    headers: requestHeaders,
  })

  const userId = session?.user?.id

  if (!userId) {
    throw createError({
      statusCode: 401,
      statusMessage: 'Unauthorized',
    })
  }

  const currentUser = await prisma.user.findUnique({
    where: { id: userId },
    select: { role: true, email: true },
  })
  const canViewScores =
    isAdmin(currentUser?.role ?? null, currentUser?.email ?? null) ||
    (await getClientPermissions(userId)).canViewScores

  let existingForm = await prisma.phqForm.findFirst({
    where: {
      userId,
    },
    orderBy: {
      id: 'asc',
    },
  })
  let created = false

  if (!existingForm) {
    existingForm = await prisma.phqForm.create({
      data: {
        userId,
        status: 'IN_PROGRESS',
      },
    })
    created = true
  }

  if (existingForm.status === 'COMPLETE' && !canViewScores) {
    throw createError({
      statusCode: 403,
      statusMessage:
        'You do not have permission to view scores. Your administrator has not enabled this feature for your account. Please contact your clinician for any further inquiries.',
    })
  }

  let existingQuestions = await prisma.phqQuestion.findUnique({
    where: {
      formId: existingForm.id,
    },
  })

  if (!existingQuestions) {
    existingQuestions = await prisma.phqQuestion.create({
      data: {
        formId: existingForm.id,
        userId,
      },
    })
  } 

  return {
    formId: existingForm.id,
    created,
    submitted: existingForm.status === 'COMPLETE',
    answers: existingQuestions,
  }
})