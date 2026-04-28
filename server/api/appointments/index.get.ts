import { requireUser } from '../../utils/guard'
import { defineEventHandler, getHeaders, createError, getQuery } from 'h3'
import { isAppointmentTableMissingError } from '../../utils/is-appointment-table-error'
import { prisma } from '../../utils/prisma'
import type { Prisma } from '../../../prisma/generated/client'

const appointmentInclude = {
  client: {
    select: {
      name: true,
      client: {
        select: {
          clinician: {
            select: { name: true, email: true },
          },
        },
      },
    },
  },
} satisfies Prisma.AppointmentInclude

type AppointmentWithClient = Prisma.AppointmentGetPayload<{
  include: typeof appointmentInclude
}>

export default defineEventHandler(async (event) => {
  const headers = new Headers()

  for (const [k, v] of Object.entries(getHeaders(event))) {
    if (v) headers.set(k, v)
  }

  const user = requireUser(event)
  const userId = user.id

  if (!userId) {
    throw createError({ statusCode: 403 })
  }

  const dbUser = await prisma.user.findUnique({
    where: { id: userId },
    select: { role: true },
  })

  if (!dbUser) {
    throw createError({ statusCode: 403 })
  }

  const query = getQuery(event)
  const clinicianUserIds =
    event.context.isAdmin && typeof query.clinicianUserId === 'string'
      ? query.clinicianUserId
          .split(',')
          .map((value) => value.trim())
          .filter(Boolean)
      : []
  const hasClinicianUserIdFilter = clinicianUserIds.length > 0
  const clientIds =
    typeof query.clientId === 'string'
      ? query.clientId
          .split(',')
          .map((value) => value.trim())
          .filter(Boolean)
      : []
  const hasClientIdFilter = clientIds.length > 0

  let appointments: AppointmentWithClient[] = []

  try {
    if (event.context.isAdmin) {
      appointments = await prisma.appointment.findMany({
        where: {
          ...(hasClientIdFilter ? { clientId: { in: clientIds } } : {}),
          ...(hasClinicianUserIdFilter
            ? {
                client: {
                  client: {
                    clinicianUserId: { in: clinicianUserIds },
                  },
                },
              }
            : {}),
        },
        include: appointmentInclude,
      })
    } else if (event.context.isClinician) {
      // CLINICIAN → only appointments whose client is assigned to them
      appointments = await prisma.appointment.findMany({
        where: {
          ...(hasClientIdFilter ? { clientId: { in: clientIds } } : {}),
          client: {
            client: { clinicianUserId: userId },
          },
        },
        include: appointmentInclude,
      })
    } else {
      appointments = await prisma.appointment.findMany({
        where: {
          clientId: hasClientIdFilter ? { in: clientIds } : userId,
        },
        include: appointmentInclude,
      })
    }
  } catch (e: unknown) {
    if (isAppointmentTableMissingError(e)) {
      appointments = []
    } else {
      throw e
    }
  }

  return appointments.map((a) => ({
    id: a.id,
    title: a.title,
    sessionName: a.sessionName,
    sessionNumber: a.sessionNumber,
    start: a.startTime,
    end: a.endTime,
    clientName: a.client.name,
    description: a.description,
    status: a.status,
    videoProvider: a.videoProvider,
    videoJoinUrl: a.videoJoinUrl,
    assignedClinicianName:
      a.client.client?.clinician?.name ?? a.client.client?.clinician?.email ?? null,
  }))
})
