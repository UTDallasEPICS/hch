import { isAdmin } from './is-admin'

/**
 * True for users who should appear on the clients list and use client-only flows.
 * Excludes ADMIN role and users matched by isAdmin (e.g. env-listed staff emails)
 * even if their DB role is still CLIENT.
 */
export function isClinicalClient(
  role: string | null | undefined,
  email: string | null | undefined
): boolean {
  if (role !== 'CLIENT') return false
  return !isAdmin(role, email)
}
