import { requireUser } from '../../../utils/guard'
import { defineEventHandler } from 'h3'
import { prisma } from '../../../utils/prisma'

export default defineEventHandler(async (event) => {
  const user = requireUser(event)

  const userId = user.id

  // userId is indexed but not unique, so use findFirst on the latest form (#91).
  let existingForm = await prisma.aceForm.findFirst({
    where: { userId },
    orderBy: { id: 'desc' },
    include: { questions: true },
  })

  if (!existingForm) {
    existingForm = await prisma.aceForm.create({
      data: {
        userId,
        status: 'IN_PROGRESS',
        questions: {
          create: { userId },
        },
      },
      include: { questions: true },
    })
  } else if (!existingForm.questions) {
    const questions = await prisma.aceQuestion.create({
      data: { formId: existingForm.id, userId },
    })
    existingForm.questions = questions
  }

  return {
    formId: existingForm.id,
    answers: existingForm.questions,
  }
})
