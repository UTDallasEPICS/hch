import { createError, defineEventHandler } from 'h3'
import { prisma } from '../../utils/prisma'
import { requireClientUser } from '../../utils/guard'

export default defineEventHandler(async (event) => {
  const user = requireClientUser(event)

  const clientRow = await prisma.client.findUnique({
    where: { userId: user.id },
    select: { id: true },
  })
  if (!clientRow) {
    throw createError({ statusCode: 403, statusMessage: 'Client profile not found' })
  }

  const rows = await prisma.appointmentScheduleRequest.findMany({
    where: { clientId: user.id },
    orderBy: { createdAt: 'desc' },
    select: {
      id: true,
      requestedStartTime: true,
      requestedEndTime: true,
      message: true,
      status: true,
      createdAt: true,
      updatedAt: true,
      decidedAt: true,
      staffResponseNote: true,
      createdAppointmentId: true,
    },
  })

  return rows.map((r) => ({
    id: r.id,
    requestedStartTime: r.requestedStartTime.toISOString(),
    requestedEndTime: r.requestedEndTime.toISOString(),
    message: r.message,
    status: r.status,
    createdAt: r.createdAt.toISOString(),
    updatedAt: r.updatedAt.toISOString(),
    decidedAt: r.decidedAt?.toISOString() ?? null,
    staffResponseNote: r.staffResponseNote,
    createdAppointmentId: r.createdAppointmentId,
  }))
})
