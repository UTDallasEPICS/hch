import { prisma } from './prisma'

const APP_SOURCE = 'hope-cope-heal'
const GOOGLE_CALENDAR_API = 'https://www.googleapis.com/calendar/v3'

/**
 * Resolves an ACTIVE Google Calendar connection and valid access token for a user.
 * Uses `getValidAccessToken` if provided by Database stuff #1, or falls back to
 * querying the database table safely so this module compiles independently.
 */
async function getActiveCalendarAuth(
  userId: string
): Promise<{ accessToken: string; calendarId: string } | null> {
  const db = prisma as any

  // Look up active connection on whichever model name Database stuff #1 defines
  const connectionModel =
    db.calendarConnection ?? db.googleCalendarConnection ?? db.userCalendarConnection

  if (connectionModel?.findFirst) {
    const conn = await connectionModel.findFirst({
      where: {
        userId,
        status: 'ACTIVE',
      },
    })
    if (!conn) return null

    // Use Database stuff #1 helper if available on global/module scope
    const helper = (globalThis as any).getValidAccessToken
    if (typeof helper === 'function') {
      const accessToken = await helper(userId)
      return { accessToken, calendarId: conn.calendarId || 'primary' }
    }

    if (conn.accessToken) {
      return { accessToken: conn.accessToken, calendarId: conn.calendarId || 'primary' }
    }
  }

  return null
}

function buildSanitizedEventPayload(appointment: {
  id: string
  startTime: Date
  endTime: Date
  videoJoinUrl: string | null
  availabilitySlot?: { location: string; videoUrl: string | null } | null
}) {
  const location = appointment.availabilitySlot?.location || undefined
  const videoUrl = appointment.videoJoinUrl || appointment.availabilitySlot?.videoUrl || undefined

  return {
    summary: 'Appointment',
    description: videoUrl ? `Video Link: ${videoUrl}` : undefined,
    location: location || videoUrl || undefined,
    start: {
      dateTime: appointment.startTime.toISOString(),
    },
    end: {
      dateTime: appointment.endTime.toISOString(),
    },
    reminders: {
      useDefault: false,
      overrides: [
        { method: 'popup', minutes: 1440 }, // 24 hours before
        { method: 'popup', minutes: 60 }, // 1 hour before
      ],
    },
    extendedProperties: {
      private: {
        appSource: APP_SOURCE,
        appointmentId: appointment.id,
      },
    },
  }
}

/**
 * CREATE or UPDATE handler.
 * Mirrors an appointment onto each connected participant's Google Calendar.
 * Never throws—records FAILED with lastError and moves on.
 */
export async function syncAppointmentUpsert(appointmentId: string): Promise<void> {
  try {
    const appointment = await prisma.appointment.findUnique({
      where: { id: appointmentId },
      include: {
        availabilitySlot: {
          select: { location: true, videoUrl: true },
        },
      },
    })

    if (!appointment) return

    if (
      appointment.status === 'CANCELLED' ||
      appointment.status === 'CANCELED' ||
      appointment.status === 'DENIED'
    ) {
      await syncAppointmentDelete(appointmentId)
      return
    }

    const participantIds = Array.from(new Set([appointment.clientId, appointment.adminId]))
    const payload = buildSanitizedEventPayload(appointment)

    for (const userId of participantIds) {
      const auth = await getActiveCalendarAuth(userId)
      if (!auth) continue // Skip participants with no ACTIVE connection

      const syncRecord = await prisma.appointmentCalendarEvent.upsert({
        where: {
          appointmentId_userId: { appointmentId, userId },
        },
        create: {
          appointmentId,
          userId,
          calendarId: auth.calendarId,
          status: 'PENDING',
          attempts: 1,
        },
        update: {
          status: 'PENDING',
          attempts: { increment: 1 },
        },
      })

      try {
        const isUpdate = Boolean(syncRecord.externalEventId)
        const url = isUpdate
          ? `${GOOGLE_CALENDAR_API}/calendars/${encodeURIComponent(syncRecord.calendarId)}/events/${encodeURIComponent(syncRecord.externalEventId!)}`
          : `${GOOGLE_CALENDAR_API}/calendars/${encodeURIComponent(auth.calendarId)}/events`

        const res = await fetch(url, {
          method: isUpdate ? 'PATCH' : 'POST',
          headers: {
            Authorization: `Bearer ${auth.accessToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(payload),
        })

        if (!res.ok) {
          const errText = await res.text()
          throw new Error(`Google Calendar API ${res.status}: ${errText}`)
        }

        const googleEvent = await res.json()

        await prisma.appointmentCalendarEvent.update({
          where: { id: syncRecord.id },
          data: {
            externalEventId: googleEvent.id,
            status: 'SYNCED',
            lastError: null,
          },
        })
      } catch (err: any) {
        await prisma.appointmentCalendarEvent.update({
          where: { id: syncRecord.id },
          data: {
            status: 'FAILED',
            lastError: err?.message || 'Failed to sync Google Calendar event',
          },
        })
      }
    }
  } catch (outerErr) {
    console.error('[GoogleCalendarSync] Upsert failed unexpectedly:', outerErr)
  }
}

/**
 * DELETE handler.
 * Removes the synced event from each connected participant's Google Calendar.
 * Must be called BEFORE `prisma.appointment.delete()` if hard-deleting the row.
 */
export async function syncAppointmentDelete(appointmentId: string): Promise<void> {
  try {
    const syncRecords = await prisma.appointmentCalendarEvent.findMany({
      where: { appointmentId },
    })

    for (const record of syncRecords) {
      if (!record.externalEventId) {
        await prisma.appointmentCalendarEvent.delete({ where: { id: record.id } })
        continue
      }

      const auth = await getActiveCalendarAuth(record.userId)
      if (!auth) continue // Skip participants with no ACTIVE connection

      try {
        const url = `${GOOGLE_CALENDAR_API}/calendars/${encodeURIComponent(record.calendarId)}/events/${encodeURIComponent(record.externalEventId)}`
        const res = await fetch(url, {
          method: 'DELETE',
          headers: {
            Authorization: `Bearer ${auth.accessToken}`,
          },
        })

        if (!res.ok && res.status !== 404 && res.status !== 410) {
          const errText = await res.text()
          throw new Error(`Google Calendar API ${res.status}: ${errText}`)
        }

        await prisma.appointmentCalendarEvent.delete({
          where: { id: record.id },
        })
      } catch (err: any) {
        await prisma.appointmentCalendarEvent.update({
          where: { id: record.id },
          data: {
            status: 'FAILED',
            attempts: { increment: 1 },
            lastError: err?.message || 'Failed to delete Google Calendar event',
          },
        })
      }
    }
  } catch (outerErr) {
    console.error('[GoogleCalendarSync] Delete failed unexpectedly:', outerErr)
  }
}