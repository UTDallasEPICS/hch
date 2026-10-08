import prisma from '~~/server/utils/prisma'
import { auth } from '~~/server/utils/auth'

export default defineEventHandler(async (event) => {
  // 1. Get logged-in user
  const session = await auth.api.getSession({ headers: event.headers })
  if (!session?.user) throw createError({ statusCode: 401, message: 'Unauthorized' })

  // 2. Find client and their assigned clinician ID
  const client = await prisma.client.findUnique({
    where: { userId: session.user.id },
    select: { clinicianUserId: true }
  })

  // 3. If no clinician is assigned, send back false
  if (!client?.clinicianUserId) {
    return { hasClinician: false, slots: [] }
  }

  // 4. Fetch only upcoming open slots for that clinician
  const slots = await prisma.availability_slot.findMany({
    where: {
      clinicianUserId: client.clinicianUserId,
      status: 'OPEN',
      startTime: { gt: new Date() }
    },
    orderBy: { startTime: 'asc' }
  })

  return { hasClinician: true, slots }
})