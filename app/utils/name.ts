/**
 * Capitalizes the first letter of each word in a name for frontend display.
 * e.g. "bob builder" -> "Bob Builder", "alice" -> "Alice"
 */
export function capitalizeName(name: string): string {
  if (!name || typeof name !== 'string') return ''
  return name
    .trim()
    .split(/\s+/)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(' ')
}
