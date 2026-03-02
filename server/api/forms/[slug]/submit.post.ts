import { createError, defineEventHandler, getHeaders } from 'h3'
import { auth } from '../../../utils/auth'
import { prisma } from '../../../utils/prisma'
import { getAceFormQuestions } from '../../../utils/ace-questions'

export default defineEventHandler(async (event) => {
  const slug = getRouterParam(event, 'slug')
  if (!slug) {
    throw createError({ statusCode: 400, message: 'Missing form slug' })
  }

  const requestHeaders = new Headers()
  for (const [key, value] of Object.entries(getHeaders(event))) {
    if (value !== undefined) requestHeaders.set(key, String(value))
  }
  const session = await auth.api.getSession({ headers: requestHeaders })
  if (!session?.user?.id) {
    throw createError({ statusCode: 401, message: 'Unauthorized' })
  }
  const userId = session.user.id

  if (slug === 'ace-form') {
    const questions = getAceFormQuestions()
    const aceResponse = await prisma.aceResponse.findFirst({
      where: { userId },
      orderBy: { completedAt: 'desc' },
    })
    const responses = aceResponse ? (JSON.parse(aceResponse.responses) as Record<string, string>) : {}
    const answered = questions.filter(
      (q) => responses[q.alias] !== undefined && String(responses[q.alias]).trim().length > 0
    ).length

    if (answered !== questions.length) {
      throw createError({
        statusCode: 400,
        statusMessage: 'Please complete all required questions before submitting',
      })
    }

    const form = await prisma.form.findUnique({ where: { slug } })
    if (!form) {
      throw createError({ statusCode: 404, message: 'Form not found' })
    }

    await prisma.formAssignment.upsert({
      where: { userId_formId: { userId, formId: form.id } },
      create: {
        userId,
        formId: form.id,
        completedAt: new Date(),
      },
      update: { completedAt: new Date() },
    })

    return { submitted: true }
  }

  throw createError({ statusCode: 404, message: 'Form not found' })
})
