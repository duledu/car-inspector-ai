-- CreateEnum
CREATE TYPE "InspectionAccessStatus" AS ENUM ('DRAFT', 'ACTIVE', 'LOCKED');

-- AlterEnum (add INSPECTION_REPORT to PremiumProduct)
ALTER TYPE "PremiumProduct" ADD VALUE 'INSPECTION_REPORT';

-- CreateTable
CREATE TABLE "inspection_accesses" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "vehicleId" TEXT NOT NULL,
    "status" "InspectionAccessStatus" NOT NULL DEFAULT 'DRAFT',
    "grantedVia" TEXT,
    "promoCode" TEXT,
    "purchaseId" TEXT,
    "lockedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "inspection_accesses_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "inspection_accesses_userId_vehicleId_key" ON "inspection_accesses"("userId", "vehicleId");

-- CreateIndex
CREATE INDEX "inspection_accesses_userId_idx" ON "inspection_accesses"("userId");

-- CreateIndex
CREATE INDEX "inspection_accesses_vehicleId_idx" ON "inspection_accesses"("vehicleId");

-- AddForeignKey
ALTER TABLE "inspection_accesses" ADD CONSTRAINT "inspection_accesses_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inspection_accesses" ADD CONSTRAINT "inspection_accesses_vehicleId_fkey" FOREIGN KEY ("vehicleId") REFERENCES "vehicles"("id") ON DELETE CASCADE ON UPDATE CASCADE;
