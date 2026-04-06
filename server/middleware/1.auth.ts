import { auth } from '../utils/auth'
import { isAdmin } from '../utils/is-admin'

export default defineEventHandler(async (event) => {
  const path = event.path

  // Skip middleware for public routes.
  // auth handles its own routes, we don't want to intercept them.
  if (path.startsWith('/api/auth')) {
    return
  }

  // Only run this on /api/ routes
  if (!path.startsWith('/api/')) {
    return
  }

  const session = await auth.api.getSession({
    headers: event.headers,
  })

  if (!session?.user) {
    throw createError({ statusCode: 401, statusMessage: 'Unauthorized' })
  }

  const user = session.user as any
  const userIsAdmin = isAdmin(user.role, user.email)

  // Enrich context
  event.context.user = user
  event.context.session = session.session
  event.context.isAdmin = userIsAdmin
})
