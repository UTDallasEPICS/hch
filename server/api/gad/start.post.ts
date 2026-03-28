import { createError, defineEventHandler, getHeaders } from 'h3'
import { auth } from '../../utils/auth'
import { prisma } from '../../utils/prisma'
import { isAdmin } from '../../utils/is-admin'
import { getClientPermissions } from '../../utils/client-permissions'

export default defineEventHandler(async (event) => {
  const requestHeaders = new Headers()

  for (const [key, value] of Object.entries(getHeaders(event))) {
    if (value !== undefined) requestHeaders.set(key, value)
  }

  const session = await auth.api.getSession({ headers: requestHeaders })
  const userId = session?.user?.id

  if (!userId) {
    throw createError({ statusCode: 401, statusMessage: 'Unauthorized' })
  }

  const currentUser = await prisma.user.findUnique({
    where: { id: userId },
    select: { role: true, email: true },
  })
  const canViewScores =
    isAdmin(currentUser?.role ?? null, currentUser?.email ?? null) ||
    (await getClientPermissions(userId)).canViewScores

  // Find latest form
  const existingForm = await prisma.gadForm.findFirst({
    where: { userId },
    orderBy: { id: 'desc' },
  })

  if (existingForm) {
    let questions = await prisma.gadQuestion.findFirst({
      where: { formId: existingForm.id },
    })

    if (!questions) {
      questions = await prisma.gadQuestion.create({
        data: {
          formId: existingForm.id,
          userId,
        },
      })
    }

    const submitted = existingForm.status === 'COMPLETE'
    const canViewFormDetails = !submitted || canViewScores

    return {
      formId: existingForm.id,
      submitted,
      canViewFormDetails,
      answers: canViewFormDetails ? questions : null,
    }
  }

  // Create new form
  const createdForm = await prisma.gadForm.create({
    data: { userId },
  })

  const createdQuestions = await prisma.gadQuestion.create({
    data: {
      formId: createdForm.id,
      userId,
    },
  })

  return {
    formId: createdForm.id,
    submitted: false,
    canViewFormDetails: true,
    answers: createdQuestions,
  }
})
