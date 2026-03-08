import { createError, defineEventHandler, getHeaders } from 'h3'
import { auth } from '../../utils/auth'
import { prisma } from '../../utils/prisma'

const TOTAL_QUESTIONS = 10

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

  if (!form || !form.questions) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Application form not started',
    })
  }

  if (form.status === 'COMPLETE') {
    return {
      submitted: true,
    }
  }

  let answered = 0
  for (let index = 1; index <= TOTAL_QUESTIONS; index += 1) {
    const key = `q${index}` as keyof typeof form.questions
    const value = form.questions[key]

    if (typeof value === 'number') {
      answered += 1
    }
  }

  if (answered !== TOTAL_QUESTIONS) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Please complete all required questions before submitting',
    })
  }

  let totalScore = 0
  for (let index = 1; index <= 9; index += 1) {
    const key = `q${index}` as keyof typeof form.questions
    const value = form.questions[key]
    totalScore += typeof value === 'number' ? value : 0
  }

  let severity = 'Minimal or no depression'
  if (totalScore > 19) severity = 'Severe depression'
  else if (totalScore > 14) severity = 'Moderately severe depression'
  else if (totalScore > 9) severity = 'Moderate depression'
  else if (totalScore > 4) severity = 'Mild depression'

  await prisma.phqForm.update({
    where: {
      id: form.id,
    },
    data: {
      status: 'COMPLETE',
      submittedAt: new Date(),
      totalScore,
      severity,
    },
  })

  return {
    submitted: true,
  }
})
