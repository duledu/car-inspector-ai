-- Add immutable per-generation inspection reports.
CREATE TABLE "inspection_reports" (
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

CREATE INDEX "inspection_reports_userId_idx" ON "inspection_reports"("userId");
CREATE INDEX "inspection_reports_vehicleId_idx" ON "inspection_reports"("vehicleId");
CREATE INDEX "inspection_reports_userId_vehicleId_status_idx" ON "inspection_reports"("userId", "vehicleId", "status");

-- One open report credit/session per user + vehicle prevents double consumption.
CREATE UNIQUE INDEX "inspection_reports_one_active_per_vehicle"
ON "inspection_reports"("userId", "vehicleId")
WHERE "status" = 'ACTIVE';

ALTER TABLE "inspection_reports"
ADD CONSTRAINT "inspection_reports_userId_fkey"
FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "inspection_reports"
ADD CONSTRAINT "inspection_reports_vehicleId_fkey"
FOREIGN KEY ("vehicleId") REFERENCES "vehicles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "risk_scores" ADD COLUMN "inspectionReportId" TEXT;
DROP INDEX IF EXISTS "risk_scores_sessionId_key";
CREATE INDEX "risk_scores_sessionId_idx" ON "risk_scores"("sessionId");
CREATE UNIQUE INDEX "risk_scores_inspectionReportId_key" ON "risk_scores"("inspectionReportId");

ALTER TABLE "risk_scores"
ADD CONSTRAINT "risk_scores_inspectionReportId_fkey"
FOREIGN KEY ("inspectionReportId") REFERENCES "inspection_reports"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Preserve existing access rows as the first report/session row for each vehicle.
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
