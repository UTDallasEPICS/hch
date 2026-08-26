import type { PrismaClient } from '../../prisma/generated/client'
import type { VideoConferenceProvider } from '../../prisma/generated/enums'

type AppointmentDb = Pick<PrismaClient, 'user' | 'appointment' | 'client' | 'sessionNote'>

function sanitizeNamePart(part: string | null | undefined) {
  const normalized = (part ?? '').trim().replace(/\s+/g, '_')
  return normalized.replace(/[^A-Za-z0-9_]/g, '')
}

function deriveSessionName(fullName: string | null | undefined, sessionNumber: number) {
  const raw = (fullName ?? '').trim()
  const pieces = raw.split(/\s+/).filter(Boolean)

  const first = sanitizeNamePart(pieces[0] ?? 'Client') || 'Client'
  const last = sanitizeNamePart(pieces.slice(1).join('_') || 'Unknown') || 'Unknown'

  return `${first}_${last}_${String(sessionNumber).padStart(2, '0')}`
}

function nextAvailableNumber(used: number[]) {
  const usedSet = new Set(used.filter((n) => Number.isInteger(n) && n > 0))
  let candidate = 1
  while (usedSet.has(candidate)) candidate += 1
  return candidate
}

export type CreateStaffAppointmentInput = {
  staffUserId: string
  clientUserId: string
  startTime: Date
  endTime: Date
  description?: string | null
  videoProvider?: VideoConferenceProvider | null
  videoJoinUrl?: string | null
}

/**
 * Creates a scheduled appointment and placeholder session note (same rules as POST /api/appointments).
 * Caller must enforce auth, client access, and time validation.
 */
export async function createStaffAppointment(
  db: AppointmentDb,
  input: CreateStaffAppointmentInput
) {
  const { staffUserId, clientUserId, startTime, endTime, description } = input
  const videoProvider = input.videoProvider ?? null
  const videoJoinUrl = input.videoJoinUrl ?? null

  const [clientUser, existingAppointments] = await Promise.all([
    db.user.findUnique({
      where: { id: clientUserId },
      select: { name: true, role: true },
    }),
    db.appointment.findMany({
      where: { clientId: clientUserId },
      select: { sessionNumber: true, status: true },
    }),
  ])

  if (!clientUser || clientUser.role !== 'CLIENT') {
    throw new Error('INVALID_CLIENT')
  }

  const activeSessionNumbers = existingAppointments
    .filter((a) => {
      const normalized = String(a.status ?? '').toUpperCase()
      return normalized !== 'CANCELED' && normalized !== 'CANCELLED'
    })
    .map((a) => a.sessionNumber)

  const sessionNumber = nextAvailableNumber(activeSessionNumbers)
  const sessionName = deriveSessionName(clientUser.name, sessionNumber)

  const appointment = await db.appointment.create({
    data: {
      clientId: clientUserId,
      adminId: staffUserId,
      title: sessionName,
      sessionName,
      sessionNumber,
      description: description ?? null,
      startTime,
      endTime,
      status: 'SCHEDULED',
      // 'NONE' is the no-recurrence sentinel used everywhere else (index.post.ts,
      // [id].put.ts, calendar.vue); '' left this path inconsistent. (#96)
      recurrence: 'NONE',
      videoProvider,
      videoJoinUrl,
    },
  })

  const clientRow = await db.client.findUnique({
    where: { userId: clientUserId },
    select: { id: true },
  })

  if (clientRow) {
    await db.sessionNote.create({
      data: {
        clientId: clientRow.id,
        appointmentId: appointment.id,
        sessionName,
        sessionNumber,
        content: '',
        attendanceStatus: 'show',
      },
    })
  }

  return appointment
}
