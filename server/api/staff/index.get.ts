import { requireAdmin } from '../../utils/guard'
import { prisma } from '../../utils/prisma'
import { defineEventHandler } from 'h3'

/**
 * Admin-only: list every user with their role for the staff-management screen.
 */
export default defineEventHandler(async (event) => {
  requireAdmin(event)

  return prisma.user.findMany({
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      createdAt: true,
    },
    orderBy: [{ role: 'asc' }, { email: 'asc' }],
  })
})
