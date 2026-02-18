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

function hasAnswer(value: string | null | undefined) {
  if (!value) {
    return false
  }

  const trimmed = value.trim()
  if (trimmed.length === 0) {
    return false
  }

  try {
    const parsed = JSON.parse(trimmed) as unknown

    if (Array.isArray(parsed)) {
      return parsed.length > 0
    }

    if (parsed && typeof parsed === 'object') {
      const record = parsed as Record<string, unknown>

      if (Array.isArray(record.values)) {
        const other = typeof record.other === 'string' ? record.other.trim() : ''
        return record.values.length > 0 || other.length > 0
      }

      if ('value' in record || 'text' in record) {
        const selected = typeof record.value === 'string' ? record.value.trim() : ''
        const text = typeof record.text === 'string' ? record.text.trim() : ''
        return selected.length > 0 || text.length > 0
      }
    }
  } catch {
    return trimmed.length > 0
  }

  return trimmed.length > 0
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

  let existingQuestions = await prisma.appQuestion.findFirst({
    where: {
      userId,
    },
    orderBy: {
      id: 'asc',
    },
  })

  if (!existingQuestions) {
    let form = await prisma.appForm.findFirst({
      where: {
        userId,
        status: 'IN_PROGRESS',
      },
      orderBy: {
        id: 'desc',
      },
    })

    if (!form) {
      form = await prisma.appForm.create({
        data: {
          userId,
          status: 'IN_PROGRESS',
        },
      })
    }

    existingQuestions = await prisma.appQuestion.create({
      data: {
        formId: form.id,
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

  let answered = 0
  for (let index = 1; index <= TOTAL_QUESTIONS; index += 1) {
    const key = `q${String(index).padStart(2, '0')}`
    if (hasAnswer(data[key])) {
      answered += 1
    }
  }

  await prisma.appForm.update({
    where: {
      id: existingQuestions.formId,
    },
    data: {
      status: answered === TOTAL_QUESTIONS ? 'COMPLETE' : 'IN_PROGRESS',
    },
  })

  return {
    saved: true,
  }
})
