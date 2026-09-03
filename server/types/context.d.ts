import { auth } from '../utils/auth'

/**
 * Types the values that `server/middleware/1.auth.ts` attaches to the request
 * context, so `event.context.user` / `requireUser(event)` are the Better Auth
 * session user instead of `any` (#96). Fields are optional because the context
 * is unpopulated on the public routes the auth middleware skips.
 */
type SessionUser = typeof auth.$Infer.Session.user
type SessionData = typeof auth.$Infer.Session.session

declare module 'h3' {
  interface H3EventContext {
    user?: SessionUser
    session?: SessionData
    isAdmin?: boolean
    isClinician?: boolean
    isStaff?: boolean
  }
}
