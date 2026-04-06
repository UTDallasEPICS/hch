import { requireUser } from '../../../utils/guard'
import { createError, defineEventHandler, getHeaders } from 'h3'
import { prisma } from '../../../utils/prisma'

const TOTAL = 7

export default defineEventHandler(async (event) => {

  const user = requireUser(event)
  const userId = user.id

  

  const form = await prisma.gadForm.findFirst({
    where: { userId },
    orderBy: { id: 'desc' },
    include: { questions: true },
  })

  const q = form?.questions
  if (!form || !q) {
    throw createError({ statusCode: 400, statusMessage: 'GAD form not started' })
  }

  const answers = [q.g01, q.g02, q.g03, q.g04, q.g05, q.g06, q.g07]
  const answered = answers.filter((v) => v !== null && v !== undefined).length

  if (answered !== TOTAL) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Please complete all required questions before submitting',
    })
  }

  await prisma.gadForm.update({
    where: { id: form.id },
    data: {
      status: 'COMPLETE',
      submittedAt: new Date(),
    },
  })

  return { submitted: true }
})
