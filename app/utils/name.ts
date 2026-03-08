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
