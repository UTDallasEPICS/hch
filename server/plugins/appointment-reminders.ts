import { sendDueReminders } from '../utils/appointment-reminders'

/** How often to check for appointments that need a reminder (#123). */
const DEFAULT_POLL_MS = 5 * 60 * 1000

/**
 * Starts the 24h reminder check when the server boots (#123).
 *
 * The app runs as one long-lived Node server on ECS, so a simple interval
 * inside the server is enough. No cron service needed.
 * Running it often is safe: sendDueReminders only sends once per appointment.
 *
 * Env:
 *   REMINDERS_DISABLED=1  turn the check off (e.g. on a teammate's laptop)
 *   REMINDER_POLL_MS      check interval in ms (default 5 minutes)
 */
export default defineNitroPlugin((nitroApp) => {
  if (process.env.REMINDERS_DISABLED === '1') return

  const pollMs = Number(process.env.REMINDER_POLL_MS) || DEFAULT_POLL_MS
  let running = false

  async function check() {
    // Skip if the last check is still going, so two never overlap.
    if (running) return
    running = true
    try {
      const sent = await sendDueReminders()
      if (sent > 0) console.log(`[reminders] sent ${sent} reminder(s)`)
    } catch (err) {
      console.error('[reminders] check failed', err)
    } finally {
      running = false
    }
  }

  const timer = setInterval(check, pollMs)
  // Don't keep the process alive just for this timer.
  timer.unref?.()
  void check()

  // Stop the old timer when the dev server reloads or the app shuts down.
  nitroApp.hooks.hook('close', () => clearInterval(timer))
})
