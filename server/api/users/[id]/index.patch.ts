import { requireAdmin } from '../../../utils/guard'
import { prisma } from '../../../utils/prisma'
import { createError, defineEventHandler, getRouterParam, readBody } from 'h3'

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

/**
 * Admin-only: edit a user's profile (name / email). Role changes go through
 * PATCH /api/users/[id]/role. Email is the sign-in identity, so it must stay
 * unique and well-formed.
 */
export default defineEventHandler(async (event) => {
  requireAdmin(event)

  const id = getRouterParam(event, 'id')
  if (!id) {
    throw createError({ statusCode: 400, statusMessage: 'Missing user id' })
  }

  const body = await readBody<{ name?: string; email?: string }>(event)
  const data: { name?: string; email?: string } = {}

  if (body?.name !== undefined) {
    const name = body.name.trim()
    if (!name) {
      throw createError({ statusCode: 400, statusMessage: 'Name cannot be empty' })
    }
    data.name = name
  }

  if (body?.email !== undefined) {
    const email = body.email.trim().toLowerCase()
    if (!EMAIL_RE.test(email)) {
      throw createError({ statusCode: 400, statusMessage: 'A valid email is required' })
    }
    const clash = await prisma.user.findFirst({ where: { email, NOT: { id } } })
    if (clash) {
      throw createError({ statusCode: 409, statusMessage: 'A user with that email already exists' })
    }
    data.email = email
  }

  if (data.name === undefined && data.email === undefined) {
    throw createError({ statusCode: 400, statusMessage: 'Nothing to update' })
  }

  const target = await prisma.user.findUnique({ where: { id }, select: { id: true } })
  if (!target) {
    throw createError({ statusCode: 404, statusMessage: 'User not found' })
  }

  return prisma.user.update({
    where: { id },
    data,
    select: { id: true, name: true, email: true, role: true, createdAt: true },
  })
})
