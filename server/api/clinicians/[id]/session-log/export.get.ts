import { createError, defineEventHandler, getQuery, getRouterParam, setResponseHeader } from 'h3'
import { prisma } from '../../../../utils/prisma'
import { parseClinicDateRange } from '../../../../utils/date-range'
import { formatStoredUserNameForDisplay } from '../../../../utils/name'
import {
  assertCanViewSessionLog,
  buildSessionLogCsv,
  loadSessionLogReport,
  sessionLogCsvFileName,
} from '../../../../utils/session-log-report'

/**
 * REQ-F-11 (#218): CSV of one clinician's session log, for credentialing.
 * Same access and range as the JSON route. Every export is recorded in
 * session_log_export because the file leaves the system.
 */
export default defineEventHandler(async (event) => {
  const clinicianUserId = getRouterParam(event, 'id')
  if (!clinicianUserId) {
    throw createError({ statusCode: 400, statusMessage: 'Missing clinician id' })
  }
  const user = assertCanViewSessionLog(event, clinicianUserId)
  const range = parseClinicDateRange(getQuery(event))
  const report = await loadSessionLogReport(prisma, clinicianUserId, range)

  const exportedAt = new Date()
  await prisma.sessionLogExport.create({
    data: {
      exportedById: user.id,
      clinicianUserId,
      rangeFrom: range.from ?? null,
      rangeTo: range.to ?? null,
      rowCount: report.rows.length,
      createdAt: exportedAt,
    },
  })

  const exportedBy = formatStoredUserNameForDisplay(user.name ?? '') || user.email
  setResponseHeader(event, 'Content-Type', 'text/csv; charset=utf-8')
  setResponseHeader(
    event,
    'Content-Disposition',
    `attachment; filename="${sessionLogCsvFileName(report)}"`
  )
  setResponseHeader(event, 'Cache-Control', 'no-store')
  return buildSessionLogCsv(report, { exportedAt, exportedBy })
})
