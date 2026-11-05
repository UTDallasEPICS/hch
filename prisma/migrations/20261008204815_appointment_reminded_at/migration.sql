-- AlterTable
ALTER TABLE "Appointment" ADD COLUMN "remindedAt" DATETIME;

-- CreateIndex
CREATE INDEX "Appointment_startTime_idx" ON "Appointment"("startTime");
