import { createError, defineEventHandler, getQuery } from 'h3'
import { requireAdmin } from '../../utils/guard'
import { prisma } from '../../utils/prisma'
import { addClinicTime, clinicDateTime } from '../../utils/clinic-time'
import { buildOrgMetrics } from '../../utils/org-metrics'

/** Optional "YYYY-MM-DD" clinic date. `endOfDay` makes it an exclusive upper bound. */
function parseClinicDate(value: unknown, endOfDay = false): Date | undefined {
  if (value === undefined || value === '') return undefined
  const start = typeof value === 'string' ? clinicDateTime(value, '00:00') : new Date(NaN)
  if (Number.isNaN(start.getTime())) {
    throw createError({ statusCode: 400, statusMessage: 'Dates must be YYYY-MM-DD' })
  }
  return endOfDay ? addClinicTime(start, { days: 1 }) : start
}

/**
 * REQ-F-11 (#216): total clients, cumulative hours, and month-over-month growth.
 * Admin only. Optional `from` / `to` (YYYY-MM-DD, inclusive) limit the totals.
 */
export default defineEventHandler(async (event) => {
  requireAdmin(event)

  const query = getQuery(event)
  const from = parseClinicDate(query.from)
  const to = parseClinicDate(query.to, true)

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
