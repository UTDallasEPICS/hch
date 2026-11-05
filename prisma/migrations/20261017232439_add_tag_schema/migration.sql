-- CreateTable
CREATE TABLE "tag" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "clinician_tag" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "tagId" TEXT NOT NULL,
    "weight" INTEGER NOT NULL DEFAULT 3,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "clinician_tag_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "clinician_tag_tagId_fkey" FOREIGN KEY ("tagId") REFERENCES "tag" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "client_tag" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "clientId" TEXT NOT NULL,
    "tagId" TEXT NOT NULL,
    "weight" INTEGER NOT NULL DEFAULT 3,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "client_tag_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "client" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "client_tag_tagId_fkey" FOREIGN KEY ("tagId") REFERENCES "tag" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "tag_name_category_key" ON "tag"("name", "category");

-- CreateIndex
CREATE INDEX "clinician_tag_userId_idx" ON "clinician_tag"("userId");

-- CreateIndex
CREATE INDEX "clinician_tag_tagId_idx" ON "clinician_tag"("tagId");

-- CreateIndex
CREATE UNIQUE INDEX "clinician_tag_userId_tagId_key" ON "clinician_tag"("userId", "tagId");

-- CreateIndex
CREATE INDEX "client_tag_clientId_idx" ON "client_tag"("clientId");

-- CreateIndex
CREATE INDEX "client_tag_tagId_idx" ON "client_tag"("tagId");

-- CreateIndex
CREATE UNIQUE INDEX "client_tag_clientId_tagId_key" ON "client_tag"("clientId", "tagId");
