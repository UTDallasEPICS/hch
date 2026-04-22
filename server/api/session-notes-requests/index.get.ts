import { requireStaff } from '../../utils/guard'
import { defineEventHandler } from 'h3'
import { prisma } from '../../utils/prisma'
import {
  ensureDefaultDeclarationTemplates,
  RECORDS_REQUEST_APPROVAL_WINDOW_DAYS,
} from '../../utils/declaration-templates'

export default defineEventHandler(async (event) => {
  const user = requireStaff(event)
  const isClinicianViewer = event.context.isClinician === true && !event.context.isAdmin

  await ensureDefaultDeclarationTemplates(prisma)

  const pending = await prisma.sessionNotesRequest.findMany({
    where: {
      status: 'PENDING',
      ...(isClinicianViewer ? { client: { clinicianUserId: user.id } } : {}),
    },
    include: {
      declarationTemplate: true,
      client: {
        include: {
          user: { select: { id: true, name: true, email: true } },
        },
      },
    },
    orderBy: { createdAt: 'asc' },
  })

  const windowMs = RECORDS_REQUEST_APPROVAL_WINDOW_DAYS * 24 * 60 * 60 * 1000

  return pending.map((r) => {
    const expiresAt = new Date(r.createdAt.getTime() + windowMs)
    return {
      id: r.id,
      requestKind: r.requestKind,
      status: r.status,
      createdAt: r.createdAt.toISOString(),
      startDate: r.startDate?.toISOString() ?? null,
      endDate: r.endDate?.toISOString() ?? null,
      declarationText: r.declarationTemplate.content,
      declarationTemplateId: r.declarationTemplateId,
      declarationVersion: r.declarationTemplate.version,
      signatureData: r.signatureData,
      clientUserId: r.client.userId,
      clientName: r.client.user.name,
      clientEmail: r.client.user.email,
      approvalWindowDays: RECORDS_REQUEST_APPROVAL_WINDOW_DAYS,
      approvalExpiresAt: expiresAt.toISOString(),
    }
  })
})
