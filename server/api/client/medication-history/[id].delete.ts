import { createError, defineEventHandler, getRouterParam } from 'h3'
import { requireClientUser } from '../../../utils/guard'
import { prisma } from '../../../utils/prisma'

export default defineEventHandler(async (event) => {
  const user = requireClientUser(event)
  const id = getRouterParam(event, 'id')
  if (!id) {
    throw createError({ statusCode: 400, statusMessage: 'Missing id' })
  }

  const clientRow = await prisma.client.findUnique({
    where: { userId: user.id },
    select: { id: true },
  })
  if (!clientRow) {
    throw createError({ statusCode: 404, statusMessage: 'Medication history not found' })
  }

  // Scoped to this client: someone else's record looks the same as a missing one.
  const { count } = await prisma.medicationHistory.deleteMany({
    where: { id, clientId: clientRow.id },
  })
  if (count === 0) {
    throw createError({ statusCode: 404, statusMessage: 'Medication history not found' })
  }

  return { success: true }
})
