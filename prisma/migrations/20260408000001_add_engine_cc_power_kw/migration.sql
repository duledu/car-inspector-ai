-- AlterTable: add engine displacement and power columns to vehicles
ALTER TABLE "vehicles" ADD COLUMN "engineCc" INTEGER;
ALTER TABLE "vehicles" ADD COLUMN "powerKw" INTEGER;
