import { z } from 'zod'
import { requireUser } from '../../../utils/guard'
import { prisma } from '../../../utils/prisma'
import { decryptToken } from '../../../utils/calendar-token-encryption'

const disconnectSchema = z.object({})

export default defineEventHandler(async (event) => {
  disconnectSchema.parse({})
  const user = requireUser(event)
  const connection = await prisma.calendarConnection.findUnique({
    where: {
      userId_provider: {
        userId: user.id,
        provider: 'GOOGLE',
      },
    },
    select: {
      refreshToken: true,
    },
  })

  if (connection) {
    try {
      const refreshToken = decryptToken(connection.refreshToken)
      await fetch('https://oauth2.googleapis.com/revoke', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({ token: refreshToken }),
      })
    } catch {
      // Revocation is best effort; disconnect still removes the local connection.
    }

    await prisma.calendarConnection.delete({
      where: {
        userId_provider: {
          userId: user.id,
          provider: 'GOOGLE',
        },
      },
    })
  }

  return { disconnected: true }
})
