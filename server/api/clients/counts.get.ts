import { requireAdmin } from '../../utils/guard'
import { defineEventHandler } from 'h3'
import { prisma } from '../../utils/prisma'
import { isClinicalClient } from '../../utils/is-clinical-client'
import { toClientStatusLabel } from '../../utils/client-status'
import type { ClientStatus } from '../../../prisma/generated/client'

type ClientTabCounts = {
  __all__: number
  Prospective: number
  Waitlist: number
  Active: number
  Archived: number
}

export default defineEventHandler(async (event) => {
  requireAdmin(event)

  const users = await prisma.user.findMany({
    where: { role: 'CLIENT' },
    select: {
      email: true,
      client: { select: { status: true } },
    },
  })

  const counts: ClientTabCounts = {
    __all__: 0,
    Prospective: 0,
    Waitlist: 0,
    Active: 0,
    Archived: 0,
  }

  for (const u of users) {
    if (!isClinicalClient('CLIENT', u.email)) continue
    const storedStatus = (u.client?.status ?? 'INCOMPLETE') as ClientStatus
    const label = toClientStatusLabel(storedStatus)
    counts[label]++
    counts.__all__++
  }

  return counts
})
