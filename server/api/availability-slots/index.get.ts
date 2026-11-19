import { defineEventHandler, getQuery } from 'h3'
import { requireStaff } from '../../utils/guard'
import { assertAvailabilityClinicianAccess } from '../../utils/availability-request'
import { prisma } from '../../utils/prisma'

export default defineEventHandler(async (event) => {
  const user = requireStaff(event)
  const query = getQuery(event)
  const clinicianUserId =
    typeof query.clinicianUserId === 'string' ? query.clinicianUserId : user.id
  await assertAvailabilityClinicianAccess(event, clinicianUserId)

  return prisma.availabilitySlot.findMany({
    where: {
      clinicianUserId,
      startTime: { gt: new Date() },
      status: { in: ['OPEN', 'BOOKED'] },
    },
    orderBy: { startTime: 'asc' },
  })
})
