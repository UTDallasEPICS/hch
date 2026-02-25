import { createError, defineEventHandler, getHeaders, readBody } from 'h3'
import { auth } from '../../utils/auth'
import { prisma } from '../../utils/prisma'

type GadBody = {
  g1?: number | string | null
  g2?: number | string | null
  g3?: number | string | null
  g4?: number | string | null
  g5?: number | string | null
  g6?: number | string | null
  g7?: number | string | null
  g8?: number | string | null
}

function toNullableInt(value: number | string | null | undefined) {
  if (value === null || value === undefined || value === '') return null
  const parsed = typeof value === 'number' ? value : Number.parseInt(value, 10)
  return Number.isNaN(parsed) ? null : parsed
}

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

  const body = await readBody<GadBody>(event)

  // find or create form
  let form = await prisma.gadForm.findFirst({
    where: { userId },
    orderBy: { id: 'desc' },
  })

  if (!form) {
    form = await prisma.gadForm.create({
      data: { userId },
    })
  }

  //find or create questions row
  let questions = await prisma.gadQuestion.findFirst({
    where: { formId: form.id },
  })

  if (!questions) {
    questions = await prisma.gadQuestion.create({
      data: {
        formId: form.id,
        userId,
      },
    })
  }

  const g1 = toNullableInt(body.g1)
  const g2 = toNullableInt(body.g2)
  const g3 = toNullableInt(body.g3)
  const g4 = toNullableInt(body.g4)
  const g5 = toNullableInt(body.g5)
  const g6 = toNullableInt(body.g6)
  const g7 = toNullableInt(body.g7)
  const g8 = toNullableInt(body.g8)

  // calculate score
  const total =
    (g1 ?? 0) +
    (g2 ?? 0) +
    (g3 ?? 0) +
    (g4 ?? 0) +
    (g5 ?? 0) +
    (g6 ?? 0) +
    (g7 ?? 0)

  let severity = 'Minimal'

  if (total >= 15) severity = 'Severe'
  else if (total >= 10) severity = 'Moderate'
  else if (total >= 5) severity = 'Mild'

  // save answers
  await prisma.gadQuestion.update({
    where: { id: questions.id },
    data: {
      g01: g1,
      g02: g2,
      g03: g3,
      g04: g4,
      g05: g5,
      g06: g6,
      g07: g7,
      g08: g8,
    },
  })

  // save score
  await prisma.gadForm.update({
    where: { id: form.id },
    data: {
      totalScore: total,
      severity,
    },
  })

  return { saved: true }
})
