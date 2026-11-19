-- REQ-F-11 session log (#213). Rules: docs/session-log-metrics.md.

-- CreateTable
CREATE TABLE "session_log" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "event" TEXT NOT NULL,
    "sessionNoteId" TEXT NOT NULL,
    "appointmentId" TEXT,
    "clinicianUserId" TEXT NOT NULL,
    "clinicianName" TEXT NOT NULL,
    "clientUserId" TEXT NOT NULL,
    "sessionStart" DATETIME NOT NULL,
    "sessionEnd" DATETIME NOT NULL,
    "durationMinutes" INTEGER NOT NULL,
    "countedMinutes" INTEGER NOT NULL,
    "attendanceStatus" TEXT NOT NULL,
    "noteStatus" TEXT NOT NULL,
    "noteKind" TEXT NOT NULL,
    "supersedesId" TEXT,
    "reason" TEXT,
    "recordedById" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "session_log_export" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "exportedById" TEXT NOT NULL,
    "clinicianUserId" TEXT NOT NULL,
    "rangeFrom" DATETIME,
    "rangeTo" DATETIME,
    "rowCount" INTEGER NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateIndex
CREATE UNIQUE INDEX "session_log_supersedesId_key" ON "session_log"("supersedesId");

-- CreateIndex
CREATE INDEX "session_log_clinicianUserId_sessionStart_idx" ON "session_log"("clinicianUserId", "sessionStart");

-- CreateIndex
CREATE INDEX "session_log_sessionNoteId_idx" ON "session_log"("sessionNoteId");

-- CreateIndex
CREATE INDEX "session_log_sessionStart_idx" ON "session_log"("sessionStart");

-- CreateIndex
CREATE INDEX "session_log_export_clinicianUserId_createdAt_idx" ON "session_log_export"("clinicianUserId", "createdAt");

-- CreateIndex
CREATE INDEX "session_log_export_exportedById_idx" ON "session_log_export"("exportedById");

-- Append-only. App code only inserts; these stop anything else (a bug, a script,
-- Prisma Studio) from changing or deleting history. Prisma does not track triggers,
-- so later migrations will not drop them.
CREATE TRIGGER "session_log_no_update" BEFORE UPDATE ON "session_log"
BEGIN
    SELECT RAISE(ABORT, 'session_log is append-only');
END;

CREATE TRIGGER "session_log_no_delete" BEFORE DELETE ON "session_log"
BEGIN
    SELECT RAISE(ABORT, 'session_log is append-only');
END;

CREATE TRIGGER "session_log_export_no_update" BEFORE UPDATE ON "session_log_export"
BEGIN
    SELECT RAISE(ABORT, 'session_log_export is append-only');
END;

CREATE TRIGGER "session_log_export_no_delete" BEFORE DELETE ON "session_log_export"
BEGIN
    SELECT RAISE(ABORT, 'session_log_export is append-only');
END;

-- One chain per note. A note's first row has no supersedesId; every later row must
-- point at a row of the same note. With the unique index on supersedesId, a row can
-- only be superseded once, so two writers can never fork a note's history.
CREATE TRIGGER "session_log_single_chain" BEFORE INSERT ON "session_log"
BEGIN
    SELECT RAISE(ABORT, 'session_log: this note already has a first row')
    WHERE NEW."supersedesId" IS NULL
      AND EXISTS (SELECT 1 FROM "session_log" WHERE "sessionNoteId" = NEW."sessionNoteId");
    SELECT RAISE(ABORT, 'session_log: supersedesId must be a row of the same note')
    WHERE NEW."supersedesId" IS NOT NULL
      AND NOT EXISTS (
        SELECT 1 FROM "session_log"
        WHERE "id" = NEW."supersedesId" AND "sessionNoteId" = NEW."sessionNoteId"
      );
END;
