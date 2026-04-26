/*
  Warnings:

  - You are about to drop the `ace_form` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `ace_question` table. If the table is not empty, all the data it contains will be lost.
  - Added the required column `sessionName` to the `Appointment` table without a default value. This is not possible if the table is not empty.
  - Added the required column `sessionNumber` to the `Appointment` table without a default value. This is not possible if the table is not empty.
  - Added the required column `sessionName` to the `session_note` table without a default value. This is not possible if the table is not empty.
  - Added the required column `sessionNumber` to the `session_note` table without a default value. This is not possible if the table is not empty.

*/
-- DropIndex
DROP INDEX "PhqForm_userId_key";

-- DropIndex
DROP INDEX "ace_form_userId_idx";

-- DropIndex
DROP INDEX "ace_form_userId_key";

-- DropIndex
DROP INDEX "ace_question_userId_idx";

-- DropIndex
DROP INDEX "ace_question_formId_key";

-- AlterTable
ALTER TABLE "session_notes_request" ADD COLUMN "approvalReason" TEXT;
ALTER TABLE "session_notes_request" ADD COLUMN "endDate" DATETIME;
ALTER TABLE "session_notes_request" ADD COLUMN "startDate" DATETIME;

-- DropTable
PRAGMA foreign_keys=off;
DROP TABLE "ace_form";
PRAGMA foreign_keys=on;

-- DropTable
PRAGMA foreign_keys=off;
DROP TABLE "ace_question";
PRAGMA foreign_keys=on;

-- CreateTable
CREATE TABLE "client_form_score_history" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "formKey" TEXT NOT NULL,
    "score" INTEGER,
    "severity" TEXT,
    "recordedAt" DATETIME NOT NULL,
    "answersJson" TEXT,
    CONSTRAINT "client_form_score_history_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "AceForm" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "userId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'IN_PROGRESS',
    "totalScore" INTEGER,
    "severity" TEXT,
    "submittedAt" DATETIME,
    CONSTRAINT "AceForm_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "AceQuestion" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "formId" INTEGER NOT NULL,
    "userId" TEXT NOT NULL,
    "a01" TEXT,
    "a02" TEXT,
    "a03" TEXT,
    "a04" TEXT,
    "a05" TEXT,
    "a06" TEXT,
    "a07" TEXT,
    "a08" TEXT,
    "a09" TEXT,
    "a10" TEXT,
    CONSTRAINT "AceQuestion_formId_fkey" FOREIGN KEY ("formId") REFERENCES "AceForm" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "AceQuestion_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "notification" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "sessionNoteId" TEXT,
    "readAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "notification_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "notification_sessionNoteId_fkey" FOREIGN KEY ("sessionNoteId") REFERENCES "session_note" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Appointment" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "clientId" TEXT NOT NULL,
    "adminId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "sessionName" TEXT NOT NULL,
    "sessionNumber" INTEGER NOT NULL,
    "description" TEXT,
    "startTime" DATETIME NOT NULL,
    "endTime" DATETIME NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'SCHEDULED',
    "videoProvider" TEXT,
    "videoJoinUrl" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Appointment_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "user" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Appointment_adminId_fkey" FOREIGN KEY ("adminId") REFERENCES "user" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_Appointment" ("adminId", "clientId", "createdAt", "description", "endTime", "id", "startTime", "status", "title", "updatedAt") SELECT "adminId", "clientId", "createdAt", "description", "endTime", "id", "startTime", "status", "title", "updatedAt" FROM "Appointment";
DROP TABLE "Appointment";
ALTER TABLE "new_Appointment" RENAME TO "Appointment";
CREATE INDEX "Appointment_clientId_idx" ON "Appointment"("clientId");
CREATE INDEX "Appointment_adminId_idx" ON "Appointment"("adminId");
CREATE UNIQUE INDEX "Appointment_clientId_sessionNumber_key" ON "Appointment"("clientId", "sessionNumber");
CREATE TABLE "new_client" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'INCOMPLETE',
    "waitlistedAt" DATETIME,
    "archivedAt" DATETIME,
    "therapyWeek" INTEGER,
    "missedSessions" INTEGER NOT NULL DEFAULT 0,
    "clinicianUserId" TEXT,
    CONSTRAINT "client_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "client_clinicianUserId_fkey" FOREIGN KEY ("clinicianUserId") REFERENCES "user" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_client" ("id", "missedSessions", "status", "therapyWeek", "userId") SELECT "id", "missedSessions", "status", "therapyWeek", "userId" FROM "client";
DROP TABLE "client";
ALTER TABLE "new_client" RENAME TO "client";
CREATE UNIQUE INDEX "client_userId_key" ON "client"("userId");
CREATE INDEX "client_status_idx" ON "client"("status");
CREATE INDEX "client_clinicianUserId_idx" ON "client"("clinicianUserId");
CREATE TABLE "new_session_note" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "clientId" TEXT NOT NULL,
    "sessionName" TEXT NOT NULL,
    "sessionNumber" INTEGER NOT NULL,
    "appointmentId" TEXT,
    "kind" TEXT NOT NULL DEFAULT 'PROGRESS',
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "content" TEXT NOT NULL,
    "attended" BOOLEAN NOT NULL DEFAULT true,
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
INSERT INTO "new_session_note" ("clientId", "content", "createdAt", "id") SELECT "clientId", "content", "createdAt", "id" FROM "session_note";
DROP TABLE "session_note";
ALTER TABLE "new_session_note" RENAME TO "session_note";
CREATE INDEX "session_note_clientId_idx" ON "session_note"("clientId");
CREATE INDEX "session_note_appointmentId_idx" ON "session_note"("appointmentId");
CREATE INDEX "session_note_status_idx" ON "session_note"("status");
CREATE INDEX "session_note_kind_idx" ON "session_note"("kind");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE INDEX "client_form_score_history_userId_recordedAt_idx" ON "client_form_score_history"("userId", "recordedAt");

-- CreateIndex
CREATE INDEX "AceForm_userId_idx" ON "AceForm"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "AceQuestion_formId_key" ON "AceQuestion"("formId");

-- CreateIndex
CREATE INDEX "AceQuestion_userId_idx" ON "AceQuestion"("userId");

-- CreateIndex
CREATE INDEX "notification_userId_readAt_idx" ON "notification"("userId", "readAt");

-- CreateIndex
CREATE INDEX "notification_userId_createdAt_idx" ON "notification"("userId", "createdAt");
