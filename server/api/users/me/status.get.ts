import { requireUser } from '../../../utils/guard'
import { prisma } from '../../../utils/prisma'

export default defineEventHandler(async (event) => {
  const user = requireUser(event)

  const client = await prisma.client.findUnique({
    where: { userId: user.id },
    select: { status: true },
  })

  return {
    status: client?.status ?? 'INCOMPLETE',
    hasClient: !!client,
    userId: user.id,
  }
})
