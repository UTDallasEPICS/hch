import { prisma } from '../../utils/prisma'
import { auth } from '../../utils/auth'

export default defineEventHandler(async (event) => {
  const session = await auth.api.getSession({
    headers: event.node.req.headers,
  })
  if (!session?.user?.id) {
    throw createError({ statusCode: 401, message: 'Unauthorized' })
  }
  const userId = session.user.id

  const body = await readBody(event)
  const { formId } = body as { formId?: string }
  if (!formId) {
    throw createError({ statusCode: 400, message: 'formId is required' })
  }

  const assignment = await prisma.formAssignment.upsert({
    where: {
      userId_formId: { userId, formId },
    },
    create: { userId, formId },
    update: {},
    include: { form: true },
  })

  return {
    id: assignment.id,
    formId: assignment.formId,
    title: assignment.form.title,
    slug: assignment.form.slug,
  }
})
