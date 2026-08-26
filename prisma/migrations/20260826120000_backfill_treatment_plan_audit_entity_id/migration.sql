-- Backfill: standardize ChangeAudit.entityId for TREATMENT_PLAN rows onto the
-- client's User id (#90).
--
-- Historically plan.put.ts stored the Client PK (client.id) in entityId while
-- absences.patch.ts stored the client's User id. GET /api/audits filters purely on
-- entityId, so a single id could not retrieve both audit types for a client. New
-- writes now store the User id; this aligns existing TREATMENT_PLAN rows.
--
-- The `entityId IN (SELECT id FROM client)` guard scopes the update to rows that
-- still hold a Client PK, so re-running is a no-op for already-migrated rows.
UPDATE "change_audit"
SET "entityId" = (
  SELECT "c"."userId"
  FROM "client" AS "c"
  WHERE "c"."id" = "change_audit"."entityId"
)
WHERE "entityType" = 'TREATMENT_PLAN'
  AND "entityId" IN (SELECT "id" FROM "client");
