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
  q11?: number
  q12?: number
  q13?: number
  q14?: number
  q15?: number
  q16?: number
  q17?: number
  q18?: number
  q19?: number
  q20?: number
  worstEvent?: string
}

const TOTAL_QUESTIONS = 20

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

  let form = await prisma.pCLForm.findFirst({
    where: { userId },
    orderBy: { id: 'asc' },
  })

  if (!form) {
    form = await prisma.pCLForm.create({
      data: {
        userId,
        status: 'IN_PROGRESS',
      },
    })
  } else if (form.status === 'COMPLETE') {
    throw createError({
      statusCode: 403,
      statusMessage: 'PCL-5 already submitted',
    })
  }

  let existingQuestions = await prisma.pCLQuestion.findUnique({
    where: { formId: form.id },
  })

  if (!existingQuestions) {
    existingQuestions = await prisma.pCLQuestion.create({
      data: {
        formId: form.id,
        userId,
      },
    })
  }

  const body = await readBody<AnswersBody>(event)

  const data: Record<string, number | null> = {}
  for (let index = 1; index <= TOTAL_QUESTIONS; index += 1) {
    const dbKey = `q${String(index).padStart(2, '0')}`
    const payloadKey = `q${index}` as keyof AnswersBody
    const value = body?.[payloadKey]
    data[dbKey] = typeof value === 'number' ? value : null
  }

  await prisma.pCLQuestion.update({
    where: { id: existingQuestions.id },
    data,
  })

  await prisma.pCLForm.update({
    where: { id: form.id },
    data: {
      status: 'IN_PROGRESS',
      submittedAt: null,
    },
  })

  return { saved: true }
})