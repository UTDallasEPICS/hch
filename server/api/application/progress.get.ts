import { createError, defineEventHandler, getHeaders } from 'h3'
import { auth } from '../../utils/auth'
import { prisma } from '../../utils/prisma'

const TOTAL_QUESTIONS = 51

function hasAnswer(value: string | null | undefined, questionNumber: number) {
  if (!value) {
    return false
  }

  if (questionNumber === 18) {
    try {
      const parsed = JSON.parse(value)
      if (Array.isArray(parsed)) {
        return parsed.length > 0
      }
    } catch {
      return value.trim().length > 0
    }
  }

  return value.trim().length > 0
}

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

  const questions = await prisma.appQuestion.findFirst({
    where: {
      userId,
    },
    orderBy: {
      id: 'asc',
    },
  })

  if (!questions) {
    return {
      answered: 0,
      total: TOTAL_QUESTIONS,
    }
  }

  let answered = 0

  for (let index = 1; index <= TOTAL_QUESTIONS; index += 1) {
    const key = `q${String(index).padStart(2, '0')}` as keyof typeof questions
    const value = questions[key]

    if (typeof value === 'string' && hasAnswer(value, index)) {
      answered += 1
    }
  }

  return {
    answered,
    total: TOTAL_QUESTIONS,
  }
})
