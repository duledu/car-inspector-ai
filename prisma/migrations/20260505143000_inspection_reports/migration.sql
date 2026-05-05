-- Add immutable per-generation inspection reports.
-- This migration is written to be idempotent so it is safe to re-run when a
-- previous attempt failed partway through.

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_type WHERE typname = 'InspectionAccessStatus'
  ) THEN
    CREATE TYPE "InspectionAccessStatus" AS ENUM ('DRAFT', 'ACTIVE', 'LOCKED');
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_type WHERE typname = 'PremiumProduct'
  ) AND NOT EXISTS (
    SELECT 1
    FROM pg_enum e
    INNER JOIN pg_type t ON t.oid = e.enumtypid
    WHERE t.typname = 'PremiumProduct'
      AND e.enumlabel = 'INSPECTION_REPORT'
  ) THEN
    ALTER TYPE "PremiumProduct" ADD VALUE 'INSPECTION_REPORT';
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS "inspection_reports" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "vehicleId" TEXT NOT NULL,
    "status" "InspectionAccessStatus" NOT NULL DEFAULT 'DRAFT',
    "grantedVia" TEXT,
    "promoCode" TEXT,
    "purchaseId" TEXT,
    "startedAt" TIMESTAMP(3),
    "lockedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "inspection_reports_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "inspection_reports_userId_idx" ON "inspection_reports"("userId");
CREATE INDEX IF NOT EXISTS "inspection_reports_vehicleId_idx" ON "inspection_reports"("vehicleId");
CREATE INDEX IF NOT EXISTS "inspection_reports_userId_vehicleId_status_idx" ON "inspection_reports"("userId", "vehicleId", "status");

-- Partial unique index: at most one ACTIVE credit per user + vehicle.
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes WHERE indexname = 'inspection_reports_one_active_per_vehicle'
  ) THEN
    EXECUTE 'CREATE UNIQUE INDEX inspection_reports_one_active_per_vehicle
             ON inspection_reports("userId", "vehicleId")
             WHERE status = ''ACTIVE''';
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'inspection_reports_userId_fkey'
  ) THEN
    ALTER TABLE "inspection_reports"
    ADD CONSTRAINT "inspection_reports_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'inspection_reports_vehicleId_fkey'
  ) THEN
    ALTER TABLE "inspection_reports"
    ADD CONSTRAINT "inspection_reports_vehicleId_fkey"
    FOREIGN KEY ("vehicleId") REFERENCES "vehicles"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

-- Add inspectionReportId to risk_scores only if the column does not exist yet.
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'risk_scores' AND column_name = 'inspectionReportId'
  ) THEN
    ALTER TABLE "risk_scores" ADD COLUMN "inspectionReportId" TEXT;
  END IF;
END $$;

DROP INDEX IF EXISTS "risk_scores_sessionId_key";
CREATE INDEX IF NOT EXISTS "risk_scores_sessionId_idx" ON "risk_scores"("sessionId");

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes WHERE indexname = 'risk_scores_inspectionReportId_key'
  ) THEN
    CREATE UNIQUE INDEX "risk_scores_inspectionReportId_key" ON "risk_scores"("inspectionReportId");
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'risk_scores_inspectionReportId_fkey'
  ) THEN
    ALTER TABLE "risk_scores"
    ADD CONSTRAINT "risk_scores_inspectionReportId_fkey"
    FOREIGN KEY ("inspectionReportId") REFERENCES "inspection_reports"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

-- Migrate existing access rows from inspection_accesses (if that table still exists).
-- This covers deployments that ran the previous architecture before the rename.
DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'inspection_accesses'
  ) THEN
    INSERT INTO "inspection_reports" (
        "id",
        "userId",
        "vehicleId",
        "status",
        "grantedVia",
        "promoCode",
        "purchaseId",
        "lockedAt",
        "createdAt",
        "updatedAt"
    )
    SELECT
        "id",
        "userId",
        "vehicleId",
        "status",
        "grantedVia",
        "promoCode",
        "purchaseId",
        "lockedAt",
        "createdAt",
        "updatedAt"
    FROM "inspection_accesses"
    ON CONFLICT ("id") DO NOTHING;
  END IF;
END $$;

-- Attach the latest existing score to migrated locked reports so historical
-- reports remain viewable even if the checklist is edited later.
UPDATE "risk_scores" AS rs
SET "inspectionReportId" = latest."reportId"
FROM (
    SELECT DISTINCT ON (score."vehicleId")
        score."id" AS "scoreId",
        report."id" AS "reportId"
    FROM "risk_scores" AS score
    INNER JOIN "inspection_reports" AS report
        ON report."vehicleId" = score."vehicleId"
       AND report."status" = 'LOCKED'
    WHERE score."inspectionReportId" IS NULL
    ORDER BY score."vehicleId", score."createdAt" DESC
) AS latest
WHERE rs."id" = latest."scoreId";
