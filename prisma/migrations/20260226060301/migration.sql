-- CreateTable
CREATE TABLE "client" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'INCOMPLETE',
    "therapyWeek" INTEGER,
    CONSTRAINT "client_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "client_userId_key" ON "client"("userId");

-- CreateIndex
CREATE INDEX "client_status_idx" ON "client"("status");
