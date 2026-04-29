/*
  Warnings:

  - You are about to drop the column `attended` on the `session_note` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "session_note_edit" ADD COLUMN "editedContent" TEXT;
ALTER TABLE "session_note_edit" ADD COLUMN "newAttendanceStatus" TEXT;
ALTER TABLE "session_note_edit" ADD COLUMN "oldAttendanceStatus" TEXT;

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_session_note" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "clientId" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "attendanceStatus" TEXT DEFAULT 'show',
    "sessionName" TEXT NOT NULL,
    "sessionNumber" INTEGER NOT NULL,
    "appointmentId" TEXT,
    "kind" TEXT NOT NULL DEFAULT 'PROGRESS',
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "signatureData" TEXT,
    "clinicianSignedAt" DATETIME,
    "clinicianSignedById" TEXT,
    "clinicianSignatureData" TEXT,
    "adminSignedAt" DATETIME,
    "adminSignedById" TEXT,
    "adminSignatureData" TEXT,
    "adminApprovalNote" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "session_note_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "client" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "session_note_appointmentId_fkey" FOREIGN KEY ("appointmentId") REFERENCES "Appointment" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "session_note_clinicianSignedById_fkey" FOREIGN KEY ("clinicianSignedById") REFERENCES "user" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "session_note_adminSignedById_fkey" FOREIGN KEY ("adminSignedById") REFERENCES "user" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_session_note" ("adminApprovalNote", "adminSignatureData", "adminSignedAt", "adminSignedById", "appointmentId", "clientId", "clinicianSignatureData", "clinicianSignedAt", "clinicianSignedById", "content", "createdAt", "id", "kind", "sessionName", "sessionNumber", "signatureData", "status", "updatedAt") SELECT "adminApprovalNote", "adminSignatureData", "adminSignedAt", "adminSignedById", "appointmentId", "clientId", "clinicianSignatureData", "clinicianSignedAt", "clinicianSignedById", "content", "createdAt", "id", "kind", "sessionName", "sessionNumber", "signatureData", "status", "updatedAt" FROM "session_note";
DROP TABLE "session_note";
ALTER TABLE "new_session_note" RENAME TO "session_note";
CREATE INDEX "session_note_clientId_idx" ON "session_note"("clientId");
CREATE INDEX "session_note_appointmentId_idx" ON "session_note"("appointmentId");
CREATE INDEX "session_note_status_idx" ON "session_note"("status");
CREATE INDEX "session_note_kind_idx" ON "session_note"("kind");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
