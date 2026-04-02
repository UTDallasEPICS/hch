import { createError, defineEventHandler, getHeaders } from 'h3'
import { auth } from '../../utils/auth'
import { formatStoredUserNameForDisplay } from '../../utils/name'
import { prisma } from '../../utils/prisma'
import { isAdmin } from '../../utils/is-admin'

const CLINICAL_STATUS_LABEL: Record<string, string> = {
  INCOMPLETE: 'Pre-waitlist',
  WAITLIST: 'Waitlist',
  ACTIVE: 'Active',
  ARCHIVED: 'Archived',
}

function welcomeDisplayName(user: { name: string | null; email: string }): string {
  const formatted = formatStoredUserNameForDisplay(user.name ?? '')
  if (formatted) return formatted
  const local = user.email.split('@')[0]?.trim()
  if (local) {
    return local
      .split(/[._-]/)
      .filter(Boolean)
      .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
      .join(' ')
  }
  return 'there'
}

export default defineEventHandler(async (event) => {
  const requestHeaders = new Headers()
  for (const [key, value] of Object.entries(getHeaders(event))) {
    if (value !== undefined) requestHeaders.set(key, value)
  }

  const session = await auth.api.getSession({ headers: requestHeaders })
  if (!session?.user?.id) {
    throw createError({ statusCode: 401, statusMessage: 'Unauthorized' })
  }

  const currentUser = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { role: true, email: true, name: true },
  })
  if (!isAdmin(currentUser?.role ?? null, currentUser?.email ?? null)) {
    throw createError({ statusCode: 403, statusMessage: 'Forbidden' })
  }

  const displayName = currentUser ? welcomeDisplayName(currentUser) : 'there'

  const [userCount, clientCount, pendingSessionNotesRequests, viewerClient] =
    await prisma.$transaction([
      prisma.user.count(),
      prisma.client.count(),
      prisma.sessionNotesRequest.count({ where: { status: 'PENDING' } }),
      prisma.client.findUnique({
        where: { userId: session.user.id },
        select: { status: true },
      }),
    ])

  const statusLabel = viewerClient
    ? CLINICAL_STATUS_LABEL[viewerClient.status] ?? viewerClient.status
    : 'Administrator'

  return {
    userCount,
    clientCount,
    pendingSessionNotesRequests,
    displayName,
    statusLabel,
  }
})
