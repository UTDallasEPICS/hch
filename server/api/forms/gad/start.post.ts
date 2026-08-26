import { requireUser } from '../../../utils/guard'
import { defineEventHandler } from 'h3'
import { prisma } from '../../../utils/prisma'

export default defineEventHandler(async (event) => {
  const user = requireUser(event)
  const userId = user.id

  // Find latest form
  const existingForm = await prisma.gadForm.findFirst({
    where: { userId },
    orderBy: { id: 'desc' },
  })

  if (existingForm) {
    let questions = await prisma.gadQuestion.findFirst({
      where: { formId: existingForm.id },
    })

    if (!questions) {
      questions = await prisma.gadQuestion.create({
        data: {
          formId: existingForm.id,
          userId,
        },
      })
    }

    return {
      formId: existingForm.id,
      answers: questions,
    }
  }

  // Create new form
  const createdForm = await prisma.gadForm.create({
    data: { userId },
  })

  const createdQuestions = await prisma.gadQuestion.create({
    data: {
      formId: createdForm.id,
      userId,
    },
  })

  return {
    formId: createdForm.id,
    answers: createdQuestions,
  }
})
