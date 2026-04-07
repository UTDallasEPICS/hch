/**
 * Detects P2021 / "table … does not exist" for Appointment when using Prisma + SQLite adapter
 * (error shape may differ from classic PrismaClientKnownRequestError).
 */
export function isAppointmentTableMissingError(e: unknown): boolean {
  const seen = new Set<unknown>()

  function walk(x: unknown): boolean {
    if (!x || typeof x !== 'object') return false
    if (seen.has(x)) return false
    seen.add(x)
    const o = x as Record<string, unknown>

    if (o.code === 'P2021') return true

    const msg = String(o.message ?? '')
    if (msg.includes('does not exist') && /Appointment/i.test(msg)) return true

    if (o.cause !== undefined && walk(o.cause)) return true
    if (o.meta !== undefined && typeof o.meta === 'object' && walk(o.meta)) return true

    return false
  }

  return walk(e)
}
