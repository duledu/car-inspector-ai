-- Backfill: upgrade legacy DRAFT InspectionReport rows to ACTIVE.
--
-- Context: the vehicle creation route originally inserted an InspectionReport
-- row with the schema default (DRAFT) regardless of whether the access gate
-- was enabled. This means every vehicle created before the access gate was
-- intentionally turned on has a DRAFT record that would block report generation
-- once FEATURE_INSPECTION_ACCESS_GATE=true is set.
--
-- Safe to run multiple times (idempotent WHERE clause).
-- Only touches rows where:
--   - status = 'DRAFT'  (not already ACTIVE or LOCKED)
--   - grantedVia IS NULL  (auto-created by vehicle route, not from promo/payment)
--
-- After this migration:
--   - All pre-gate vehicles are ACTIVE  → can generate reports immediately
--   - Gate-controlled vehicles (grantedVia IS NOT NULL) are untouched
--   - LOCKED vehicles are untouched (report already generated)

UPDATE "inspection_reports"
SET
  "status"     = 'ACTIVE',
  "grantedVia" = 'legacy',
  "updatedAt"  = NOW()
WHERE "status"     = 'DRAFT'
  AND "grantedVia" IS NULL;
