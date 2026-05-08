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

/**
 * Staff = Admin OR Clinician. Use this on endpoints that both admins and
 * clinicians should be able to call. Clinician-scoped filtering is the caller's
 * responsibility (use event.context.isClinician + event.context.user.id).
 */
export function requireStaff(event: H3Event) {
  const user = requireUser(event)
  if (!event.context.isStaff) {
    throw createError({ statusCode: 403, statusMessage: 'Forbidden: Staff access required' })
  }
  return user
}

/** Authenticated portal user who is not staff (typical client account). */
export function requireClientUser(event: H3Event) {
  const user = requireUser(event)
  if (event.context.isStaff) {
    throw createError({ statusCode: 403, statusMessage: 'Forbidden' })
  }
  if (user.role !== 'CLIENT') {
    throw createError({ statusCode: 403, statusMessage: 'Forbidden' })
  }
  return user
}
