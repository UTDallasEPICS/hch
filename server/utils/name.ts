/**
 * Name delimiter for storing fname|lname as single string on backend.
 * Frontend displays fname/lname separately; backend stores concatenated.
 */
export const NAME_DELIMITER = '||'

export function parseName(fullName: string): { fname: string; lname: string } {
  const parts = fullName.split(NAME_DELIMITER)
  if (parts.length >= 2) {
    return {
      fname: parts[0]?.trim() ?? '',
      lname: parts.slice(1).join(NAME_DELIMITER).trim(),
    }
  }
  return {
    fname: fullName.trim(),
    lname: '',
  }
}

export function joinName(fname: string, lname: string): string {
  const f = (fname ?? '').trim()
  const l = (lname ?? '').trim()
  if (!l) return f
  return `${f}${NAME_DELIMITER}${l}`
}
