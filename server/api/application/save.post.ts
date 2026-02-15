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
  q51?: string
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

  const existingQuestions = await prisma.appQuestion.findFirst({
    where: {
      userId,
    },
    orderBy: {
      id: 'asc',
    },
  })

  if (!existingQuestions) {
    throw createError({
      statusCode: 404,
      statusMessage: 'Application question row not found for this user',
    })
  }

  const body = await readBody<AnswersBody>(event)

  await prisma.appQuestion.update({
    where: {
      id: existingQuestions.id,
    },
    data: {
      q01: body?.q1 ?? null,
      q02: body?.q2 ?? null,
      q03: body?.q3 ?? null,
      q04: body?.q4 ?? null,
      q05: body?.q5 ?? null,
      q06: body?.q6 ?? null,
      q07: body?.q7 ?? null,
      q08: body?.q8 ?? null,
      q09: body?.q9 ?? null,
      q10: body?.q10 ?? null,
      q11: body?.q11 ?? null,
      q12: body?.q12 ?? null,
      q13: body?.q13 ?? null,
      q14: body?.q14 ?? null,
      q15: body?.q15 ?? null,
      q16: body?.q16 ?? null,
      q17: body?.q17 ?? null,
      q18: body?.q18 ?? null,
      q19: body?.q19 ?? null,
      q20: body?.q20 ?? null,
      q21: body?.q21 ?? null,
      q22: body?.q22 ?? null,
      q23: body?.q23 ?? null,
      q24: body?.q24 ?? null,
      q25: body?.q25 ?? null,
      q26: body?.q26 ?? null,
      q27: body?.q27 ?? null,
      q28: body?.q28 ?? null,
      q29: body?.q29 ?? null,
      q30: body?.q30 ?? null,
      q31: body?.q31 ?? null,
      q32: body?.q32 ?? null,
      q33: body?.q33 ?? null,
      q34: body?.q34 ?? null,
      q35: body?.q35 ?? null,
      q36: body?.q36 ?? null,
      q37: body?.q37 ?? null,
      q38: body?.q38 ?? null,
      q39: body?.q39 ?? null,
      q40: body?.q40 ?? null,
      q41: body?.q41 ?? null,
      q42: body?.q42 ?? null,
      q43: body?.q43 ?? null,
      q44: body?.q44 ?? null,
      q45: body?.q45 ?? null,
      q46: body?.q46 ?? null,
      q47: body?.q47 ?? null,
      q48: body?.q48 ?? null,
      q49: body?.q49 ?? null,
      q50: body?.q50 ?? null,
      q51: body?.q51 ?? null,
    },
  })

  return {
    saved: true,
  }
})
