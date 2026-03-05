import { getHeaders } from 'h3'
import { auth } from '../../utils/auth'
import { prisma } from '../../utils/prisma'

export default defineEventHandler(async (event) => {
  const requestHeaders = new Headers()
  for (const [key, value] of Object.entries(getHeaders(event))) {
    if (value !== undefined) requestHeaders.set(key, value)
  }

  const session = await auth.api.getSession({ headers: requestHeaders })
  if (!session?.user?.id) {
    return { status: null, hasClient: false }
  }

  const client = await prisma.client.findUnique({
    where: { userId: session.user.id },
    select: { status: true },
  })

  return {
    status: client?.status ?? 'INCOMPLETE',
    hasClient: !!client,
  }
})
