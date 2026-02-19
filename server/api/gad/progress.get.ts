import { createError, defineEventHandler, getHeaders } from 'h3'
import { auth } from '../../utils/auth'
import { prisma } from '../../utils/prisma'

const TOTAL = 7

export default defineEventHandler(async (event) => {
  const requestHeaders = new Headers()

  for (const [key, value] of Object.entries(getHeaders(event))) {
    if (value !== undefined) requestHeaders.set(key, value)
  }

  const session = await auth.api.getSession({ headers: requestHeaders })
  const userId = session?.user?.id

  if (!userId) {
    throw createError({ statusCode: 401 })
  }

  const form = await prisma.gadForm.findFirst({
    where: { userId, status: 'IN_PROGRESS' },
    orderBy: { id: 'desc' },
  })

  if (!form) return { answered: 0, total: TOTAL }

  const q = await prisma.gadQuestion.findFirst({
    where: { formId: form.id },
  })

  if (!q) return { answered: 0, total: TOTAL }

  const answers = [q.g01, q.g02, q.g03, q.g04, q.g05, q.g06, q.g07]

  const answered = answers.filter((v) => v !== null && v !== undefined).length

  return { answered, total: TOTAL }
})
