import { z } from 'zod'
import { requireUser } from '../../../utils/guard'
import { prisma } from '../../../utils/prisma'

const statusSchema = z.object({
  connected: z.boolean(),
  status: z.enum(['ACTIVE', 'NEEDS_RECONNECT', 'DISCONNECTED']).nullable(),
  provider: z.enum(['GOOGLE']).nullable(),
  calendarId: z.string().nullable(),
  lastSyncedAt: z.string().datetime().nullable(),
})

export default defineEventHandler(async (event) => {
  const user = requireUser(event)
  const connection = await prisma.calendarConnection.findUnique({
    where: {
      userId_provider: {
        userId: user.id,
        provider: 'GOOGLE',
      },
    },
    select: {
      status: true,
      provider: true,
      calendarId: true,
      lastSyncedAt: true,
    },
  })

  if (!connection) {
    return statusSchema.parse({
      connected: false,
      status: null,
      provider: null,
      calendarId: null,
      lastSyncedAt: null,
    })
  }

  return statusSchema.parse({
    connected: connection.status === 'ACTIVE',
    status: connection.status,
    provider: connection.provider,
    calendarId: connection.calendarId,
    lastSyncedAt: connection.lastSyncedAt?.toISOString() ?? null,
  })
})
