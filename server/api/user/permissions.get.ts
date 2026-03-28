import { getHeaders } from 'h3'
import { auth } from '../../utils/auth'
import { prisma } from '../../utils/prisma'
import { isAdmin } from '../../utils/is-admin'
import { getClientPermissions } from '../../utils/client-permissions'
import { areAllFormsComplete } from '../../utils/client-forms'

export default defineEventHandler(async (event) => {
  const requestHeaders = new Headers()
  for (const [key, value] of Object.entries(getHeaders(event))) {
    if (value !== undefined) requestHeaders.set(key, value)
  }

  const session = await auth.api.getSession({ headers: requestHeaders })
  if (!session?.user?.id) {
    return {
      canViewScores: false,
      canViewNotes: false,
      canViewPlan: false,
      allFormsComplete: false,
    }
  }

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { role: true, email: true },
  })
  const clientPerms = await getClientPermissions(session.user.id)
  const allFormsComplete = await areAllFormsComplete(prisma, session.user.id)

  return {
    canViewScores:
      isAdmin(user?.role ?? null, user?.email ?? null) || clientPerms.canViewScores,
    canViewNotes:
      isAdmin(user?.role ?? null, user?.email ?? null) || clientPerms.canViewNotes,
    canViewPlan:
      isAdmin(user?.role ?? null, user?.email ?? null) || clientPerms.canViewPlan,
    allFormsComplete,
  }
})
