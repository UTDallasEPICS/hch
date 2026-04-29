/*
  Warnings:

  - You are about to drop the `GadForm` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `GadQuestion` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the column `image` on the `user` table. All the data in the column will be lost.

*/
-- DropIndex
DROP INDEX "GadForm_userId_idx";

-- DropIndex
DROP INDEX "GadQuestion_userId_idx";

-- DropIndex
DROP INDEX "GadQuestion_formId_key";

-- DropTable
PRAGMA foreign_keys=off;
DROP TABLE "GadForm";
PRAGMA foreign_keys=on;

-- DropTable
PRAGMA foreign_keys=off;
DROP TABLE "GadQuestion";
PRAGMA foreign_keys=on;

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
    CONSTRAINT "AppQuestion_formId_fkey" FOREIGN KEY ("formId") REFERENCES "AppForm" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "AppQuestion_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_user" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "emailVerified" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'CLIENT',
    "phoneNumber" INTEGER
);
INSERT INTO "new_user" ("createdAt", "email", "emailVerified", "id", "name", "updatedAt") SELECT "createdAt", "email", "emailVerified", "id", "name", "updatedAt" FROM "user";
DROP TABLE "user";
ALTER TABLE "new_user" RENAME TO "user";
CREATE UNIQUE INDEX "user_email_key" ON "user"("email");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE UNIQUE INDEX "AppForm_userId_key" ON "AppForm"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "AppQuestion_formId_key" ON "AppQuestion"("formId");

-- CreateIndex
CREATE INDEX "AppQuestion_userId_idx" ON "AppQuestion"("userId");
