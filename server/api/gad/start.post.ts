import { createError, defineEventHandler, getHeaders } from 'h3'
import { auth } from '../../utils/auth'
import { prisma } from '../../utils/prisma'

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

  const existingForm = await prisma.gadForm.findFirst({
    where: { userId },
    orderBy: { id: 'desc' },
    include: {
      questions: true,
    },
  })

  if (existingForm) {
    return {
      formId: existingForm.id,
      status: existingForm.status,
      totalScore: existingForm.totalScore,
      severity: existingForm.severity,
      answers: existingForm.questions,
    }
  }

  // create new form
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
    status: createdForm.status,
    totalScore: null,
    severity: null,
    answers: createdQuestions,
  }
})
