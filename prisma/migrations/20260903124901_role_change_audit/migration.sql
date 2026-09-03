-- CreateTable
CREATE TABLE "role_change_audit" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "targetUserId" TEXT NOT NULL,
    "targetEmail" TEXT NOT NULL,
    "oldRole" TEXT NOT NULL,
    "newRole" TEXT NOT NULL,
    "changedById" TEXT NOT NULL,
    "changedByEmail" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateIndex
CREATE INDEX "role_change_audit_targetUserId_idx" ON "role_change_audit"("targetUserId");
