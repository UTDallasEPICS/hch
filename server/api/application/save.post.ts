import { createError, defineEventHandler, getHeaders, readBody } from 'h3'
import { auth } from '../../utils/auth'
import { prisma } from '../../utils/prisma'

type AnswersBody = {
  q1?: string
  q2?: string
  q3?: string
  q4?: string
  q5?: string
  q6?: string
  q7?: string
  q8?: string
  q9?: string
  q10?: string
  q11?: string
  q12?: string
  q13?: string
  q14?: string
  q15?: string
  q16?: string
  q17?: string
  q18?: string
  q19?: string
  q20?: string
  q21?: string
  q22?: string
  q23?: string
  q24?: string
  q25?: string
  q26?: string
  q27?: string
  q28?: string
  q29?: string
  q30?: string
  q31?: string
  q32?: string
  q33?: string
  q34?: string
  q35?: string
  q36?: string
  q37?: string
  q38?: string
  q39?: string
  q40?: string
  q41?: string
  q42?: string
  q43?: string
  q44?: string
  q45?: string
  q46?: string
  q47?: string
  q48?: string
  q49?: string
  q50?: string
}

const TOTAL_QUESTIONS = 50

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

  let form = await prisma.appForm.findFirst({
    where: {
      userId,
    },
    orderBy: {
      id: 'asc',
    },
  })

  if (!form) {
    form = await prisma.appForm.create({
      data: {
        userId,
        status: 'IN_PROGRESS',
      },
    })
  } else if (form.status === 'COMPLETE') {
    throw createError({
      statusCode: 403,
      statusMessage: 'Application already submitted',
    })
  }

  let existingQuestions = await prisma.appQuestion.findUnique({
    where: {
      formId: form.id,
    },
  })

  if (!existingQuestions) {
    existingQuestions = await prisma.appQuestion.create({
      data: {
        formId: form.id,
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

  const body = await readBody<AnswersBody>(event)

  const data: Record<string, string | null> = {}
  for (let index = 1; index <= TOTAL_QUESTIONS; index += 1) {
    const dbKey = `q${String(index).padStart(2, '0')}`
    const payloadKey = `q${index}` as keyof AnswersBody
    data[dbKey] = body?.[payloadKey] ?? null
  }

  await prisma.appQuestion.update({
    where: {
      id: existingQuestions.id,
    },
    data,
  })

  await prisma.appForm.update({
    where: {
      id: form.id,
    },
    data: {
      status: 'IN_PROGRESS',
      submittedAt: null,
    },
  })

  return {
    saved: true,
  }
})
