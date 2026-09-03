import { requireAdmin } from '../../utils/guard'
import { prisma } from '../../utils/prisma'
import { createError, defineEventHandler, readBody } from 'h3'
import { randomUUID } from 'node:crypto'
import type { Role } from '../../../prisma/generated/enums'

const ROLES = ['ADMIN', 'CLINICIAN', 'CLIENT'] as const
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

/**
 * Admin-only: add a user with a chosen role. The person can then sign in with
 * this email (passwordless OTP) and will keep the role assigned here. Recorded
 * in RoleChangeAudit as a creation (oldRole = 'NONE').
 */
export default defineEventHandler(async (event) => {
  const actor = requireAdmin(event)

  const body = await readBody<{ name?: string; email?: string; role?: string }>(event)
  const name = body?.name?.trim()
  const email = body?.email?.trim().toLowerCase()
  const role = body?.role

  if (!name) {
    throw createError({ statusCode: 400, statusMessage: 'Name is required' })
  }
  if (!email || !EMAIL_RE.test(email)) {
    throw createError({ statusCode: 400, statusMessage: 'A valid email is required' })
  }
  if (!role || !ROLES.includes(role as (typeof ROLES)[number])) {
    throw createError({ statusCode: 400, statusMessage: 'Invalid role' })
  }

  const existing = await prisma.user.findUnique({ where: { email } })
  if (existing) {
    throw createError({ statusCode: 409, statusMessage: 'A user with that email already exists' })
  }

  const user = await prisma.$transaction(async (tx) => {
    const created = await tx.user.create({
      data: {
        id: randomUUID(),
        name,
        email,
        role: role as Role,
        emailVerified: false,
      },
      select: { id: true, name: true, email: true, role: true, createdAt: true },
    })
    await tx.roleChangeAudit.create({
      data: {
        targetUserId: created.id,
        targetEmail: created.email,
        oldRole: 'NONE',
        newRole: role,
        changedById: actor.id,
        changedByEmail: actor.email,
      },
    })
    return created
  })

  return user
})
