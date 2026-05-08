-- CreateTable
CREATE TABLE "Appointment" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "clientId" TEXT NOT NULL,
    "adminId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "sessionName" TEXT NOT NULL,
    "sessionNumber" INTEGER NOT NULL,
    "description" TEXT,
    "startTime" DATETIME NOT NULL,
    "endTime" DATETIME NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'SCHEDULED',
    "seriesId" TEXT,
    "recurrence" TEXT NOT NULL,
    "videoProvider" TEXT,
    "videoJoinUrl" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Appointment_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "user" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Appointment_adminId_fkey" FOREIGN KEY ("adminId") REFERENCES "user" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "client" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'INCOMPLETE',
    "waitlistedAt" DATETIME,
    "archivedAt" DATETIME,
    "therapyWeek" INTEGER,
    "missedSessions" INTEGER NOT NULL DEFAULT 0,
    "clinicianUserId" TEXT,
    CONSTRAINT "client_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "client_clinicianUserId_fkey" FOREIGN KEY ("clinicianUserId") REFERENCES "user" ("id") ON DELETE SET NULL ON UPDATE CASCADE
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
CREATE TABLE "client_plan" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "clientId" TEXT NOT NULL,
    "content" TEXT NOT NULL DEFAULT '',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "client_plan_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "client" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "change_audit" (
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

-- CreateTable
CREATE TABLE "client_form_score_history" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "formKey" TEXT NOT NULL,
    "score" INTEGER,
    "severity" TEXT,
    "recordedAt" DATETIME NOT NULL,
    "answersJson" TEXT,
    CONSTRAINT "client_form_score_history_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "AceForm" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "userId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'IN_PROGRESS',
    "totalScore" INTEGER,
    "severity" TEXT,
    "submittedAt" DATETIME,
    CONSTRAINT "AceForm_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "AceQuestion" (
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
    CONSTRAINT "AceQuestion_formId_fkey" FOREIGN KEY ("formId") REFERENCES "AceForm" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "AceQuestion_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user" ("id") ON DELETE CASCADE ON UPDATE CASCADE
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
    CONSTRAINT "AppQuestion_formId_fkey" FOREIGN KEY ("formId") REFERENCES "AppForm" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "AppQuestion_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user" ("id") ON DELETE CASCADE ON UPDATE CASCADE
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
    "severity" TEXT,
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
    "q10" INTEGER,
    CONSTRAINT "PhqQuestion_formId_fkey" FOREIGN KEY ("formId") REFERENCES "PhqForm" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "PhqQuestion_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "PclForm" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "userId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'IN_PROGRESS',
    "totalScore" INTEGER,
    "severity" TEXT,
    "submittedAt" DATETIME,
    CONSTRAINT "PclForm_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "PclQuestion" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "formId" INTEGER NOT NULL,
    "userId" TEXT NOT NULL,
    "worstEvent" TEXT,
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
CREATE TABLE "session_note" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "clientId" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "attendanceStatus" TEXT DEFAULT 'show',
    "sessionName" TEXT NOT NULL,
    "sessionNumber" INTEGER NOT NULL,
    "appointmentId" TEXT,
    "kind" TEXT NOT NULL DEFAULT 'PROGRESS',
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "signatureData" TEXT,
    "clinicianSignedAt" DATETIME,
    "clinicianSignedById" TEXT,
    "clinicianSignatureData" TEXT,
    "adminSignedAt" DATETIME,
    "adminSignedById" TEXT,
    "adminSignatureData" TEXT,
    "adminApprovalNote" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "session_note_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "client" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "session_note_appointmentId_fkey" FOREIGN KEY ("appointmentId") REFERENCES "Appointment" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "session_note_clinicianSignedById_fkey" FOREIGN KEY ("clinicianSignedById") REFERENCES "user" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "session_note_adminSignedById_fkey" FOREIGN KEY ("adminSignedById") REFERENCES "user" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "session_note_edit" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "sessionNoteId" TEXT NOT NULL,
    "originalContent" TEXT,
    "editedContent" TEXT,
    "oldAttendanceStatus" TEXT,
    "newAttendanceStatus" TEXT,
    "reason" TEXT,
    "signature" TEXT,
    "editedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "session_note_edit_sessionNoteId_fkey" FOREIGN KEY ("sessionNoteId") REFERENCES "session_note" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "notification" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "sessionNoteId" TEXT,
    "readAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "notification_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "notification_sessionNoteId_fkey" FOREIGN KEY ("sessionNoteId") REFERENCES "session_note" ("id") ON DELETE CASCADE ON UPDATE CASCADE
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
    "startDate" DATETIME,
    "endDate" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "decidedAt" DATETIME,
    "decidedByUserId" TEXT,
    "approvalReason" TEXT,
    "rejectionReason" TEXT,
    "approvedSummaryText" TEXT,
    CONSTRAINT "session_notes_request_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "client" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "session_notes_request_declarationTemplateId_fkey" FOREIGN KEY ("declarationTemplateId") REFERENCES "declaration_template" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "session_notes_request_decidedByUserId_fkey" FOREIGN KEY ("decidedByUserId") REFERENCES "user" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "user" (
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

-- CreateTable
CREATE TABLE "session" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "expiresAt" DATETIME NOT NULL,
    "token" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "userId" TEXT NOT NULL,
    CONSTRAINT "session_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "account" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "accountId" TEXT NOT NULL,
    "providerId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "accessToken" TEXT,
    "refreshToken" TEXT,
    "idToken" TEXT,
    "accessTokenExpiresAt" DATETIME,
    "refreshTokenExpiresAt" DATETIME,
    "scope" TEXT,
    "password" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "account_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "verification" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "identifier" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "expiresAt" DATETIME NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateIndex
CREATE INDEX "Appointment_clientId_idx" ON "Appointment"("clientId");

-- CreateIndex
CREATE INDEX "Appointment_adminId_idx" ON "Appointment"("adminId");

-- CreateIndex
CREATE UNIQUE INDEX "Appointment_clientId_sessionNumber_key" ON "Appointment"("clientId", "sessionNumber");

-- CreateIndex
CREATE UNIQUE INDEX "client_userId_key" ON "client"("userId");

-- CreateIndex
CREATE INDEX "client_status_idx" ON "client"("status");

-- CreateIndex
CREATE INDEX "client_clinicianUserId_idx" ON "client"("clinicianUserId");

-- CreateIndex
CREATE UNIQUE INDEX "client_permission_clientId_key" ON "client_permission"("clientId");

-- CreateIndex
CREATE UNIQUE INDEX "client_plan_clientId_key" ON "client_plan"("clientId");

-- CreateIndex
CREATE INDEX "change_audit_entityType_entityId_idx" ON "change_audit"("entityType", "entityId");

-- CreateIndex
CREATE INDEX "client_form_score_history_userId_recordedAt_idx" ON "client_form_score_history"("userId", "recordedAt");

-- CreateIndex
CREATE INDEX "AceForm_userId_idx" ON "AceForm"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "AceQuestion_formId_key" ON "AceQuestion"("formId");

-- CreateIndex
CREATE INDEX "AceQuestion_userId_idx" ON "AceQuestion"("userId");

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
CREATE UNIQUE INDEX "PhysicianStatementForm_userId_key" ON "PhysicianStatementForm"("userId");

-- CreateIndex
CREATE INDEX "PhysicianStatementForm_status_idx" ON "PhysicianStatementForm"("status");

-- CreateIndex
CREATE UNIQUE INDEX "ReleaseOfInformationAuthorizationForm_userId_key" ON "ReleaseOfInformationAuthorizationForm"("userId");

-- CreateIndex
CREATE INDEX "ReleaseOfInformationAuthorizationForm_status_idx" ON "ReleaseOfInformationAuthorizationForm"("status");

-- CreateIndex
CREATE INDEX "session_note_clientId_idx" ON "session_note"("clientId");

-- CreateIndex
CREATE INDEX "session_note_appointmentId_idx" ON "session_note"("appointmentId");

-- CreateIndex
CREATE INDEX "session_note_status_idx" ON "session_note"("status");

-- CreateIndex
CREATE INDEX "session_note_kind_idx" ON "session_note"("kind");

-- CreateIndex
CREATE INDEX "session_note_edit_sessionNoteId_idx" ON "session_note_edit"("sessionNoteId");

-- CreateIndex
CREATE INDEX "notification_userId_readAt_idx" ON "notification"("userId", "readAt");

-- CreateIndex
CREATE INDEX "notification_userId_createdAt_idx" ON "notification"("userId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "declaration_template_requestKind_version_key" ON "declaration_template"("requestKind", "version");

-- CreateIndex
CREATE INDEX "session_notes_request_clientId_idx" ON "session_notes_request"("clientId");

-- CreateIndex
CREATE INDEX "session_notes_request_status_idx" ON "session_notes_request"("status");

-- CreateIndex
CREATE INDEX "session_notes_request_declarationTemplateId_idx" ON "session_notes_request"("declarationTemplateId");

-- CreateIndex
CREATE UNIQUE INDEX "user_email_key" ON "user"("email");

-- CreateIndex
CREATE INDEX "session_userId_idx" ON "session"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "session_token_key" ON "session"("token");

-- CreateIndex
CREATE INDEX "account_userId_idx" ON "account"("userId");

-- CreateIndex
CREATE INDEX "verification_identifier_idx" ON "verification"("identifier");
