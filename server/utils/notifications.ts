import { prisma } from './prisma'
import type { NotificationType } from '../../prisma/generated/enums'

/**
 * Returns the user IDs of every admin who should receive a system notification.
 * Includes role=ADMIN users and anyone whose email is on INITIAL_ADMIN_EMAIL
 * (the same env list checked by `isAdmin`).
 */
export async function getAdminUserIds(): Promise<string[]> {
  const adminByRole = await prisma.user.findMany({
    where: { role: 'ADMIN' },
    select: { id: true },
  })
  const ids = new Set(adminByRole.map((u) => u.id))

  const envList = (process.env.INITIAL_ADMIN_EMAIL ?? '')
    .split(',')
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean)

  if (envList.length) {
    const byEmail = await prisma.user.findMany({
      where: { email: { in: envList } },
      select: { id: true },
    })
    for (const u of byEmail) ids.add(u.id)
  }

  return Array.from(ids)
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
