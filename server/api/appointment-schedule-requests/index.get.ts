import { requireStaff } from '../../utils/guard'
import { defineEventHandler } from 'h3'
import { prisma } from '../../utils/prisma'

function mapRow(r: {
  id: string
  requestedStartTime: Date
  requestedEndTime: Date
  message: string | null
  status: string
  createdAt: Date
  decidedAt: Date | null
  staffResponseNote: string | null
  createdAppointmentId: string | null
  client: { id: string; name: string; email: string }
}) {
  return {
    id: r.id,
    clientUserId: r.client.id,
    clientName: r.client.name,
    clientEmail: r.client.email,
    requestedStartTime: r.requestedStartTime.toISOString(),
    requestedEndTime: r.requestedEndTime.toISOString(),
    message: r.message,
    status: r.status,
    createdAt: r.createdAt.toISOString(),
    decidedAt: r.decidedAt?.toISOString() ?? null,
    staffResponseNote: r.staffResponseNote,
    createdAppointmentId: r.createdAppointmentId,
  }
}

export default defineEventHandler(async (event) => {
  const user = requireStaff(event)
  const isClinicianViewer = event.context.isClinician === true && !event.context.isAdmin

  /** Request.client is the client's User row; User.client is the Client profile (has clinicianUserId). */
  const assignedClinicianOnly = isClinicianViewer
    ? {
        client: {
          client: {
            clinicianUserId: user.id,
          },
        },
      }
    : {}

  const [pending, history] = await Promise.all([
    prisma.appointmentScheduleRequest.findMany({
      where: {
        status: 'PENDING',
        ...assignedClinicianOnly,
      },
      include: {
        client: { select: { id: true, name: true, email: true } },
      },
      orderBy: { createdAt: 'asc' },
    }),
    prisma.appointmentScheduleRequest.findMany({
      where: {
        status: { in: ['ACCEPTED', 'DENIED'] },
        ...assignedClinicianOnly,
      },
      include: {
        client: { select: { id: true, name: true, email: true } },
      },
      orderBy: { decidedAt: 'desc' },
      take: 40,
    }),
  ])

  return {
    pending: pending.map(mapRow),
    history: history.map(mapRow),
  }
})
