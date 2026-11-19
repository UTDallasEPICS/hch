import { requireStaff } from '../../utils/guard'
import { assertStaffCanAccessClient } from '../../utils/clinician-access'
import { prisma } from '../../utils/prisma'
import { syncAppointmentDelete } from '../../utils/googleCalendarSync'
import { createError, defineEventHandler, getRouterParam, readBody } from 'h3'

export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id')
  const { type, startTime, seriesId } = await readBody(event)

  if (!id) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Missing appointment id',
    })
  }

  requireStaff(event)

  const existing = await prisma.appointment.findUnique({
    where: { id },
    select: {
      clientId: true,
      seriesId: true,
    },
  })

  if (!existing) {
    throw createError({
      statusCode: 404,
      statusMessage: 'Appointment not found',
    })
  }

  await assertStaffCanAccessClient(event, existing.clientId)

  if (type === 'ONE' || !seriesId) {
    await syncAppointmentDelete(id)
    await prisma.appointment.delete({
      where: { id },
    })
  } else if (type === 'ALL') {
    const toDelete = await prisma.appointment.findMany({
      where: { seriesId },
      select: { id: true },
    })
    for (const appt of toDelete) {
      await syncAppointmentDelete(appt.id)
    }
    await prisma.appointment.deleteMany({
      where: { seriesId },
    })
  } else if (type === 'FUTURE') {
    const toDelete = await prisma.appointment.findMany({
      where: {
        seriesId,
        startTime: {
          gte: new Date(startTime),
        },
      },
      select: { id: true },
    })
    for (const appt of toDelete) {
      await syncAppointmentDelete(appt.id)
    }
    await prisma.appointment.deleteMany({
      where: {
        seriesId,
        startTime: {
          gte: new Date(startTime),
        },
      },
    })
  }

  return { success: true }
})