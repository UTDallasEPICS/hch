import { createError, defineEventHandler, getHeaders } from 'h3'
import { auth } from '../../utils/auth'
import { prisma } from '../../utils/prisma'

const TOTAL_QUESTIONS = 20
const TOTAL_ITEMS = 21

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

  const form = await prisma.pclForm.findFirst({
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
      statusMessage: 'PCL-5 form not started',
    })
  }

  if (form.status === 'COMPLETE') {
    return {
      submitted: true,
    }
  }

  let answered = 0
  for (let index = 1; index <= TOTAL_QUESTIONS; index += 1) {
    const key = `q${String(index).padStart(2, '0')}` as keyof typeof form.questions
    const value = form.questions[key]

    if (typeof value === 'number') {
      answered += 1
    }
  }

  if (
    typeof form.questions.worstEvent === 'string' &&
    form.questions.worstEvent.trim().length > 0
  ) {
    answered += 1
  }

  if (answered !== TOTAL_ITEMS) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Please complete all required questions before submitting',
    })
  }

  let totalScore = 0
  for (let index = 1; index <= TOTAL_QUESTIONS; index += 1) {
    const key = `q${String(index).padStart(2, '0')}` as keyof typeof form.questions
    const value = form.questions[key]
    totalScore += typeof value === 'number' ? value : 0
  }

  let severity = 'Minimal'
  if (totalScore > 60) severity = 'Severe'
  else if (totalScore > 40) severity = 'Moderate'
  else if (totalScore > 20) severity = 'Mild'

  await prisma.pclForm.update({
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
