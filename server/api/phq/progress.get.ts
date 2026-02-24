import { createError, defineEventHandler, getHeaders } from 'h3'
import { auth } from '../../utils/auth'
import { prisma } from '../../utils/prisma'

const TOTAL_QUESTIONS = 9

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

  const form = await prisma.phqForm.findFirst({
    where: {
      userId,
    },
    orderBy: {
      id: 'asc',
    },
    include: {
      questions: true,
    },
  })

  const questions = form?.questions

  if (!questions) {
    return {
      answered: 0,
      total: TOTAL_QUESTIONS,
      submitted: false,
    }
  }

  let answered = 0

  for (let index = 1; index <= TOTAL_QUESTIONS; index += 1) {
    const key = `q${index}` as keyof typeof questions
    const value = questions[key]

    if (typeof value === 'number' && value>=0) {
      answered += 1
    }
  }

  return {
    answered,
    total: TOTAL_QUESTIONS,
    submitted: form.status === 'COMPLETE',
  }
})