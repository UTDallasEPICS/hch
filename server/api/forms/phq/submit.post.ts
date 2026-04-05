import { requireUser } from '../../../utils/guard'
import { createError, defineEventHandler, getHeaders } from 'h3'
import { prisma } from '../../../utils/prisma'

const TOTAL_ITEMS = 10

export default defineEventHandler(async (event) => {
  const user = requireUser(event)

  const userId = user.id

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
  for (let index = 1; index <= 9; index += 1) {
    const key = `q${index}` as keyof typeof form.questions
    const value = form.questions[key]

    if (typeof value === 'number' && value >= 0) {
      answered += 1
    }
  }

  if (typeof form.questions.q10 === 'number' && form.questions.q10 >= 0) {
    answered += 1
  }

  if (answered !== TOTAL_ITEMS) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Please complete all required questions before submitting',
    })
  }

  let totalScore = 0
  for (let index = 1; index <= 9; index += 1) {
    const key = `q${index}` as keyof typeof form.questions
    const value = form.questions[key]
    totalScore += typeof value === 'number' && value >= 0 ? value : 0
  }

  await prisma.phqForm.update({
    where: {
      id: form.id,
    },
    data: {
      status: 'COMPLETE',
      submittedAt: new Date(),
      totalScore,
    },
  })

  return {
    submitted: true,
  }
})
