import { requireUser } from '../../utils/guard'
import { defineEventHandler, getHeaders, createError } from 'h3'
import { isAppointmentTableMissingError } from '../../utils/is-appointment-table-error'
import { prisma } from '../../utils/prisma'

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

  let appointments: Awaited<ReturnType<typeof prisma.appointment.findMany>> = []

  try {
    if (event.context.isAdmin) {
      appointments = await prisma.appointment.findMany({
        include: {
          client: {
            select: { name: true },
          },
        },
      })
    } else if (event.context.isClinician) {
      // CLINICIAN → only appointments whose client is assigned to them
      appointments = await prisma.appointment.findMany({
        where: {
          client: {
            client: { clinicianUserId: userId },
          },
        },
        include: {
          client: {
            select: { name: true },
          },
        },
      })
    } else {
      appointments = await prisma.appointment.findMany({
        where: {
          clientId: userId,
        },
        include: {
          client: {
            select: { name: true },
          },
        },
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
  }))
})
