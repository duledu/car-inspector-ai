-- Add vehicle filter columns (fuelType, transmission, bodyType)
-- Used to improve market price accuracy in the pricing pipeline
ALTER TABLE "vehicles" ADD COLUMN "fuelType" TEXT;
ALTER TABLE "vehicles" ADD COLUMN "transmission" TEXT;
ALTER TABLE "vehicles" ADD COLUMN "bodyType" TEXT;
