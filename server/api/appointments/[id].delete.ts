import { requireStaff } from '../../utils/guard'
import { assertStaffCanAccessClient } from '../../utils/clinician-access'
import { prisma } from '../../utils/prisma'
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

  // keep stage auth checks
  const user = requireStaff(event)
  const adminId = user.id // optional if needed elsewhere

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

  // ONE event only
  if (type === 'ONE' || !seriesId) {
    await prisma.appointment.delete({
      where: { id },
    })
  }

  // entire series
  else if (type === 'ALL') {
    await prisma.appointment.deleteMany({
      where: {
        seriesId,
      },
    })
  }

  // this and future
  else if (type === 'FUTURE') {
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
