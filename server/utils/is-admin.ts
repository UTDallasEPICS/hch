/**
 * Check if a user is an admin (either by role or admin email list).
 */
export function isAdmin(role: string | null | undefined, email: string | null | undefined): boolean {
  if (role === 'ADMIN') return true
  const adminEmails = process.env.INITIAL_ADMIN_EMAIL
  if (!adminEmails || !email) return false
  const list = adminEmails.split(',').map((e) => e.trim().toLowerCase()).filter(Boolean)
  return list.includes(email.toLowerCase())
}
