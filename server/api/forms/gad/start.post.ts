import { requireUser } from '../../../utils/guard'
import { createError, defineEventHandler, getHeaders } from 'h3'
import { prisma } from '../../../utils/prisma'
import { isAdmin } from '../../../utils/is-admin'
import { getClientPermissions } from '../../../utils/client-permissions'

export default defineEventHandler(async (event) => {

  const user = requireUser(event)
  const userId = user.id

  

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
    if (existingForm.status === 'COMPLETE' && !canViewScores) {
      throw createError({
        statusCode: 403,
        statusMessage:
          'You do not have permission to view scores. Your administrator has not enabled this feature for your account. Please contact your clinician for any further inquiries.',
      })
    }
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

    return {
      formId: existingForm.id,
      answers: questions,
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
    answers: createdQuestions,
  }
})
