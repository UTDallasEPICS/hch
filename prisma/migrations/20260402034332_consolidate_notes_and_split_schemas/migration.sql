/*
  Warnings:

  - You are about to drop the column `documentationBase64` on the `change_audit` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "PclQuestion" ADD COLUMN "worstEvent" TEXT;

-- CreateTable
CREATE TABLE "Appointment" (
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
CREATE TABLE "new_change_audit" (
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
INSERT INTO "new_change_audit" ("entityId", "entityType", "id", "newValue", "oldValue", "reasoning", "signatureData", "signedAt", "signedById") SELECT "entityId", "entityType", "id", "newValue", "oldValue", "reasoning", "signatureData", "signedAt", "signedById" FROM "change_audit";
DROP TABLE "change_audit";
ALTER TABLE "new_change_audit" RENAME TO "change_audit";
CREATE INDEX "change_audit_entityType_entityId_idx" ON "change_audit"("entityType", "entityId");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE INDEX "Appointment_clientId_idx" ON "Appointment"("clientId");

-- CreateIndex
CREATE INDEX "Appointment_adminId_idx" ON "Appointment"("adminId");

-- CreateIndex
CREATE UNIQUE INDEX "PhysicianStatementForm_userId_key" ON "PhysicianStatementForm"("userId");

-- CreateIndex
CREATE INDEX "PhysicianStatementForm_status_idx" ON "PhysicianStatementForm"("status");

-- CreateIndex
CREATE UNIQUE INDEX "ReleaseOfInformationAuthorizationForm_userId_key" ON "ReleaseOfInformationAuthorizationForm"("userId");

-- CreateIndex
CREATE INDEX "ReleaseOfInformationAuthorizationForm_status_idx" ON "ReleaseOfInformationAuthorizationForm"("status");

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
