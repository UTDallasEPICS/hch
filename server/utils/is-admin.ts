/**
 * Check if a user is an admin (either by role or admin email list).
 */
const guaranteedAdminEmails = new Set(['alice@example.com'])

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
