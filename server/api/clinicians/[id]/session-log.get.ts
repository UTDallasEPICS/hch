import { createError, defineEventHandler, getQuery, getRouterParam } from 'h3'
import { prisma } from '../../../utils/prisma'
import { parseClinicDateRange } from '../../../utils/date-range'
import { assertCanViewSessionLog, loadSessionLogReport } from '../../../utils/session-log-report'

/**
 * REQ-F-11 (#218): one clinician's session log. Admins: any clinician. Clinicians: their own.
 * Optional `from` / `to` (YYYY-MM-DD, inclusive, by session date).
 */
export default defineEventHandler(async (event) => {
  const clinicianUserId = getRouterParam(event, 'id')
  if (!clinicianUserId) {
    throw createError({ statusCode: 400, statusMessage: 'Missing clinician id' })
  }
  assertCanViewSessionLog(event, clinicianUserId)
  return loadSessionLogReport(prisma, clinicianUserId, parseClinicDateRange(getQuery(event)))
})
