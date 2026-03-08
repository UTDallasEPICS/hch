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

  if (slug === 'ace-form') {
    const response = await prisma.aceResponse.findFirst({
      where: { userId },
      orderBy: { completedAt: 'desc' },
    })
    if (response) {
      return JSON.parse(response.responses)
    }
  }
  // Future: other form slugs could query other response tables

  return {}
})
