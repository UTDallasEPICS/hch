import { isStaff } from './is-admin'

/**
 * True for users who should appear on the clients list and use client-only flows.
 * Excludes ADMIN / CLINICIAN roles (matched by isStaff) based purely on DB role.
 */
export function isClinicalClient(role: string | null | undefined): boolean {
  if (role !== 'CLIENT') return false
  return !isStaff(role)
}
