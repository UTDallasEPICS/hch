// Helpers shared by the medication and trauma history sections (#224).
//
// These are calendar dates, not moments in time. A date input gives
// "YYYY-MM-DD", which the server stores as midnight UTC. Reading it back in
// local time would show the previous day for anyone west of UTC (the clinic is
// in America/Chicago), so both helpers below stay in UTC.

/** "2026-01-01T00:00:00.000Z" -> "Jan 1, 2026" */
export function formatHistoryDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-US', { dateStyle: 'medium', timeZone: 'UTC' })
}

/** API date -> value for <input type="date"> ("YYYY-MM-DD"), or '' when unset. */
export function toDateInputValue(iso: string | null): string {
  return iso ? iso.slice(0, 10) : ''
}

/** Today's date in the user's own timezone, as "YYYY-MM-DD". */
export function todayDateInputValue(): string {
  const d = new Date()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${d.getFullYear()}-${m}-${day}`
}

/** Same as the helper in my-messages.vue: show the server's statusMessage when there is one. */
export function apiErrorMessage(err: unknown): string {
  if (err && typeof err === 'object' && 'data' in err) {
    const data = (err as { data?: { statusMessage?: string; message?: string } }).data
    if (data?.statusMessage) return data.statusMessage
    if (data?.message) return data.message
  }
  return 'Something went wrong. Try again.'
}
