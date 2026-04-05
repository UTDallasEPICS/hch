import { requireUser } from '../../../utils/guard'
import { createError, defineEventHandler } from 'h3'
import { prisma } from '../../../utils/prisma'

export default defineEventHandler(async (event) => {
  const user = requireUser(event)
  const userId = user.id

  const form = await prisma.aceForm.findFirst({
    where: { userId },
    orderBy: { id: 'desc' },
    include: { questions: true },
  })

  if (!form || !form.questions) {
    throw createError({
      statusCode: 400,
      statusMessage: 'ACE form not started',
    })
  }

  if (form.status === 'COMPLETE') {
    return { submitted: true }
  }

  const keys = ['a01', 'a02', 'a03', 'a04', 'a05', 'a06', 'a07', 'a08', 'a09', 'a10']
  let answeredCount = 0
  let score = 0

  for (const k of keys) {
    const val = (form.questions as any)[k]
    if (val !== null && val !== undefined && val !== '') {
      answeredCount++
      if (val === 'Yes') {
        score++
      }
    }
  }

  if (answeredCount !== 10) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Please complete all required questions before submitting',
    })
  }

  let severity = 'No reported ACEs'
  if (score > 0 && score <= 3) severity = 'Intermediate risk'
  else if (score > 3) severity = 'High risk'

  await prisma.aceForm.update({
    where: { id: form.id },
    data: {
      status: 'COMPLETE',
      submittedAt: new Date(),
      totalScore: score,
      severity,
    },
  })

  return { submitted: true }
})
