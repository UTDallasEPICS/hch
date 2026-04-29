/*
  Warnings:

  - You are about to drop the `ace_response` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `form` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `form_assignment` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `form_question` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `question` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the column `recurrence` on the `Appointment` table. All the data in the column will be lost.
  - You are about to drop the column `seriesId` on the `Appointment` table. All the data in the column will be lost.

*/
-- DropIndex
DROP INDEX "ace_response_userId_idx";

-- DropIndex
DROP INDEX "form_slug_key";

-- DropIndex
DROP INDEX "form_assignment_userId_formId_key";

-- DropIndex
DROP INDEX "form_assignment_formId_idx";

-- DropIndex
DROP INDEX "form_assignment_userId_idx";

-- DropIndex
DROP INDEX "form_question_formId_questionId_key";

-- DropIndex
DROP INDEX "form_question_questionId_idx";

-- DropIndex
DROP INDEX "form_question_formId_idx";

-- DropIndex
DROP INDEX "question_alias_key";

-- AlterTable
ALTER TABLE "PclForm" ADD COLUMN "severity" TEXT;
ALTER TABLE "PclForm" ADD COLUMN "totalScore" INTEGER;

-- AlterTable
ALTER TABLE "PclQuestion" ADD COLUMN "worstEvent" TEXT;

-- AlterTable
ALTER TABLE "PhqForm" ADD COLUMN "severity" TEXT;

-- AlterTable
ALTER TABLE "PhqQuestion" ADD COLUMN "q10" INTEGER;

-- DropTable
PRAGMA foreign_keys=off;
DROP TABLE "ace_response";
PRAGMA foreign_keys=on;

-- DropTable
PRAGMA foreign_keys=off;
DROP TABLE "form";
PRAGMA foreign_keys=on;

-- DropTable
PRAGMA foreign_keys=off;
DROP TABLE "form_assignment";
PRAGMA foreign_keys=on;

-- DropTable
PRAGMA foreign_keys=off;
DROP TABLE "form_question";
PRAGMA foreign_keys=on;

-- DropTable
PRAGMA foreign_keys=off;
DROP TABLE "question";
PRAGMA foreign_keys=on;

-- CreateTable
CREATE TABLE "client" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'INCOMPLETE',
    "therapyWeek" INTEGER,
    "missedSessions" INTEGER NOT NULL DEFAULT 0,
    CONSTRAINT "client_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "client_permission" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "clientId" TEXT NOT NULL,
    "canViewScores" BOOLEAN NOT NULL DEFAULT false,
    "canViewNotes" BOOLEAN NOT NULL DEFAULT false,
    "canViewPlan" BOOLEAN NOT NULL DEFAULT false,
    CONSTRAINT "client_permission_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "client" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "client_plan" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "clientId" TEXT NOT NULL,
    "content" TEXT NOT NULL DEFAULT '',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "client_plan_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "client" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "change_audit" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "oldValue" TEXT,
    "newValue" TEXT,
    "reasoning" TEXT,
    "documentationPath" TEXT,
    "documentationName" TEXT,
    "signatureData" TEXT NOT NULL,
    "signedById" TEXT NOT NULL,
    "signedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "change_audit_signedById_fkey" FOREIGN KEY ("signedById") REFERENCES "user" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ace_form" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "userId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'IN_PROGRESS',
    "totalScore" INTEGER,
    "severity" TEXT,
    "submittedAt" DATETIME,
    CONSTRAINT "ace_form_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ace_question" (
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
    CONSTRAINT "ace_question_formId_fkey" FOREIGN KEY ("formId") REFERENCES "ace_form" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "ace_question_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "PhysicianStatementForm" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'NOT_SUBMITTED',
    "originalFileName" TEXT,
    "storedFileName" TEXT,
    "mimeType" TEXT,
    "uploadedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "PhysicianStatementForm_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ReleaseOfInformationAuthorizationForm" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'NOT_SUBMITTED',
    "originalFileName" TEXT,
    "storedFileName" TEXT,
    "mimeType" TEXT,
    "uploadedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "ReleaseOfInformationAuthorizationForm_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "session_note" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "clientId" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "attended" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "session_note_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "client" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "session_note_edit" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "sessionNoteId" TEXT NOT NULL,
    "originalContent" TEXT,
    "reason" TEXT,
    "signature" TEXT,
    "editedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "session_note_edit_sessionNoteId_fkey" FOREIGN KEY ("sessionNoteId") REFERENCES "session_note" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "declaration_template" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "requestKind" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "content" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "session_notes_request" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "clientId" TEXT NOT NULL,
    "requestKind" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "signatureData" TEXT NOT NULL,
    "declarationTemplateId" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "decidedAt" DATETIME,
    "decidedByUserId" TEXT,
    "rejectionReason" TEXT,
    "approvedSummaryText" TEXT,
    CONSTRAINT "session_notes_request_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "client" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "session_notes_request_declarationTemplateId_fkey" FOREIGN KEY ("declarationTemplateId") REFERENCES "declaration_template" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "session_notes_request_decidedByUserId_fkey" FOREIGN KEY ("decidedByUserId") REFERENCES "user" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Appointment" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "clientId" TEXT NOT NULL,
    "adminId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "startTime" DATETIME NOT NULL,
    "endTime" DATETIME NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'SCHEDULED',
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
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE UNIQUE INDEX "client_userId_key" ON "client"("userId");

-- CreateIndex
CREATE INDEX "client_status_idx" ON "client"("status");

-- CreateIndex
CREATE UNIQUE INDEX "client_permission_clientId_key" ON "client_permission"("clientId");

-- CreateIndex
CREATE UNIQUE INDEX "client_plan_clientId_key" ON "client_plan"("clientId");

-- CreateIndex
CREATE INDEX "change_audit_entityType_entityId_idx" ON "change_audit"("entityType", "entityId");

-- CreateIndex
CREATE UNIQUE INDEX "ace_form_userId_key" ON "ace_form"("userId");

-- CreateIndex
CREATE INDEX "ace_form_userId_idx" ON "ace_form"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "ace_question_formId_key" ON "ace_question"("formId");

-- CreateIndex
CREATE INDEX "ace_question_userId_idx" ON "ace_question"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "PhysicianStatementForm_userId_key" ON "PhysicianStatementForm"("userId");

-- CreateIndex
CREATE INDEX "PhysicianStatementForm_status_idx" ON "PhysicianStatementForm"("status");

-- CreateIndex
CREATE UNIQUE INDEX "ReleaseOfInformationAuthorizationForm_userId_key" ON "ReleaseOfInformationAuthorizationForm"("userId");

-- CreateIndex
CREATE INDEX "ReleaseOfInformationAuthorizationForm_status_idx" ON "ReleaseOfInformationAuthorizationForm"("status");

-- CreateIndex
CREATE INDEX "session_note_clientId_idx" ON "session_note"("clientId");

-- CreateIndex
CREATE INDEX "session_note_edit_sessionNoteId_idx" ON "session_note_edit"("sessionNoteId");

-- CreateIndex
CREATE UNIQUE INDEX "declaration_template_requestKind_version_key" ON "declaration_template"("requestKind", "version");

-- CreateIndex
CREATE INDEX "session_notes_request_clientId_idx" ON "session_notes_request"("clientId");

-- CreateIndex
CREATE INDEX "session_notes_request_status_idx" ON "session_notes_request"("status");

-- CreateIndex
CREATE INDEX "session_notes_request_declarationTemplateId_idx" ON "session_notes_request"("declarationTemplateId");
