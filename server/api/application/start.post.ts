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

  const existingForm = await prisma.appForm.findFirst({
    where: {
      userId,
      status: 'IN_PROGRESS',
    },
    orderBy: {
      id: 'desc',
    },
  })

  if (existingForm) {
    let existingQuestions = await prisma.appQuestion.findFirst({
      where: {
        userId,
      },
      orderBy: {
        id: 'asc',
      },
    })

    if (!existingQuestions) {
      existingQuestions = await prisma.appQuestion.create({
        data: {
          formId: existingForm.id,
          userId,
        },
      })
    } else if (existingQuestions.formId !== existingForm.id) {
      existingQuestions = await prisma.appQuestion.update({
        where: {
          id: existingQuestions.id,
        },
        data: {
          formId: existingForm.id,
        },
      })
    }

    return {
      formId: existingForm.id,
      created: false,
      answers: existingQuestions,
    }
  }

  const createdForm = await prisma.appForm.create({
    data: {
      userId,
      status: 'IN_PROGRESS',
    },
  })

  const createdQuestions = await prisma.appQuestion.create({
    data: {
      formId: createdForm.id,
      userId,
    },
  })

  return {
    formId: createdForm.id,
    created: true,
    answers: createdQuestions,
  }
})
