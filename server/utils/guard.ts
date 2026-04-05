import { H3Event, createError } from 'h3'

export function requireUser(event: H3Event) {
  if (!event.context.user) {
    throw createError({ statusCode: 401, statusMessage: 'Unauthorized' })
  }
  return event.context.user
}

export function requireAdmin(event: H3Event) {
  const user = requireUser(event)
  if (!event.context.isAdmin) {
    throw createError({ statusCode: 403, statusMessage: 'Forbidden: Admin access required' })
  }
  return user
}
