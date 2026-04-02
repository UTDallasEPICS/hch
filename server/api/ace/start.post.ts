import { createError, defineEventHandler, getHeaders } from 'h3'
import { auth } from '../../utils/auth'
import { prisma } from '../../utils/prisma'

export default defineEventHandler(async (event) => {
  const requestHeaders = new Headers()
  for (const [key, value] of Object.entries(getHeaders(event))) {
    if (value !== undefined) requestHeaders.set(key, value)
  }

  const session = await auth.api.getSession({ headers: requestHeaders })
  if (!session?.user?.id) {
    throw createError({ statusCode: 401, statusMessage: 'Unauthorized' })
  }
  const userId = session.user.id

  let existingForm = await prisma.aceForm.findUnique({
    where: { userId },
    include: { questions: true },
  })

  if (!existingForm) {
    existingForm = await prisma.aceForm.create({
      data: {
        userId,
        status: 'IN_PROGRESS',
        questions: {
          create: { userId }
        }
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
