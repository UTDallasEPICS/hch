import { z } from 'zod'
import { requireUser } from '../../../utils/guard'
import { prisma } from '../../../utils/prisma'
import { encryptToken } from '../../../utils/calendar-token-encryption'

const callbackQuerySchema = z.object({
  code: z.string().min(1).optional(),
  state: z.string().min(1).optional(),
  error: z.string().optional(),
  error_description: z.string().optional(),
})

const cookieSchema = z.object({
  state: z.string().min(1),
  verifier: z.string().min(1),
  userId: z.string().min(1),
})

const tokenResponseSchema = z.object({
  access_token: z.string().min(1),
  refresh_token: z.string().min(1).optional(),
  expires_in: z.number().positive(),
  scope: z.string().optional(),
})

export default defineEventHandler(async (event) => {
  const user = requireUser(event)
  const query = callbackQuerySchema.parse(getQuery(event))
  const settingsUrl = new URL('/settings', process.env.BETTER_AUTH_URL || 'http://localhost:3000')

  const rawCookie = getCookie(event, 'google_calendar_oauth')
  deleteCookie(event, 'google_calendar_oauth', { path: '/' })

  let cookieValue: z.infer<typeof cookieSchema>
  try {
    if (!rawCookie) {
      throw new Error('Missing OAuth state')
    }
    cookieValue = cookieSchema.parse(JSON.parse(rawCookie))
  } catch {
    settingsUrl.searchParams.set('calendar', 'error')
    return sendRedirect(event, settingsUrl.toString(), 302)
  }

  if (!query.state || query.state !== cookieValue.state || cookieValue.userId !== user.id) {
    settingsUrl.searchParams.set('calendar', 'error')
    return sendRedirect(event, settingsUrl.toString(), 302)
  }

  if (query.error || !query.code) {
    settingsUrl.searchParams.set('calendar', 'error')
    return sendRedirect(event, settingsUrl.toString(), 302)
  }

  const redirectUri = process.env.GOOGLE_CALENDAR_REDIRECT_URI
  const clientId = process.env.GOOGLE_CLIENT_ID
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET
  if (!redirectUri || !clientId || !clientSecret) {
    throw createError({
      statusCode: 500,
      statusMessage: 'Google Calendar OAuth environment variables are not configured',
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
        grant_type: 'authorization_code',
        code: query.code,
        client_id: clientId,
        client_secret: clientSecret,
        redirect_uri: redirectUri,
        code_verifier: cookieValue.verifier,
      }),
    })
  } catch {
    settingsUrl.searchParams.set('calendar', 'error')
    return sendRedirect(event, settingsUrl.toString(), 302)
  }

  let tokenResponse: z.infer<typeof tokenResponseSchema>
  try {
    tokenResponse = tokenResponseSchema.parse(await response.json())
  } catch {
    settingsUrl.searchParams.set('calendar', 'error')
    return sendRedirect(event, settingsUrl.toString(), 302)
  }

  if (!response.ok) {
    settingsUrl.searchParams.set('calendar', 'error')
    return sendRedirect(event, settingsUrl.toString(), 302)
  }

  const grantedScopes = (tokenResponse.scope || '').split(/\s+/).filter(Boolean)
  if (!grantedScopes.includes('https://www.googleapis.com/auth/calendar.events')) {
    settingsUrl.searchParams.set('calendar', 'error')
    return sendRedirect(event, settingsUrl.toString(), 302)
  }
  if (!tokenResponse.refresh_token) {
    settingsUrl.searchParams.set('calendar', 'error')
    return sendRedirect(event, settingsUrl.toString(), 302)
  }

  await prisma.calendarConnection.upsert({
    where: {
      userId_provider: {
        userId: user.id,
        provider: 'GOOGLE',
      },
    },
    create: {
      userId: user.id,
      provider: 'GOOGLE',
      calendarId: 'primary',
      accessToken: encryptToken(tokenResponse.access_token),
      refreshToken: encryptToken(tokenResponse.refresh_token),
      tokenExpiresAt: new Date(Date.now() + tokenResponse.expires_in * 1000),
      scopes: grantedScopes.join(' '),
      status: 'ACTIVE',
    },
    update: {
      calendarId: 'primary',
      accessToken: encryptToken(tokenResponse.access_token),
      refreshToken: encryptToken(tokenResponse.refresh_token),
      tokenExpiresAt: new Date(Date.now() + tokenResponse.expires_in * 1000),
      scopes: grantedScopes.join(' '),
      status: 'ACTIVE',
      lastSyncedAt: null,
    },
  })

  settingsUrl.searchParams.set('calendar', 'connected')
  return sendRedirect(event, settingsUrl.toString(), 302)
})
