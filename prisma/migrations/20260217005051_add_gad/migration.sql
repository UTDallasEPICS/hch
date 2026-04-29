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

-- CreateIndex
CREATE INDEX "GadForm_userId_idx" ON "GadForm"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "GadQuestion_formId_key" ON "GadQuestion"("formId");

-- CreateIndex
CREATE INDEX "GadQuestion_userId_idx" ON "GadQuestion"("userId");
