import { defineEventHandler, getHeaders, createError } from 'h3'
import { prisma } from '../../utils/prisma'
import { auth } from '../../utils/auth'

export default defineEventHandler(async (event) => {
  const headers = new Headers()

  for (const [k, v] of Object.entries(getHeaders(event))) {
    if (v) headers.set(k, v)
  }

  const session = await auth.api.getSession({ headers })
  const user = session?.user

  if (!user || user.role !== 'ADMIN') {
    throw createError({ statusCode: 403 })
  }

  const clients = await prisma.user.findMany({
    where: { role: 'CLIENT' },
    select: {
      id: true,
      name: true,
      email: true,
    },
    orderBy: { name: 'asc' },
  })

  return clients
})
