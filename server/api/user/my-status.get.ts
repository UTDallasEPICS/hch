import { getHeaders } from 'h3'
import { auth } from '../../utils/auth'
import { prisma } from '../../utils/prisma'
import { isClinicalClient } from '../../utils/is-clinical-client'

export default defineEventHandler(async (event) => {
  const requestHeaders = new Headers()
  for (const [key, value] of Object.entries(getHeaders(event))) {
    if (value !== undefined) requestHeaders.set(key, value)
  }

  const session = await auth.api.getSession({ headers: requestHeaders })
  if (!session?.user?.id) {
    return { status: null, hasClient: false, userId: null }
  }

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { role: true, email: true },
  })

  if (!user || !isClinicalClient(user.role, user.email)) {
    return { status: null, hasClient: false, userId: session.user.id }
  }

  const client = await prisma.client.findUnique({
    where: { userId: session.user.id },
    select: { status: true },
  })

  return {
    status: client?.status ?? 'INCOMPLETE',
    hasClient: !!client,
    userId: session.user.id,
  }
})
