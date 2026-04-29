import { createError, defineEventHandler, getRouterParam } from 'h3'
import { requireUser } from '../../../utils/guard'
import { prisma } from '../../../utils/prisma'

/**
 * Mark one of the caller's own notifications as read. Idempotent.
 * Passing `id=all` marks every unread notification for the caller.
 */
export default defineEventHandler(async (event) => {
  const user = requireUser(event)
  const id = getRouterParam(event, 'id')
  if (!id) {
    throw createError({ statusCode: 400, statusMessage: 'Missing notification id' })
  }

  if (id === 'all') {
    const { count } = await prisma.notification.updateMany({
      where: { userId: user.id, readAt: null },
      data: { readAt: new Date() },
    })
    return { ok: true, markedRead: count }
  }

  const existing = await prisma.notification.findFirst({
    where: { id, userId: user.id },
    select: { id: true, readAt: true },
  })
  if (!existing) {
    throw createError({ statusCode: 404, statusMessage: 'Notification not found' })
  }
  if (existing.readAt) {
    return { ok: true, alreadyRead: true }
  }
  await prisma.notification.update({
    where: { id: existing.id },
    data: { readAt: new Date() },
  })
  return { ok: true }
})
