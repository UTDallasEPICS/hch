import { defineEventHandler, getQuery } from 'h3'
import { requireAdmin } from '../../utils/guard'
import { prisma } from '../../utils/prisma'

export default defineEventHandler(async (event) => {
  requireAdmin(event)

  const query = getQuery(event)
  const preserveManual = String(query.preserveManual ?? 'true').toLowerCase() !== 'false'

  const clients = await prisma.client.findMany({
    select: {
      id: true,
      userId: true,
      missedSessions: true,
    },
  })

  let updated = 0

  for (const client of clients) {
    const calendarAbsences = await prisma.sessionNote.count({
      where: {
        clientId: client.id,
        attended: false,
      },
    })

    const nextMissedSessions = preserveManual
      ? Math.max(0, calendarAbsences + (client.missedSessions - calendarAbsences))
      : calendarAbsences

    if (nextMissedSessions !== client.missedSessions) {
      await prisma.client.update({
        where: { id: client.id },
        data: { missedSessions: nextMissedSessions },
      })
      updated += 1
    }
  }

  return {
    success: true,
    preserveManual,
    totalClients: clients.length,
    updatedClients: updated,
  }
})
