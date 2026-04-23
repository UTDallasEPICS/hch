import { requireUser } from '../../utils/guard'
import { defineEventHandler, getHeaders, createError } from 'h3'
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

  if (!user) {
    throw createError({ statusCode: 403 })
  }

  let appointments

  // ADMIN → see all
  if (event.context.isAdmin) {
    appointments = await prisma.appointment.findMany({
      include: {
        client: {
          select: { name: true },
        },
      },
    })
  }

  // CLIENT → see only their own
  else {
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

  return appointments.map((a) => ({
    id: a.id,
    title: a.title,
    start: a.startTime,
    end: a.endTime,
    clientName: a.client.name,
    description: a.description,
    status: a.status,
    seriesId: a.seriesId,
  }))
})
