import { createError, defineEventHandler, getHeaders, readBody } from 'h3'
import { auth } from '../../utils/auth'
import { prisma } from '../../utils/prisma'

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

  let form = await prisma.phqForm.findFirst({
    where: { userId },
    orderBy: { id: 'asc' },
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
  let totalScore = 0
  for (let index = 1; index <= TOTAL_QUESTIONS; index += 1) {
    const dbKey = `q${(index)}`
    const payloadKey = `q${index}` as keyof AnswersBody
    const value = body?.[payloadKey]
    const numVal = typeof value === 'number' ? value : null
    data[dbKey] = numVal
    if (index <= 9) totalScore += numVal ?? 0
  }

  let severity: string | null = null
  if (totalScore <= 4) severity = 'Minimal or None'
  else if (totalScore <= 9) severity = 'Mild'
  else if (totalScore <= 14) severity = 'Moderate'
  else if (totalScore <= 19) severity = 'Moderately Severe'
  else severity = 'Severe'

  await prisma.phqQuestion.update({
    where: { id: existingQuestions.id },
    data,
  })

  await prisma.phqForm.update({
    where: { id: form.id },
    data: {
      status: 'IN_PROGRESS',
      submittedAt: null,
      totalScore,
      severity,
    },
  })

  return { saved: true } 
})