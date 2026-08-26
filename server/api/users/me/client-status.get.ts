import { requireUser } from '../../../utils/guard'
import { defineEventHandler } from 'h3'
import { prisma } from '../../../utils/prisma'
import { toClientStatusLabel } from '../../../utils/client-status'

export default defineEventHandler(async (event) => {
  const user = requireUser(event)

  const client = await prisma.client.findUnique({
    where: { userId: user.id },
    select: { status: true },
  })

  return {
    status: toClientStatusLabel(client?.status),
  }
})
