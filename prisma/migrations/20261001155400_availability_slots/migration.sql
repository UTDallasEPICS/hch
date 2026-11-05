-- CreateTable
CREATE TABLE "availability_slot" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "clinicianUserId" TEXT NOT NULL,
    "startTime" DATETIME NOT NULL,
    "endTime" DATETIME NOT NULL,
    "location" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'OPEN',
    "capacity" INTEGER NOT NULL DEFAULT 1,
    "createdByUserId" TEXT NOT NULL,
    "sourceType" TEXT NOT NULL,
    "appointmentId" TEXT,
    CONSTRAINT "availability_slot_clinicianUserId_fkey" FOREIGN KEY ("clinicianUserId") REFERENCES "user" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "availability_slot_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "user" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "availability_slot_appointmentId_fkey" FOREIGN KEY ("appointmentId") REFERENCES "Appointment" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "availability_slot_appointmentId_key" ON "availability_slot"("appointmentId");

-- CreateIndex
CREATE INDEX "availability_slot_clinicianUserId_idx" ON "availability_slot"("clinicianUserId");

-- CreateIndex
CREATE INDEX "availability_slot_startTime_endTime_idx" ON "availability_slot"("startTime", "endTime");

-- CreateIndex
CREATE INDEX "availability_slot_status_idx" ON "availability_slot"("status");
