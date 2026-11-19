import { defineEventHandler } from 'h3'
import { requireClientUser } from '../../../utils/guard'
import { medicationHistorySelect } from '../../../utils/medical-history'
import { prisma } from '../../../utils/prisma'

export default defineEventHandler(async (event) => {
  const user = requireClientUser(event)

  // Client rows are created lazily, so a client with no row simply has no history yet.
  const clientRow = await prisma.client.findUnique({
    where: { userId: user.id },
    select: { id: true },
  })
  if (!clientRow) return []

  return prisma.medicationHistory.findMany({
    where: { clientId: clientRow.id },
    select: medicationHistorySelect,
    orderBy: [{ startDate: 'desc' }, { createdAt: 'desc' }],
  })
})
