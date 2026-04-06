import { requireUser } from '../../../utils/guard'
import { getHeaders } from 'h3'
import { prisma } from '../../../utils/prisma'
import { isAdmin, isGuaranteedAdminEmail } from '../../../utils/is-admin'

export default defineEventHandler(async (event) => {

  const user = requireUser(event)
  const dbUser = await prisma.user.findUnique({
    where: { id: user.id },
    select: { role: true, email: true },
  })

  // Keep DB role aligned for guaranteed admin emails.
  if (dbUser?.role !== 'ADMIN' && isGuaranteedAdminEmail(dbUser?.email ?? null)) {
    await prisma.user.update({
      where: { id: user.id },
      data: { role: 'ADMIN' },
    })
    return { isAdmin: true }
  }

  return {
    isAdmin: isAdmin(dbUser?.role ?? null, dbUser?.email ?? null),
  }
})
