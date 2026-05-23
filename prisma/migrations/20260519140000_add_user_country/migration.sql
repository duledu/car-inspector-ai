-- Add regional market fields to users table.
-- Both columns are nullable with no default — existing users receive null,
-- which the application treats as "RS" (Serbia) for backward compatibility.

ALTER TABLE "users" ADD COLUMN "countryCode" TEXT;
ALTER TABLE "users" ADD COLUMN "preferredCurrency" TEXT;
