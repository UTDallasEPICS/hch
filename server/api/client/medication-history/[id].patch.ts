import { createError, defineEventHandler, getRouterParam, readBody } from 'h3'
import { requireClientUser } from '../../../utils/guard'
import { parseMedicationInput, medicationHistorySelect } from '../../../utils/medical-history'
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
  const existing = await prisma.medicationHistory.findFirst({
    where: { id, clientId: clientRow.id },
    select: medicationHistorySelect,
  })
  if (!existing) {
    throw createError({ statusCode: 404, statusMessage: 'Medication history not found' })
  }

  const data = parseMedicationInput(await readBody(event), existing)

  return prisma.medicationHistory.update({
    where: { id: existing.id },
    data,
    select: medicationHistorySelect,
  })
})
