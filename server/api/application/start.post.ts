import { createError, defineEventHandler, getHeaders } from 'h3'
import { auth } from '../../utils/auth'
import { prisma } from '../../utils/prisma'

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

  let existingForm = await prisma.appForm.findFirst({
    where: {
      userId,
    },
    orderBy: {
      id: 'asc',
    },
  })
  let created = false

  if (!existingForm) {
    existingForm = await prisma.appForm.create({
      data: {
        userId,
        status: 'IN_PROGRESS',
      },
    })
    created = true
  }

  let existingQuestions = await prisma.appQuestion.findUnique({
    where: {
      formId: existingForm.id,
    },
  })

  if (!existingQuestions) {
    existingQuestions = await prisma.appQuestion.create({
      data: {
        formId: existingForm.id,
        userId,
      },
    })
  } else if (existingQuestions.userId !== userId) {
    existingQuestions = await prisma.appQuestion.update({
      where: {
        id: existingQuestions.id,
      },
      data: {
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
