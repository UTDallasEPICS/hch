# Session Log and Admin Metrics (REQ-F-11)

Decisions for the per-clinician session log and the admin metrics, so they don't need to be re-decided in each PR. Parent issue: #211.

## 1. What counts as an hour

A session counts when its note is **clinician-signed** (`CLINICIAN_SIGNED` or `FULLY_APPROVED`) with attendance **`show`**.

- Minutes = the appointment's scheduled length (`endTime - startTime`). We don't record actual start and stop times.
- No-shows and every kind of cancel count 0 minutes.
- Progress and psychotherapy notes both count.

**Why signed, not just `show`?** Every new appointment gets a placeholder note with attendance already set to `show`
(`server/utils/create-staff-appointment.ts`), so `show` alone would count sessions that haven't happened.
Signing is when attendance becomes required and the clinician vouches that the session happened.

**Why not wait for admin approval?** Hours would lag behind the approval queue.
The log keeps the note status, so the export still shows which sessions an admin has approved.

## 2. Clinician of record

The user who clinician-signed the note (`clinicianSignedById`).

Not `Appointment.adminId`: that is whoever booked the session, which can be an admin.
Not `Client.clinicianUserId`: that changes when a client is reassigned (REQ-F-05).

## 3. Admin metrics

| Metric                         | Definition                                                                                  |
| ------------------------------ | ------------------------------------------------------------------------------------------- |
| Total clients (clients served) | Distinct clients with at least one counted session, all time                                |
| Active clients                 | Clients whose status is `ACTIVE` right now. Status history isn't stored, so it has no chart |
| Cumulative hours               | Sum of counted minutes, all time, shown in hours with 1 decimal                             |
| Monthly series                 | Hours and clients served for the last 12 months. The current month is marked as partial     |
| MoM growth                     | `(last full month - month before) / month before`, for hours and for clients served         |

- Months go by **session date in clinic time** (`server/utils/clinic-time.ts`), not by the date the note was signed.
  A note signed late changes the numbers for its own month.
- Growth compares the last **full** month with the one before, so a half-finished month doesn't look like a drop.
  If the month before is 0, growth is `null` and the UI shows "—".
- Metrics are computed on each request from the session log. No snapshot job; revisit if it gets slow.
- The existing "Program totals" number (`WAITLIST` + `ACTIVE`) stays. It measures enrollment, not service.

## 4. Session log

A new `session_log` table. Each row is a snapshot of one session at one moment: clinician (id and name), client user id,
appointment id, note id, start, end, minutes, counted minutes, attendance, note status, event, reason, who wrote it, and when.

A row is added whenever one of those values changes:

| Event       | When                                                                                         |
| ----------- | -------------------------------------------------------------------------------------------- |
| `SIGNED`    | A clinician signs the note                                                                   |
| `CORRECTED` | A signed note is re-signed with a different attendance, or a signed session's time is edited |
| `UNSIGNED`  | A signed note is saved back to draft (counted minutes 0)                                     |
| `APPROVED`  | An admin counter-signs                                                                       |
| `BACKFILL`  | One row per note that is already signed when this ships (#215)                               |

- A correction is a new row that points at the previous one (`supersedesId`). A session's current state is its latest row,
  so corrections are never counted twice.
- Drafts never write rows. Editing only the note text writes nothing.
- Deleting an appointment or a client doesn't touch the log.

### Immutable

- App code only inserts. There are no update or delete routes.
- SQLite triggers block `UPDATE` and `DELETE` on `session_log`.
- No foreign keys, just IDs and snapshots, so deleting a user, client, or appointment can't cascade into the log.
- No hash chain. Anyone who can get around the triggers can also rewrite a chain.
  Backups and server access (REQ-F-10) are the real protection there.

## 5. Access and export

|                              | Admin         | Clinician | Client |
| ---------------------------- | ------------- | --------- | ------ |
| Admin metrics                | Yes           | No        | No     |
| View or export a session log | Any clinician | Their own | No     |

Clinicians can export their own log because credentialing is for them, and it only lists sessions they signed.

- CSV columns: date, start, end, minutes, counted minutes, attendance, note status, event, entry id, supersedes id.
  A header block gives the clinician, date range, total hours, and who exported it and when.
- **No client information** in the export or the log view: no name, id, session name (it is built from the client's name),
  note text, or correction reason (free text that may mention the client).
- Every export is recorded (who, which clinician, date range, when) in an append-only `session_log_export` table.

## 6. Still to confirm with HCH

- Count hours at clinician signature (current rule), or only after admin approval?
- Should late cancels count toward credentialing hours? Currently they don't.
