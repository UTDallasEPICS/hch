import { defineEventHandler, getQuery } from 'h3'
import { requireAdmin } from '../../utils/guard'
import { prisma } from '../../utils/prisma'
import { parseClinicDateRange } from '../../utils/date-range'
import { buildOrgMetrics } from '../../utils/org-metrics'

/**
 * REQ-F-11 (#216): total clients, cumulative hours, and month-over-month growth.
 * Admin only. Optional `from` / `to` (YYYY-MM-DD, inclusive) limit the totals.
 */
export default defineEventHandler(async (event) => {
  requireAdmin(event)

  const { from, to } = parseClinicDateRange(getQuery(event))

  const [rows, activeClients] = await Promise.all([
    prisma.sessionLog.findMany({
      select: {
        id: true,
        supersedesId: true,
        clientUserId: true,
        sessionStart: true,
        countedMinutes: true,
      },
    }),
    prisma.client.count({ where: { status: 'ACTIVE', user: { role: 'CLIENT' } } }),
  ])

  return buildOrgMetrics({ rows, activeClients, now: new Date(), range: { from, to } })
})
