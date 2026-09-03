/**
 * Admin status is derived purely from the stored DB role. The first person to
 * sign in on an empty DB is bootstrapped to ADMIN (see auth.ts); after that,
 * admins grant roles to others via the staff-management screen.
 */
export function isAdmin(role: string | null | undefined): boolean {
  return role === 'ADMIN'
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
export function isStaff(role: string | null | undefined): boolean {
  return isAdmin(role) || isClinician(role)
}
