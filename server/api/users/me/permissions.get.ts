import { requireUser } from '../../../utils/guard'
import { getHeaders } from 'h3'
import { prisma } from '../../../utils/prisma'
import { isAdmin } from '../../../utils/is-admin'
import { getClientPermissions } from '../../../utils/client-permissions'

export default defineEventHandler(async (event) => {

  const user = requireUser(event)
  const dbUser = await prisma.user.findUnique({
    where: { id: user.id },
    select: { role: true, email: true },
  })
  const clientPerms = await getClientPermissions(user.id)

  return {
    canViewScores:
      isAdmin(dbUser?.role ?? null, dbUser?.email ?? null) || clientPerms.canViewScores,
    canViewNotes:
      isAdmin(dbUser?.role ?? null, dbUser?.email ?? null) || clientPerms.canViewNotes,
    canViewPlan:
      isAdmin(dbUser?.role ?? null, dbUser?.email ?? null) || clientPerms.canViewPlan,
  }
})
