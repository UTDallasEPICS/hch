import { defineEventHandler, getQuery } from 'h3'
import { requireUser } from '../../utils/guard'
import { prisma } from '../../utils/prisma'

/**
 * Fetch the caller's notifications, newest first.
 * Query params:
 *   unread=true  – only return unread items
 *   limit=N      – cap results (default 25, max 100)
 */
export default defineEventHandler(async (event) => {
  const user = requireUser(event)
  const query = getQuery(event)
  const unreadOnly = String(query.unread ?? '') === 'true'
  const limitRaw = Number(query.limit ?? 25)
  const limit = Number.isFinite(limitRaw)
    ? Math.max(1, Math.min(100, Math.floor(limitRaw)))
    : 25

  const [items, unreadCount] = await Promise.all([
    prisma.notification.findMany({
      where: {
        userId: user.id,
        ...(unreadOnly ? { readAt: null } : {}),
      },
      orderBy: { createdAt: 'desc' },
      take: limit,
    }),
    prisma.notification.count({
      where: { userId: user.id, readAt: null },
    }),
  ])

  return {
    unreadCount,
    items: items.map((n) => ({
      id: n.id,
      type: n.type,
      title: n.title,
      message: n.message,
      sessionNoteId: n.sessionNoteId,
      readAt: n.readAt?.toISOString() ?? null,
      createdAt: n.createdAt.toISOString(),
    })),
  }
})
