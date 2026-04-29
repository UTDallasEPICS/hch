// Returns raw db values for the application form
import { requireUser } from '../../../../../utils/guard'
import { assertStaffCanAccessClient } from '../../../../../utils/clinician-access'
import { createError, defineEventHandler, getRouterParam } from 'h3'
import { prisma } from '../../../../../utils/prisma'

export default defineEventHandler(async (event) => {
  requireUser(event)
  const clientUserId = getRouterParam(event, 'id')
  const formKey = getRouterParam(event, 'formKey')

  if (!clientUserId || !formKey) {
    throw createError({ statusCode: 400, statusMessage: 'Missing params' })
  }
  if (!event.context.isStaff) {
    throw createError({ statusCode: 403, statusMessage: 'Staff only' })
  }
  await assertStaffCanAccessClient(event, clientUserId)

  if (formKey !== 'application') {
    throw createError({ statusCode: 400, statusMessage: 'Raw endpoint only supports application' })
  }

  const appForm = await prisma.appForm.findFirst({
    where: { userId: clientUserId },
    orderBy: { id: 'desc' },
    include: { questions: true },
  })

  if (!appForm?.questions) return { answers: {} }

  const q = appForm.questions
  const answers: Record<string, string> = {}
  for (let i = 1; i <= 50; i++) {
    const key = `q${String(i).padStart(2, '0')}` as keyof typeof q
    const val = q[key]
    answers[key] = typeof val === 'string' ? val : ''
  }

  return { answers }
})