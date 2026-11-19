-- CreateTable
CREATE TABLE "appointment_calendar_event" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "appointmentId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "externalEventId" TEXT,
    "calendarId" TEXT NOT NULL DEFAULT 'primary',
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "lastError" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "appointment_calendar_event_appointmentId_fkey" FOREIGN KEY ("appointmentId") REFERENCES "Appointment" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "appointment_calendar_event_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "appointment_calendar_event_status_idx" ON "appointment_calendar_event"("status");

-- CreateIndex
CREATE UNIQUE INDEX "appointment_calendar_event_appointmentId_userId_key" ON "appointment_calendar_event"("appointmentId", "userId");
