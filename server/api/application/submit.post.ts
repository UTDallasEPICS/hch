import { createError, defineEventHandler, getHeaders } from 'h3'
import { auth } from '../../utils/auth'
import { prisma } from '../../utils/prisma'
import { joinName } from '../../utils/name'

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

  const form = await prisma.appForm.findFirst({
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
    const key = `q${String(index).padStart(2, '0')}` as keyof typeof form.questions
    const value = form.questions[key]

    if (typeof value === 'string' && hasAnswer(value)) {
      answered += 1
    }
  }

  if (answered !== TOTAL_QUESTIONS) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Please complete all required questions before submitting',
    })
  }

  const firstName = typeof form.questions.q02 === 'string' ? form.questions.q02.trim() : ''
  const lastName = typeof form.questions.q03 === 'string' ? form.questions.q03.trim() : ''
  const fullName = joinName(firstName, lastName)

  const operations = [
    prisma.appForm.update({
      where: {
        id: form.id,
      },
      data: {
        status: 'COMPLETE',
        submittedAt: new Date(),
      },
    }),
  ]

  if (fullName) {
    operations.push(
      prisma.user.update({
        where: { id: userId },
        data: { name: fullName },
      })
    )
  }

  await prisma.$transaction(operations)

  return {
    submitted: true,
  }
})
