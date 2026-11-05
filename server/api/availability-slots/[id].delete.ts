import { createError, defineEventHandler, getRouterParam } from 'h3'
import { requireStaff } from '../../utils/guard'
import { assertAvailabilityClinicianAccess } from '../../utils/availability-request'
import { prisma } from '../../utils/prisma'

export default defineEventHandler(async (event) => {
  requireStaff(event)
  const id = getRouterParam(event, 'id')
  if (!id) throw createError({ statusCode: 400, statusMessage: 'Missing slot id' })

  const slot = await prisma.availabilitySlot.findUnique({
    where: { id },
    select: { clinicianUserId: true, startTime: true, status: true },
  })
  if (!slot) throw createError({ statusCode: 404, statusMessage: 'Availability slot not found' })
  await assertAvailabilityClinicianAccess(event, slot.clinicianUserId)
  if (slot.status !== 'OPEN' || slot.startTime <= new Date()) {
    throw createError({
      statusCode: 409,
      statusMessage: 'Only future open availability slots can be deleted',
    })
  }

  const deleted = await prisma.availabilitySlot.deleteMany({
    where: { id, status: 'OPEN', startTime: { gt: new Date() } },
  })
  if (deleted.count !== 1) {
    throw createError({ statusCode: 409, statusMessage: 'Availability slot is no longer deletable' })
  }
  return { success: true }
})
