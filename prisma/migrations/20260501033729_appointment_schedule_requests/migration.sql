-- CreateTable
CREATE TABLE "appointment_schedule_request" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "clientId" TEXT NOT NULL,
    "requestedStartTime" DATETIME NOT NULL,
    "requestedEndTime" DATETIME NOT NULL,
    "message" TEXT,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "decidedAt" DATETIME,
    "decidedByUserId" TEXT,
    "staffResponseNote" TEXT,
    "createdAppointmentId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "appointment_schedule_request_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "user" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "appointment_schedule_request_decidedByUserId_fkey" FOREIGN KEY ("decidedByUserId") REFERENCES "user" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "appointment_schedule_request_createdAppointmentId_fkey" FOREIGN KEY ("createdAppointmentId") REFERENCES "Appointment" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "appointment_schedule_request_createdAppointmentId_key" ON "appointment_schedule_request"("createdAppointmentId");

-- CreateIndex
CREATE INDEX "appointment_schedule_request_clientId_idx" ON "appointment_schedule_request"("clientId");

-- CreateIndex
CREATE INDEX "appointment_schedule_request_status_idx" ON "appointment_schedule_request"("status");
