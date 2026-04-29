-- AlterTable
ALTER TABLE "user" ADD COLUMN "image" TEXT;

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
    CONSTRAINT "form_question_formId_fkey" FOREIGN KEY ("formId") REFERENCES "form" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "form_question_questionId_fkey" FOREIGN KEY ("questionId") REFERENCES "question" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "form_assignment" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "formId" TEXT NOT NULL,
    "assignedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" DATETIME,
    CONSTRAINT "form_assignment_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "form_assignment_formId_fkey" FOREIGN KEY ("formId") REFERENCES "form" ("id") ON DELETE CASCADE ON UPDATE CASCADE
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
    CONSTRAINT "GadQuestion_formId_fkey" FOREIGN KEY ("formId") REFERENCES "GadForm" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "GadQuestion_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "PhqForm" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "userId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'IN_PROGRESS',
    "totalScore" INTEGER,
    "submittedAt" DATETIME,
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
    CONSTRAINT "PhqQuestion_formId_fkey" FOREIGN KEY ("formId") REFERENCES "PhqForm" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "PhqQuestion_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "PclForm" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "userId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'IN_PROGRESS',
    "submittedAt" DATETIME,
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
    CONSTRAINT "PclQuestion_formId_fkey" FOREIGN KEY ("formId") REFERENCES "PclForm" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "PclQuestion_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

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
