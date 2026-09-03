import { prisma } from './prisma'
import type { NotificationType } from '../../prisma/generated/enums'

/**
 * Returns the user IDs of every user whose role is ADMIN, i.e. everyone who
 * should receive a system notification.
 */
export async function getAdminUserIds(): Promise<string[]> {
  const admins = await prisma.user.findMany({
    where: { role: 'ADMIN' },
    select: { id: true },
  })
  return admins.map((u) => u.id)
}

export async function notifyAdmins(opts: {
  type: NotificationType
  title: string
  message: string
  sessionNoteId?: string | null
}): Promise<number> {
  const adminIds = await getAdminUserIds()
  if (!adminIds.length) return 0

  await prisma.notification.createMany({
    data: adminIds.map((userId) => ({
      userId,
      type: opts.type,
      title: opts.title,
      message: opts.message,
      sessionNoteId: opts.sessionNoteId ?? null,
    })),
  })
  return adminIds.length
}

export async function notifyUser(opts: {
  userId: string
  type: NotificationType
  title: string
  message: string
  sessionNoteId?: string | null
}): Promise<void> {
  await prisma.notification.create({
    data: {
      userId: opts.userId,
      type: opts.type,
      title: opts.title,
      message: opts.message,
      sessionNoteId: opts.sessionNoteId ?? null,
    },
  })
}
