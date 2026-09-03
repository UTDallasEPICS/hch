import { auth } from '../utils/auth'
import { isAdmin, isClinician, isStaff } from '../utils/is-admin'

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
  const userIsAdmin = isAdmin(user.role)
  const userIsClinician = isClinician(user.role)
  const userIsStaff = isStaff(user.role)

  event.context.user = user
  event.context.session = session.session
  event.context.isAdmin = userIsAdmin
  event.context.isClinician = userIsClinician
  event.context.isStaff = userIsStaff
})
