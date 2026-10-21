# Appointment Notification Policy (REQ-F-08)

Decisions for appointment notifications, so they don't need to be re-decided in each PR. Parent issue: #118.

## 1. Who gets notified

Every appointment notification (booked, rescheduled, cancelled, reminder) goes to:

- **The client**, and
- **Their assigned clinician** (`Client.clinicianUserId`).

**If the client has no assigned clinician**, it goes to the client and **every admin** instead.
We chose all admins over the admin who booked the session (`Appointment.adminId`)
because the booking admin may not be the one handling the client, and any admin can follow up.

No one else is notified. Other clinicians never see notifications for clients who aren't theirs.
This matches who is allowed to view the client's records (same lookup as the access check, #121).

Emails are sent **one per person**, so recipients never see each other's addresses (#124).

## 2. Recurring series

Each session in a series is its own appointment, so the rules differ by type:

| Action | What gets sent |
|---|---|
| **Booking a series** | **One** notice per person: "4 sessions booked, starting ..." |
| **Rescheduling** "all" or "this and future" | **One** notice per person: "Recurring sessions moved ..." |
| **Cancelling** "all" or "this and future" | **One** notice per person: "4 sessions in a recurring series were cancelled." |
| **Reminders** | **One per session**, 24h before each one |

**Why combine the first three?** A weekly series can have many sessions.
Sending one email per session would flood the client's inbox with the same news.

**Why not combine reminders?** Each reminder is about a different day,
so each session needs its own.

Rescheduling only notifies when the **time changes**.
Editing just the description or video link sends nothing.

## 3. Reminder timing

**v1 sends one reminder, 24 hours before each session.** A 1-hour reminder is deferred.

How it works (#123):

- The server checks every **5 minutes** for sessions starting in the next 24 hours
  that haven't been reminded yet, so a reminder arrives within 5 minutes of the 24h mark.
- A session booked **less than 24 hours ahead** gets its reminder at the next check
  (within 5 minutes of booking).
- Each session is reminded **once**. The session is marked as reminded (`remindedAt`)
  before anything is sent, so two checks running at the same time can't both send it.
- **Rescheduling** clears that mark, so the new time gets its own reminder.
- Cancelled (deleted) sessions are never reminded.

**Why not a 1-hour reminder in v1?** One reminder covers the main need
(not forgetting the session), and extra messages per session can overload
the user's inbox. A 1-hour reminder could be added later as an **opt-in setting**
for users who want it (it would need its own marker field, e.g. `remindedAt1h`).

## 4. Quiet hours

**Quiet hours are 11:00 PM to 6:00 AM clinic time (America/Chicago).**

- **Reminders** are not sent during quiet hours. Any reminder that comes due
  overnight goes out at the first check after 6:00 AM.
- **Booked, rescheduled and cancelled** notifications are always sent right away,
  even during quiet hours, because they are time-sensitive (e.g. a 9 AM session
  cancelled at 7 AM).

**Why:** a late-night message about therapy can be stressful or intrusive,
especially on a shared device. Reminders are not urgent, so holding them is safe.

**Edge case:** a session booked late at night for early the next morning
(e.g. booked at 11:30 PM for 6:30 AM) gets its reminder at 6:00 AM,
only 30 minutes before. This is acceptable because the client already
got the "Session booked" notice when it was booked.

**Status:** decided, not built yet. Tracked in #187 (depends on #123 and #126).

## 5. Channels

Every appointment notification is sent on **both** channels:

| Type | Email | In-app (bell) |
|---|---|---|
| Booked | ✅ | ✅ |
| Rescheduled | ✅ | ✅ |
| Cancelled | ✅ | ✅ |
| Reminder | ✅ | ✅ |

- Emails use the shared template (#124): subject starts with `[HCH]`, and all text is escaped.
- If email isn't set up (e.g. local dev with no `EMAIL_USER`/`EMAIL_PASS`),
  emails are skipped and logged; in-app notifications are still saved.
- If an email fails, the booking/change itself still succeeds. Notifications never block the action.

## 6. Known limitations

- **Clients have no notification bell.** Their in-app notifications are saved,
  but only staff can see the bell (on the staff dashboard). Clients currently
  rely on email.
- **One failed email can stop the rest.** Emails are sent one at a time, so if one
  recipient's address is rejected, recipients after it don't get the email
  for that notification (in-app notifications are unaffected).