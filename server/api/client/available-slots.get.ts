import { requireClientUser } from '../../utils/guard'
import { prisma } from '../../utils/prisma'

export default defineEventHandler(async (event) => {
  const user = requireClientUser(event)

  // Find the client row and their assigned clinician.
  const client = await prisma.client.findUnique({
    where: { userId: user.id },
    select: { clinicianUserId: true },
  })

  // 3. If no clinician is assigned, send back false
  if (!client?.clinicianUserId) {
    return { hasClinician: false, slots: [] }
  }

  // 4. Fetch only upcoming open slots for that clinician
  const slots = await prisma.availabilitySlot.findMany({
    where: {
      clinicianUserId: client.clinicianUserId,
      status: 'OPEN',
      startTime: { gt: new Date() },
    },
    select: {
      id: true,
      startTime: true,
      endTime: true,
      location: true,
      notes: true,
    },
    orderBy: { startTime: 'asc' },
  })

  return { hasClinician: true, slots }
})