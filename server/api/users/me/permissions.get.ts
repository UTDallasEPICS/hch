import { requireUser } from '../../../utils/guard'
import { prisma } from '../../../utils/prisma'
import { isAdmin } from '../../../utils/is-admin'
import { getClientPermissions } from '../../../utils/client-permissions'
import { areAllFormsComplete } from '../../../utils/client-forms'

export default defineEventHandler(async (event) => {
  const user = requireUser(event)
  const dbUser = await prisma.user.findUnique({
    where: { id: user.id },
    select: { role: true, email: true },
  })
  const clientPerms = await getClientPermissions(user.id)
  const allFormsComplete = await areAllFormsComplete(prisma, user.id)

  return {
    canViewScores:
      isAdmin(dbUser?.role ?? null, dbUser?.email ?? null) || clientPerms.canViewScores,
    canViewNotes: isAdmin(dbUser?.role ?? null, dbUser?.email ?? null) || clientPerms.canViewNotes,
    canViewPlan: isAdmin(dbUser?.role ?? null, dbUser?.email ?? null) || clientPerms.canViewPlan,
    allFormsComplete,
  }
})
