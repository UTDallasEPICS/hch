/**
 * Check if a user is an admin (either by role or admin email list).
 */
const guaranteedAdminEmails = new Set<string>()

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase()
}

export function isGuaranteedAdminEmail(email: string | null | undefined): boolean {
  if (!email) return false
  return guaranteedAdminEmails.has(normalizeEmail(email))
}

export function isAdmin(
  role: string | null | undefined,
  email: string | null | undefined
): boolean {
  if (role === 'ADMIN') return true
  if (isGuaranteedAdminEmail(email)) return true
  const adminEmails = process.env.INITIAL_ADMIN_EMAIL
  if (!adminEmails || !email) return false
  const list = adminEmails.split(',').map(normalizeEmail).filter(Boolean)
  return list.includes(normalizeEmail(email))
}

/**
 * Clinicians are staff members who can access the same pages as admin,
 * but their data visibility is filtered to clients they're assigned to.
 */
export function isClinician(role: string | null | undefined): boolean {
  return role === 'CLINICIAN'
}

/**
 * Staff = admin OR clinician. Used to gate the admin-style pages (clients list,
 * notes, calendar, session notes requests) that both roles should be able to use.
 */
export function isStaff(
  role: string | null | undefined,
  email: string | null | undefined
): boolean {
  return isAdmin(role, email) || isClinician(role)
}
