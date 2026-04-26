/*
  Warnings:

  - You are about to drop the `ace_response` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropTable
PRAGMA foreign_keys=off;
DROP TABLE "ace_response";
PRAGMA foreign_keys=on;

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

-- CreateIndex
CREATE UNIQUE INDEX "ace_form_userId_key" ON "ace_form"("userId");

-- CreateIndex
CREATE INDEX "ace_form_userId_idx" ON "ace_form"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "ace_question_formId_key" ON "ace_question"("formId");

-- CreateIndex
CREATE INDEX "ace_question_userId_idx" ON "ace_question"("userId");
