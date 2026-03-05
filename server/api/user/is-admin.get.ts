import { getHeaders } from 'h3'
import { auth } from '../../utils/auth'
import { prisma } from '../../utils/prisma'
import { isAdmin, isGuaranteedAdminEmail } from '../../utils/is-admin'

export default defineEventHandler(async (event) => {
  const requestHeaders = new Headers()
  for (const [key, value] of Object.entries(getHeaders(event))) {
    if (value !== undefined) requestHeaders.set(key, value)
  }

  const session = await auth.api.getSession({ headers: requestHeaders })
  if (!session?.user?.id) {
    return { isAdmin: false }
  }

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { role: true, email: true },
  })

  // Keep DB role aligned for guaranteed admin emails.
  if (user?.role !== 'ADMIN' && isGuaranteedAdminEmail(user?.email ?? null)) {
    await prisma.user.update({
      where: { id: session.user.id },
      data: { role: 'ADMIN' },
    })
    return { isAdmin: true }
  }

  return {
    isAdmin: isAdmin(user?.role ?? null, user?.email ?? null),
  }
})
