import { describe, expect, it, vi } from 'vitest'

// mail.ts imports prisma for the notification-email helper; this test only
// exercises the pure formatter.
vi.mock('./prisma', () => ({ prisma: {} }))

import { formatAppointmentTimeRange } from './mail'

describe('formatAppointmentTimeRange', () => {
  it('renders the range in clinic time, not the server timezone', () => {
    // 19:00Z is 2:00 PM in Chicago (CDT).
    expect(
      formatAppointmentTimeRange(
        new Date('2026-10-20T19:00:00.000Z'),
        new Date('2026-10-20T20:00:00.000Z')
      )
    ).toBe('Tue, Oct 20, 2026 · 2:00 PM – 3:00 PM')
  })
})
