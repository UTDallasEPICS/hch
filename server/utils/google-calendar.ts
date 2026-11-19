import { z } from 'zod'
import { prisma } from './prisma'
import { decryptToken, encryptToken } from './calendar-token-encryption'

export type CalendarAuthErrorCode = 'NOT_CONNECTED' | 'NEEDS_RECONNECT'

export class CalendarAuthError extends Error {
  readonly code: CalendarAuthErrorCode

  constructor(code: CalendarAuthErrorCode, message: string) {
    super(message)
    this.name = 'CalendarAuthError'
    this.code = code
  }
}

export class CalendarProviderError extends Error {
  constructor(message: string, options?: ErrorOptions) {
    super(message, options)
    this.name = 'CalendarProviderError'
  }
}

const refreshResponseSchema = z.object({
  access_token: z.string().min(1).optional(),
  expires_in: z.number().positive().optional(),
  refresh_token: z.string().min(1).optional(),
  error: z.string().optional(),
})

const refreshPromises = new Map<string, Promise<string>>()

/**
 * Returns a working Google Calendar access token for sub-issues that perform
 * Google Calendar API calls. Throws CalendarAuthError for connection/reconnect
 * states or CalendarProviderError for provider/network failures.
 */
export async function getValidAccessToken(userId: string): Promise<string> {
  if (!userId) {
    throw new CalendarAuthError('NOT_CONNECTED', 'Google Calendar is not connected')
  }

  const connection = await prisma.calendarConnection.findUnique({
    where: {
      userId_provider: {
        userId,
        provider: 'GOOGLE',
      },
    },
    select: {
      status: true,
      accessToken: true,
      refreshToken: true,
      tokenExpiresAt: true,
    },
  })

  if (!connection || connection.status === 'DISCONNECTED') {
    throw new CalendarAuthError('NOT_CONNECTED', 'Google Calendar is not connected')
  }
  if (connection.status === 'NEEDS_RECONNECT') {
    throw new CalendarAuthError('NEEDS_RECONNECT', 'Google Calendar needs to be reconnected')
  }

  if (connection.tokenExpiresAt.getTime() - Date.now() > 60_000) {
    try {
      return decryptToken(connection.accessToken)
    } catch (error) {
      throw new CalendarProviderError('Stored Google Calendar access token is invalid', {
        cause: error,
      })
    }
  }

  const existingRefresh = refreshPromises.get(userId)
  if (existingRefresh) {
    return existingRefresh
  }

  const refreshPromise = refreshAccessToken(userId, connection.refreshToken)
  refreshPromises.set(userId, refreshPromise)
  try {
    return await refreshPromise
  } finally {
    refreshPromises.delete(userId)
  }
}

async function refreshAccessToken(userId: string, encryptedRefreshToken: string): Promise<string> {
  let refreshToken: string
  try {
    refreshToken = decryptToken(encryptedRefreshToken)
  } catch (error) {
    throw new CalendarProviderError('Stored Google Calendar refresh token is invalid', {
      cause: error,
    })
  }

  let response: Response
  try {
    response = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        grant_type: 'refresh_token',
        client_id: process.env.GOOGLE_CLIENT_ID || '',
        client_secret: process.env.GOOGLE_CLIENT_SECRET || '',
        refresh_token: refreshToken,
      }),
    })
  } catch (error) {
    throw new CalendarProviderError('Could not reach Google while refreshing the calendar token', {
      cause: error,
    })
  }

  let payload: z.infer<typeof refreshResponseSchema>
  try {
    payload = refreshResponseSchema.parse(await response.json())
  } catch (error) {
    throw new CalendarProviderError('Google returned an invalid calendar token response', {
      cause: error,
    })
  }

  if (!response.ok) {
    if (payload.error === 'invalid_grant') {
      await prisma.calendarConnection.update({
        where: {
          userId_provider: {
            userId,
            provider: 'GOOGLE',
          },
        },
        data: {
          status: 'NEEDS_RECONNECT',
        },
      })
      throw new CalendarAuthError(
        'NEEDS_RECONNECT',
        'Google Calendar needs to be reconnected'
      )
    }
    throw new CalendarProviderError('Google rejected the calendar token refresh')
  }
  if (!payload.access_token || !payload.expires_in) {
    throw new CalendarProviderError('Google returned an incomplete calendar token response')
  }

  const tokenExpiresAt = new Date(Date.now() + payload.expires_in * 1000)
  await prisma.calendarConnection.update({
    where: {
      userId_provider: {
        userId,
        provider: 'GOOGLE',
      },
    },
    data: {
      accessToken: encryptToken(payload.access_token),
      refreshToken: payload.refresh_token
        ? encryptToken(payload.refresh_token)
        : undefined,
      tokenExpiresAt,
      status: 'ACTIVE',
    },
  })

  return payload.access_token
}
