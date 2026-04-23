import { requireStaff } from '../../utils/guard'
import { defineEventHandler } from 'h3'
import { prisma } from '../../utils/prisma'

/**
 * List users with the CLINICIAN role. Available to admins and clinicians so
 * that the client-detail modal (admin) and navigation UI can show clinician
 * info without leaking unrelated user data.
 */
export default defineEventHandler(async (event) => {
  requireStaff(event)

  const clinicians = await prisma.user.findMany({
    where: { role: 'CLINICIAN' },
    select: { id: true, name: true, email: true },
    orderBy: { name: 'asc' },
  })

  return clinicians
})
