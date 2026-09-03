/**
 * Single source of truth for session attendance statuses (#32): the values
 * persisted on SessionNote.attendanceStatus, their dropdown labels, and the
 * calendar color-coding. Kept in one place so the AttendanceDropdown and the
 * calendar never drift apart.
 */

export type AttendanceStatusValue =
  | 'show'
  | 'no-show'
  | 'canceled'
  | 'late-canceled'
  | 'late-emergency'
  | 'late-excused'
  | 'clinician-canceled'

export interface AttendanceStatusMeta {
  value: AttendanceStatusValue
  label: string
  /** Hex color for the calendar event border + background tint. */
  color: string
  /** Strike through the session title — only the standard "Canceled" status. */
  strikethrough?: boolean
}

/** Blue — a future/scheduled session with no attendance recorded yet. */
export const ATTENDANCE_FUTURE_COLOR = '#3b82f6'

export const ATTENDANCE_STATUSES: AttendanceStatusMeta[] = [
  { value: 'show', label: 'Show', color: '#10b981' }, // green — attended
  { value: 'no-show', label: 'No show', color: '#ef4444' }, // red
  { value: 'canceled', label: 'Canceled', color: '#f59e0b', strikethrough: true }, // yellow
  { value: 'late-canceled', label: 'Late canceled', color: '#ef4444' }, // red — <24h notice
  { value: 'late-emergency', label: 'Late Emergency Cancel', color: '#8b5cf6' }, // purple
  { value: 'late-excused', label: 'Late Excused Cancel', color: '#8b5cf6' }, // purple
  { value: 'clinician-canceled', label: 'Clinician canceled', color: '#6b7280' }, // gray
]

const STATUS_BY_VALUE = new Map<string, AttendanceStatusMeta>(
  ATTENDANCE_STATUSES.map((status) => [status.value, status])
)

export function getAttendanceStatusMeta(
  value: string | null | undefined
): AttendanceStatusMeta | null {
  if (!value) return null
  return STATUS_BY_VALUE.get(value) ?? null
}

/** Calendar event color; falls back to the future/scheduled blue when unset. */
export function getAttendanceColor(value: string | null | undefined): string {
  return getAttendanceStatusMeta(value)?.color ?? ATTENDANCE_FUTURE_COLOR
}

export function isAttendanceStrikethrough(value: string | null | undefined): boolean {
  return getAttendanceStatusMeta(value)?.strikethrough ?? false
}
