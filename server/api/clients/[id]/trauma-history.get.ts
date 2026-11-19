import { createError, defineEventHandler, getRouterParam } from 'h3'
import { requireStaff } from '../../../utils/guard'
import { assertStaffCanAccessClient } from '../../../utils/clinician-access'
import { traumaHistorySelect } from '../../../utils/medical-history'
import { prisma } from '../../../utils/prisma'

// Read-only for staff: clients manage these records themselves.
export default defineEventHandler(async (event) => {
  requireStaff(event)

  const clientUserId = getRouterParam(event, 'id')
  if (!clientUserId) {
    throw createError({ statusCode: 400, statusMessage: 'Missing client id' })
  }

  await assertStaffCanAccessClient(event, clientUserId)

  const clientRow = await prisma.client.findUnique({
    where: { userId: clientUserId },
    select: { id: true },
  })
  if (!clientRow) {
    throw createError({ statusCode: 404, statusMessage: 'Client not found' })
  }

  return prisma.traumaHistory.findMany({
    where: { clientId: clientRow.id },
    select: traumaHistorySelect,
    orderBy: [{ approximateDate: 'desc' }, { createdAt: 'desc' }],
  })
})
