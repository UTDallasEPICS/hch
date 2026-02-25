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

  // Find active form
  const existingForm = await prisma.gadForm.findFirst({
    where: { userId, status: 'IN_PROGRESS' },
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
