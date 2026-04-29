import { requireAdmin } from '../../utils/guard'
import { defineEventHandler, getQuery } from 'h3'
import { prisma } from '../../utils/prisma'
import { formatStoredUserNameForDisplay, parseName } from '../../utils/name'

/**
 * Admin-only list of session notes that have been clinician-signed and are
 * waiting on final admin approval. Supports `?kind=PROGRESS|PSYCHOTHERAPY`.
 */
export default defineEventHandler(async (event) => {
  requireAdmin(event)

  const query = getQuery(event)
  const kindParam =
    typeof query.kind === 'string' ? query.kind.toUpperCase() : ''
  const kindFilter =
    kindParam === 'PROGRESS' || kindParam === 'PSYCHOTHERAPY'
      ? { kind: kindParam }
      : {}

  const rows = await prisma.sessionNote.findMany({
    where: {
      status: 'CLINICIAN_SIGNED',
      ...kindFilter,
    },
    orderBy: { clinicianSignedAt: 'asc' },
    include: {
      client: {
        select: {
          userId: true,
          user: { select: { id: true, name: true, email: true } },
        },
      },
      clinicianSigner: { select: { id: true, name: true, email: true } },
      appointment: { select: { startTime: true } },
    },
  })

  return rows.map((r) => {
    const clientName =
      formatStoredUserNameForDisplay(r.client?.user?.name ?? '') ||
      r.client?.user?.name ||
      'Client'
    const clinicianName = r.clinicianSigner
      ? formatStoredUserNameForDisplay(r.clinicianSigner.name ?? '') ||
        r.clinicianSigner.name
      : null
    return {
      id: r.id,
      clientUserId: r.client?.userId ?? null,
      clientName,
      clientEmail: r.client?.user?.email ?? null,
      sessionName: r.sessionName,
      sessionNumber: r.sessionNumber,
      kind: r.kind,
      status: r.status,
      content: r.content,
      attended: r.attended,
      appointmentId: r.appointmentId,
      appointmentStartTime: r.appointment?.startTime?.toISOString() ?? null,
      clinicianSignedAt: r.clinicianSignedAt?.toISOString() ?? null,
      clinicianSignatureData: r.clinicianSignatureData,
      clinicianUserId: r.clinicianSigner?.id ?? null,
      clinicianName,
      createdAt: r.createdAt.toISOString(),
      updatedAt: r.updatedAt.toISOString(),
    }
  })
})
