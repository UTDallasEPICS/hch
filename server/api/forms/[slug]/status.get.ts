import { prisma } from '../../../utils/prisma'
import { auth } from '../../../utils/auth'

export default defineEventHandler(async (event) => {
  const slug = getRouterParam(event, 'slug')
  if (!slug) {
    throw createError({ statusCode: 400, message: 'Missing form slug' })
  }

  const session = await auth.api.getSession({
    headers: event.node.req.headers,
  })
  if (!session?.user?.id) {
    throw createError({ statusCode: 401, message: 'Unauthorized' })
  }
  const userId = session.user.id

  const form = await prisma.form.findUnique({ where: { slug } })
  if (!form) {
    throw createError({ statusCode: 404, message: 'Form not found' })
  }

  const assignment = await prisma.formAssignment.findUnique({
    where: {
      userId_formId: { userId, formId: form.id },
    },
  })

  return {
    isCompleted: !!assignment?.completedAt,
    completedAt: assignment?.completedAt || null,
  }
})
