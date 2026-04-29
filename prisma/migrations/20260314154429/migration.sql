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
CREATE TABLE "session_note" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "clientId" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "session_note_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "client" ("id") ON DELETE CASCADE ON UPDATE CASCADE
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
CREATE TABLE "form" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "slug" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "question" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "text" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "alias" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "form_question" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "formId" TEXT NOT NULL,
    "questionId" TEXT NOT NULL,
    "order" INTEGER NOT NULL,
    CONSTRAINT "form_question_questionId_fkey" FOREIGN KEY ("questionId") REFERENCES "question" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "form_question_formId_fkey" FOREIGN KEY ("formId") REFERENCES "form" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "form_assignment" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "formId" TEXT NOT NULL,
    "assignedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" DATETIME,
    CONSTRAINT "form_assignment_formId_fkey" FOREIGN KEY ("formId") REFERENCES "form" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "form_assignment_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ace_response" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "responses" TEXT NOT NULL,
    "completedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ace_response_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "AppForm" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "userId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'IN_PROGRESS',
    "submittedAt" DATETIME,
    CONSTRAINT "AppForm_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "AppQuestion" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "formId" INTEGER NOT NULL,
    "userId" TEXT NOT NULL,
    "q01" TEXT,
    "q02" TEXT,
    "q03" TEXT,
    "q04" TEXT,
    "q05" TEXT,
    "q06" TEXT,
    "q07" TEXT,
    "q08" TEXT,
    "q09" TEXT,
    "q10" TEXT,
    "q11" TEXT,
    "q12" TEXT,
    "q13" TEXT,
    "q14" TEXT,
    "q15" TEXT,
    "q16" TEXT,
    "q17" TEXT,
    "q18" TEXT,
    "q19" TEXT,
    "q20" TEXT,
    "q21" TEXT,
    "q22" TEXT,
    "q23" TEXT,
    "q24" TEXT,
    "q25" TEXT,
    "q26" TEXT,
    "q27" TEXT,
    "q28" TEXT,
    "q29" TEXT,
    "q30" TEXT,
    "q31" TEXT,
    "q32" TEXT,
    "q33" TEXT,
    "q34" TEXT,
    "q35" TEXT,
    "q36" TEXT,
    "q37" TEXT,
    "q38" TEXT,
    "q39" TEXT,
    "q40" TEXT,
    "q41" TEXT,
    "q42" TEXT,
    "q43" TEXT,
    "q44" TEXT,
    "q45" TEXT,
    "q46" TEXT,
    "q47" TEXT,
    "q48" TEXT,
    "q49" TEXT,
    "q50" TEXT,
    CONSTRAINT "AppQuestion_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "AppQuestion_formId_fkey" FOREIGN KEY ("formId") REFERENCES "AppForm" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "GadForm" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "userId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'IN_PROGRESS',
    "totalScore" INTEGER,
    "severity" TEXT,
    "submittedAt" DATETIME,
    CONSTRAINT "GadForm_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "GadQuestion" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "formId" INTEGER NOT NULL,
    "userId" TEXT NOT NULL,
    "g01" INTEGER,
    "g02" INTEGER,
    "g03" INTEGER,
    "g04" INTEGER,
    "g05" INTEGER,
    "g06" INTEGER,
    "g07" INTEGER,
    "g08" INTEGER,
    CONSTRAINT "GadQuestion_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "GadQuestion_formId_fkey" FOREIGN KEY ("formId") REFERENCES "GadForm" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "PhqForm" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "userId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'IN_PROGRESS',
    "totalScore" INTEGER,
    "submittedAt" DATETIME,
    "severity" TEXT,
    CONSTRAINT "PhqForm_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "PhqQuestion" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "formId" INTEGER NOT NULL,
    "userId" TEXT NOT NULL,
    "q1" INTEGER,
    "q2" INTEGER,
    "q3" INTEGER,
    "q4" INTEGER,
    "q5" INTEGER,
    "q6" INTEGER,
    "q7" INTEGER,
    "q8" INTEGER,
    "q9" INTEGER,
    "q10" INTEGER,
    CONSTRAINT "PhqQuestion_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "PhqQuestion_formId_fkey" FOREIGN KEY ("formId") REFERENCES "PhqForm" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "PclForm" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "userId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'IN_PROGRESS',
    "submittedAt" DATETIME,
    "severity" TEXT,
    "totalScore" INTEGER,
    CONSTRAINT "PclForm_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "PclQuestion" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "formId" INTEGER NOT NULL,
    "userId" TEXT NOT NULL,
    "q01" INTEGER,
    "q02" INTEGER,
    "q03" INTEGER,
    "q04" INTEGER,
    "q05" INTEGER,
    "q06" INTEGER,
    "q07" INTEGER,
    "q08" INTEGER,
    "q09" INTEGER,
    "q10" INTEGER,
    "q11" INTEGER,
    "q12" INTEGER,
    "q13" INTEGER,
    "q14" INTEGER,
    "q15" INTEGER,
    "q16" INTEGER,
    "q17" INTEGER,
    "q18" INTEGER,
    "q19" INTEGER,
    "q20" INTEGER,
    CONSTRAINT "PclQuestion_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "PclQuestion_formId_fkey" FOREIGN KEY ("formId") REFERENCES "PclForm" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "change_audit" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "oldValue" TEXT,
    "newValue" TEXT,
    "reasoning" TEXT,
    "documentationBase64" TEXT,
    "signatureData" TEXT NOT NULL,
    "signedById" TEXT NOT NULL,
    "signedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "change_audit_signedById_fkey" FOREIGN KEY ("signedById") REFERENCES "user" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_user" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "emailVerified" BOOLEAN NOT NULL DEFAULT false,
    "image" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'CLIENT',
    "phoneNumber" INTEGER
);
INSERT INTO "new_user" ("createdAt", "email", "emailVerified", "id", "image", "name", "updatedAt") SELECT "createdAt", "email", "emailVerified", "id", "image", "name", "updatedAt" FROM "user";
DROP TABLE "user";
ALTER TABLE "new_user" RENAME TO "user";
CREATE UNIQUE INDEX "user_email_key" ON "user"("email");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE UNIQUE INDEX "client_userId_key" ON "client"("userId");

-- CreateIndex
CREATE INDEX "client_status_idx" ON "client"("status");

-- CreateIndex
CREATE UNIQUE INDEX "client_permission_clientId_key" ON "client_permission"("clientId");

-- CreateIndex
CREATE INDEX "session_note_clientId_idx" ON "session_note"("clientId");

-- CreateIndex
CREATE UNIQUE INDEX "client_plan_clientId_key" ON "client_plan"("clientId");

-- CreateIndex
CREATE UNIQUE INDEX "form_slug_key" ON "form"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "question_alias_key" ON "question"("alias");

-- CreateIndex
CREATE INDEX "form_question_formId_idx" ON "form_question"("formId");

-- CreateIndex
CREATE INDEX "form_question_questionId_idx" ON "form_question"("questionId");

-- CreateIndex
CREATE UNIQUE INDEX "form_question_formId_questionId_key" ON "form_question"("formId", "questionId");

-- CreateIndex
CREATE INDEX "form_assignment_userId_idx" ON "form_assignment"("userId");

-- CreateIndex
CREATE INDEX "form_assignment_formId_idx" ON "form_assignment"("formId");

-- CreateIndex
CREATE UNIQUE INDEX "form_assignment_userId_formId_key" ON "form_assignment"("userId", "formId");

-- CreateIndex
CREATE INDEX "ace_response_userId_idx" ON "ace_response"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "AppForm_userId_key" ON "AppForm"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "AppQuestion_formId_key" ON "AppQuestion"("formId");

-- CreateIndex
CREATE INDEX "AppQuestion_userId_idx" ON "AppQuestion"("userId");

-- CreateIndex
CREATE INDEX "GadForm_userId_idx" ON "GadForm"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "GadQuestion_formId_key" ON "GadQuestion"("formId");

-- CreateIndex
CREATE INDEX "GadQuestion_userId_idx" ON "GadQuestion"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "PhqForm_userId_key" ON "PhqForm"("userId");

-- CreateIndex
CREATE INDEX "PhqForm_userId_idx" ON "PhqForm"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "PhqQuestion_formId_key" ON "PhqQuestion"("formId");

-- CreateIndex
CREATE INDEX "PhqQuestion_userId_idx" ON "PhqQuestion"("userId");

-- CreateIndex
CREATE INDEX "PclForm_userId_idx" ON "PclForm"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "PclQuestion_formId_key" ON "PclQuestion"("formId");

-- CreateIndex
CREATE INDEX "PclQuestion_userId_idx" ON "PclQuestion"("userId");

-- CreateIndex
CREATE INDEX "change_audit_entityType_entityId_idx" ON "change_audit"("entityType", "entityId");
