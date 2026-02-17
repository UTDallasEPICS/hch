import { createError, defineEventHandler, getHeaders, readBody } from 'h3'
import { auth } from '../../utils/auth'
import { prisma } from '../../utils/prisma'

export default defineEventHandler(async (event) => {
  const requestHeaders = new Headers()

  for (const [key, value] of Object.entries(getHeaders(event))) {
    if (value !== undefined) requestHeaders.set(key, value)
  }

  const session = await auth.api.getSession({ headers: requestHeaders })
  const userId = session?.user?.id

  if (!userId) {
    throw createError({ statusCode: 401, statusMessage: 'Unauthorized' })
  }

  const body = await readBody(event)

  const questions = await prisma.gadQuestion.findFirst({
    where: { userId },
  })

  if (!questions) {
    throw createError({
      statusCode: 404,
      statusMessage: 'GAD row not found',
    })
  }

  const total =
    (body.g1 ?? 0) +
    (body.g2 ?? 0) +
    (body.g3 ?? 0) +
    (body.g4 ?? 0) +
    (body.g5 ?? 0) +
    (body.g6 ?? 0) +
    (body.g7 ?? 0)

  let severity = 'Minimal'

  if (total >= 15) severity = 'Severe'
  else if (total >= 10) severity = 'Moderate'
  else if (total >= 5) severity = 'Mild'

  await prisma.gadQuestion.update({
    where: { id: questions.id },
    data: {
      g01: body.g1,
      g02: body.g2,
      g03: body.g3,
      g04: body.g4,
      g05: body.g5,
      g06: body.g6,
      g07: body.g7,
      g08: body.g8,
    },
  })

  await prisma.gadForm.update({
    where: { id: questions.formId },
    data: {
      totalScore: total,
      severity,
    },
  })

  return { saved: true }
})
