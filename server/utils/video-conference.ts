/** Shared labels for UI; provider enum lives in Prisma. */
export const VIDEO_PROVIDER_LABEL: Record<string, string> = {
  GOOGLE_MEET: 'Google Meet',
  ZOOM: 'Zoom',
  OTHER: 'Other link',
}

export function parseVideoProviderInput(value: unknown): string | null {
  if (value === null || value === undefined || value === '') return null
  if (typeof value !== 'string') return null
  const u = value.trim().toUpperCase().replace(/-/g, '_')
  const allowed = new Set(['GOOGLE_MEET', 'ZOOM', 'OTHER'])
  if (allowed.has(u)) return u
  return null
}

/** Returns null if empty/invalid; only http(s) URLs allowed. */
export function normalizeVideoJoinUrl(raw: unknown): string | null {
  if (raw === null || raw === undefined) return null
  if (typeof raw !== 'string') return null
  const t = raw.trim()
  if (!t) return null
  try {
    const u = new URL(t)
    if (u.protocol !== 'http:' && u.protocol !== 'https:') return null
    return u.toString()
  } catch {
    return null
  }
}
