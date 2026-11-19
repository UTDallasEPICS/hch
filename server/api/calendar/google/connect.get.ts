import { createHash, randomBytes } from 'node:crypto'
import { z } from 'zod'
import { requireUser } from '../../../utils/guard'

const envSchema = z.object({
  GOOGLE_CLIENT_ID: z.string().min(1),
  GOOGLE_CLIENT_SECRET: z.string().min(1),
  GOOGLE_CALENDAR_REDIRECT_URI: z.string().url(),
})

export default defineEventHandler((event) => {
  const user = requireUser(event)
  const env = envSchema.safeParse({
    GOOGLE_CLIENT_ID: process.env.GOOGLE_CLIENT_ID,
    GOOGLE_CLIENT_SECRET: process.env.GOOGLE_CLIENT_SECRET,
    GOOGLE_CALENDAR_REDIRECT_URI: process.env.GOOGLE_CALENDAR_REDIRECT_URI,
  })
  if (!env.success) {
    throw createError({
      statusCode: 500,
      statusMessage: 'Google Calendar OAuth environment variables are not configured',
    })
  }

  const state = randomBytes(32).toString('base64url')
  const verifier = randomBytes(32).toString('base64url')
  const challenge = createHash('sha256').update(verifier).digest('base64url')

  setCookie(event, 'google_calendar_oauth', JSON.stringify({
    state,
    verifier,
    userId: user.id,
  }), {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    maxAge: 10 * 60,
    path: '/',
  })

  const authorizationUrl = new URL('https://accounts.google.com/o/oauth2/v2/auth')
  authorizationUrl.searchParams.set('client_id', env.data.GOOGLE_CLIENT_ID)
  authorizationUrl.searchParams.set('redirect_uri', env.data.GOOGLE_CALENDAR_REDIRECT_URI)
  authorizationUrl.searchParams.set('response_type', 'code')
  authorizationUrl.searchParams.set('scope', 'https://www.googleapis.com/auth/calendar.events')
  authorizationUrl.searchParams.set('access_type', 'offline')
  authorizationUrl.searchParams.set('prompt', 'consent')
  authorizationUrl.searchParams.set('include_granted_scopes', 'true')
  authorizationUrl.searchParams.set('state', state)
  authorizationUrl.searchParams.set('code_challenge', challenge)
  authorizationUrl.searchParams.set('code_challenge_method', 'S256')

  return sendRedirect(event, authorizationUrl.toString(), 302)
})
