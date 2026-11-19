import { defineEventHandler, getQuery } from 'h3'
import { requireAdmin } from '../../utils/guard'
import { prisma } from '../../utils/prisma'
import { backfillSessionLog } from '../../utils/session-log'

/**
 * REQ-F-11 (#215): log every note that was signed before the session log existed.
 * Re-runnable. `?dryRun=true` reports what would be written without writing it.
 */
export default defineEventHandler(async (event) => {
  const user = requireAdmin(event)
  const dryRun = String(getQuery(event).dryRun ?? 'false').toLowerCase() === 'true'
  return backfillSessionLog(prisma, { recordedById: user.id, dryRun })
})
