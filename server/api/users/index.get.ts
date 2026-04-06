import { prisma } from '../../utils/prisma'
import { requireAdmin } from '../../utils/guard'
import { defineEventHandler, getQuery } from 'h3'

export default defineEventHandler(async (event) => {
  requireAdmin(event)

  const query = getQuery(event)
  const page = parseInt(query.page as string) || 1
  const limit = parseInt(query.limit as string) || 50

  const skip = (page - 1) * limit

  return prisma.user.findMany({
    skip,
    take: limit,
  })
})
