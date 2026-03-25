/**
 * Strips pipe characters and other stray delimiters, normalizes whitespace.
 */
export function sanitizeDisplayName(raw: string): string {
  if (!raw || typeof raw !== 'string') return ''
  return raw
    .replace(/\|+/g, ' ')
    .replace(/[\u00A0\t]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

/**
 * Capitalizes each word in a name (e.g. "bob builder" → "Bob Builder").
 */
export function capitalizeName(name: string): string {
  if (!name || typeof name !== 'string') return ''
  return name
    .trim()
    .split(/\s+/)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(' ')
}

/**
 * Sanitize + title case for person names in the UI.
 */
export function formatPersonDisplayName(raw: string): string {
  return capitalizeName(sanitizeDisplayName(raw))
}
