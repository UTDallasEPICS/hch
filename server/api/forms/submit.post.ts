import { prisma } from '../../utils/prisma'
import { auth } from '../../utils/auth'

export default defineEventHandler(async (event) => {
  const body = await readBody(event)
  const { formSlug, responses } = body as {
    formSlug?: string
    responses?: Record<string, string | boolean>
  }

  if (!formSlug || !responses || typeof responses !== 'object') {
    throw createError({
      statusCode: 400,
      message: 'formSlug and responses (object) are required',
    })
  }

  const session = await auth.api.getSession({
    headers: event.node.req.headers,
  })
  if (!session?.user?.id) {
    throw createError({ statusCode: 401, message: 'Unauthorized' })
  }
  const userId = session.user.id

  const form = await prisma.form.findUnique({ where: { slug: formSlug } })
  if (!form) {
    throw createError({ statusCode: 404, message: 'Form not found' })
  }

  // Normalize values to strings for JSON storage
  const normalized: Record<string, string> = {}
  for (const [alias, value] of Object.entries(responses)) {
    normalized[alias] = value === true ? 'true' : value === false ? 'false' : String(value)
  }

  if (formSlug === 'ace-form') {
    // Find existing response and update, or create new
    const existing = await prisma.aceResponse.findFirst({
      where: { userId },
      orderBy: { completedAt: 'desc' },
    })

    if (existing) {
      await prisma.aceResponse.update({
        where: { id: existing.id },
        data: {
          responses: JSON.stringify(normalized),
          completedAt: new Date(),
        },
      })
    } else {
      await prisma.aceResponse.create({
        data: {
          userId,
          responses: JSON.stringify(normalized),
        },
      })
    }
  }
  // Future: other form slugs could write to other response tables

  // Mark form assignment complete for this user
  await prisma.formAssignment.upsert({
    where: {
      userId_formId: { userId, formId: form.id },
    },
    create: {
      userId,
      formId: form.id,
      completedAt: new Date(),
    },
    update: { completedAt: new Date() },
  })

  return { ok: true, message: 'Form submitted successfully' }
})
