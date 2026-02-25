import { prisma } from '../../../utils/prisma'
import { auth } from '../../../utils/auth'

export default defineEventHandler(async (event) => {
  const slug = getRouterParam(event, 'slug')
  if (!slug) {
    throw createError({ statusCode: 400, message: 'Missing form slug' })
  }

  const body = await readBody(event)
  const { responses } = body as {
    responses?: Record<string, string | boolean>
  }

  if (!responses || typeof responses !== 'object') {
    throw createError({
      statusCode: 400,
      message: 'responses (object) is required',
    })
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

  // Normalize values to strings for JSON storage
  const normalized: Record<string, string> = {}
  for (const [alias, value] of Object.entries(responses)) {
    normalized[alias] = value === true ? 'true' : value === false ? 'false' : String(value)
  }

  if (slug === 'ace-form') {
    // Upsert: update existing response or create new one
    const existing = await prisma.aceResponse.findFirst({
      where: { userId },
      orderBy: { completedAt: 'desc' },
    })

    if (existing) {
      await prisma.aceResponse.update({
        where: { id: existing.id },
        data: {
          responses: JSON.stringify(normalized),
          completedAt: new Date(), // Update timestamp
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

  // Ensure form assignment exists (create if not exists, don't mark complete)
  await prisma.formAssignment.upsert({
    where: {
      userId_formId: { userId, formId: form.id },
    },
    create: {
      userId,
      formId: form.id,
    },
    update: {}, // Don't update completedAt on auto-save
  })

  return { ok: true }
})
