import { requireUser } from '../../../utils/guard'
import { createError, defineEventHandler, readBody } from 'h3'
import { prisma } from '../../../utils/prisma'
import { calculatePhqScore } from '../../../utils/scoring'

type AnswersBody = {
  q1?: number
  q2?: number
  q3?: number
  q4?: number
  q5?: number
  q6?: number
  q7?: number
  q8?: number
  q9?: number
  q10?: number
}

const TOTAL_QUESTIONS = 10

export default defineEventHandler(async (event) => {
  const user = requireUser(event)

  const userId = user.id
  if (!userId) {
    throw createError({
      statusCode: 401,
      statusMessage: 'Unauthorized',
    })
  }

  let form = await prisma.phqForm.findFirst({
    where: { userId },
    orderBy: { id: 'desc' },
  })

  if (!form) {
    form = await prisma.phqForm.create({
      data: {
        userId,
        status: 'IN_PROGRESS',
      },
    })
  } else if (form.status === 'COMPLETE') {
    throw createError({
      statusCode: 403,
      statusMessage: 'PHQ already submitted',
    })
  }

  let existingQuestions = await prisma.phqQuestion.findUnique({
    where: { formId: form.id },
  })

  if (!existingQuestions) {
    existingQuestions = await prisma.phqQuestion.create({
      data: {
        formId: form.id,
        userId,
      },
    })
  }

  const body = await readBody<AnswersBody>(event)

  const data: Record<string, number | null> = {}
  for (let index = 1; index <= TOTAL_QUESTIONS; index += 1) {
    const dbKey = `q${index}`
    const payloadKey = `q${index}` as keyof AnswersBody
    const value = body?.[payloadKey]
    data[dbKey] = typeof value === 'number' ? value : null
  }

  // Single source of truth for PHQ-9 scoring + severity labels (#91).
  const { score: totalScore, severity } = calculatePhqScore(data)

  await prisma.phqQuestion.update({
    where: { id: existingQuestions.id },
    data,
  })

  // save score
  await prisma.phqForm.update({
    where: { id: form.id },
    data: {
      status: 'COMPLETE', // ← was 'IN_PROGRESS'
      submittedAt: new Date(), // ← was null
      totalScore,
      severity,
    },
  })

  return { saved: true }
})
