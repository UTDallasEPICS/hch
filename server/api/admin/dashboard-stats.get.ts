import { createError, defineEventHandler, getHeaders } from 'h3'
import { auth } from '../../utils/auth'
import { formatStoredUserNameForDisplay } from '../../utils/name'
import { prisma } from '../../utils/prisma'
import { isAdmin, isClinician, isStaff } from '../../utils/is-admin'

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
  const hasAdminAccess = isAdmin(currentUser?.role ?? null, currentUser?.email ?? null)
  const isClinicianViewer = !hasAdminAccess && isClinician(currentUser?.role ?? null)
  if (!isStaff(currentUser?.role ?? null, currentUser?.email ?? null)) {
    throw createError({ statusCode: 403, statusMessage: 'Forbidden' })
  }

  const displayName = currentUser ? welcomeDisplayName(currentUser) : 'there'

  // Admins see global counts; clinicians see counts scoped to their assigned clients.
  const clientWhere = isClinicianViewer ? { clinicianUserId: session.user.id } : {}
  const pendingWhere = isClinicianViewer
    ? { status: 'PENDING' as const, client: { clinicianUserId: session.user.id } }
    : { status: 'PENDING' as const }

  /** Schedule requests use clientId → User; scope by User.client (profile) → clinician. */
  const pendingScheduleRequestWhere = isClinicianViewer
    ? {
        status: 'PENDING' as const,
        client: {
          client: { clinicianUserId: session.user.id },
        },
      }
    : { status: 'PENDING' as const }

  // Pending note approvals: only admins can act on this queue, so clinicians
  // see 0 (their own CLINICIAN_SIGNED notes aren't "pending approval" to them).
  const pendingNoteApprovalsWhere = isClinicianViewer
    ? { id: '__never__' }
    : { status: 'CLINICIAN_SIGNED' as const }

  const [
    userCount,
    clientCount,
    pendingSessionNotesRequests,
    pendingAppointmentScheduleRequests,
    pendingNoteApprovals,
    unreadNotifications,
    viewerClient,
  ] = await prisma.$transaction([
    isClinicianViewer
      ? prisma.user.count({ where: { client: { clinicianUserId: session.user.id } } })
      : prisma.user.count(),
    prisma.client.count({ where: clientWhere }),
    prisma.sessionNotesRequest.count({ where: pendingWhere }),
    prisma.appointmentScheduleRequest.count({ where: pendingScheduleRequestWhere }),
    prisma.sessionNote.count({ where: pendingNoteApprovalsWhere }),
    prisma.notification.count({
      where: { userId: session.user.id, readAt: null },
    }),
    prisma.client.findUnique({
      where: { userId: session.user.id },
      select: { status: true },
    }),
  ])

  const statusLabel = viewerClient
    ? (CLINICAL_STATUS_LABEL[viewerClient.status] ?? viewerClient.status)
    : isClinicianViewer
      ? 'Clinician'
      : 'Administrator'

  return {
    userCount,
    clientCount,
    pendingSessionNotesRequests,
    pendingAppointmentScheduleRequests,
    pendingNoteApprovals,
    unreadNotifications,
    displayName,
    statusLabel,
  }
})
