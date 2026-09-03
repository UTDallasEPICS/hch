import { requireAdmin } from '../../../utils/guard'
import { prisma } from '../../../utils/prisma'
import { createError, defineEventHandler, getRouterParam, readBody } from 'h3'
import type { Role } from '../../../../prisma/generated/enums'

const ROLES = ['ADMIN', 'CLINICIAN', 'CLIENT'] as const

/**
 * Admin-only: change a user's role (ADMIN / CLINICIAN / CLIENT).
 *
 * Guards:
 * - You cannot change your own role (prevents self-lockout).
 * - You cannot demote the last remaining admin (there must always be one).
 *
 * Every change is recorded in RoleChangeAudit.
 */
export default defineEventHandler(async (event) => {
  const actor = requireAdmin(event)

  const targetId = getRouterParam(event, 'id')
  if (!targetId) {
    throw createError({ statusCode: 400, statusMessage: 'Missing user id' })
  }

  const body = await readBody<{ role?: string }>(event)
  const newRole = body?.role
  if (!newRole || !ROLES.includes(newRole as (typeof ROLES)[number])) {
    throw createError({ statusCode: 400, statusMessage: 'Invalid role' })
  }

  if (targetId === actor.id) {
    throw createError({ statusCode: 400, statusMessage: 'You cannot change your own role' })
  }

  const target = await prisma.user.findUnique({
    where: { id: targetId },
    select: { id: true, email: true, role: true },
  })
  if (!target) {
    throw createError({ statusCode: 404, statusMessage: 'User not found' })
  }

  if (target.role === newRole) {
    return { id: target.id, role: target.role }
  }

  // Never leave the system without an admin.
  if (target.role === 'ADMIN' && newRole !== 'ADMIN') {
    const adminCount = await prisma.user.count({ where: { role: 'ADMIN' } })
    if (adminCount <= 1) {
      throw createError({
        statusCode: 409,
        statusMessage: 'Cannot demote the last remaining admin',
      })
    }
  }

  const oldRole = target.role

  await prisma.$transaction([
    prisma.user.update({
      where: { id: target.id },
      data: { role: newRole as Role },
    }),
    prisma.roleChangeAudit.create({
      data: {
        targetUserId: target.id,
        targetEmail: target.email,
        oldRole,
        newRole,
        changedById: actor.id,
        changedByEmail: actor.email,
      },
    }),
  ])

  return { id: target.id, role: newRole }
})
