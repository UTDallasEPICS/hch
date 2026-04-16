import { requireUser } from '../../../utils/guard'
import { createError, defineEventHandler } from 'h3'
import { prisma } from '../../../utils/prisma'

export default defineEventHandler(async (event) => {

  const user = requireUser(event)

  const userId = user.id
  if (!userId) {
    throw createError({
      statusCode: 401,
      statusMessage: 'Unauthorized',
    })
  }

  let existingForm = await prisma.pclForm.findFirst({
    where: { userId },
    orderBy: { id: 'asc' },
  })

  let created = false
  if (!existingForm) {
    existingForm = await prisma.pclForm.create({
      data: {
        userId,
        status: 'IN_PROGRESS',
      },
    })
    created = true
  }

  let existingQuestions = await prisma.pclQuestion.findUnique({
    where: { formId: existingForm.id },
  })

  if (!existingQuestions) {
    existingQuestions = await prisma.pclQuestion.create({
      data: {
        formId: existingForm.id,
        userId,
      },
    })
  }

  return {
    formId: existingForm.id,
    created,
    submitted: existingForm.status === 'COMPLETE',
    totalScore: existingForm.totalScore,
    severity: existingForm.severity,
    answers: existingQuestions,
  }
})