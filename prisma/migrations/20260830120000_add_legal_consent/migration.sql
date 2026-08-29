-- =============================================================================
-- Migration: add_legal_consent
-- Adds immutable, versioned legal-document and consent-acceptance evidence.
-- This is a purely additive migration — no existing tables, columns, or rows
-- are altered or removed.
--
-- NOT applied to any database by this change. Hand-authored to match this
-- schema's existing migration conventions; run `prisma migrate dev` (against
-- a confirmed non-production database) to apply it, then commit the result.
-- =============================================================================

-- CreateEnum
CREATE TYPE "LegalDocumentType" AS ENUM ('TERMS', 'PRIVACY', 'RISK_ACKNOWLEDGEMENT');

-- CreateEnum
CREATE TYPE "ConsentPlatform" AS ENUM ('WEB', 'ANDROID');

-- CreateTable: legal_document_versions
CREATE TABLE "legal_document_versions" (
    "id" TEXT NOT NULL,
    "documentType" "LegalDocumentType" NOT NULL,
    "version" TEXT NOT NULL,
    "effectiveDate" TIMESTAMP(3) NOT NULL,
    "contentHash" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "legal_document_versions_pkey" PRIMARY KEY ("id")
);

-- CreateTable: consent_records (immutable acceptance evidence)
-- userId is nullable and ON DELETE SET NULL (not CASCADE): contract-formation
-- evidence is retained past account deletion for legal-claims/defense purposes
-- (GDPR Art. 17(3)(b)/(e)), mirroring how payment/transaction records already
-- survive account deletion in this app. userIdSnapshot is a plain, non-FK
-- column that preserves which account accepted which version even after
-- userId is nulled.
CREATE TABLE "consent_records" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "userIdSnapshot" TEXT NOT NULL,
    "termsVersion" TEXT NOT NULL,
    "privacyVersion" TEXT NOT NULL,
    "riskAckVersion" TEXT NOT NULL,
    "locale" TEXT NOT NULL,
    "platform" "ConsentPlatform" NOT NULL,
    "formVersion" TEXT NOT NULL,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "acceptedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "consent_records_pkey" PRIMARY KEY ("id")
);

-- CreateIndex: legal_document_versions
CREATE UNIQUE INDEX "legal_document_versions_documentType_version_key" ON "legal_document_versions"("documentType", "version");
CREATE INDEX "legal_document_versions_documentType_idx" ON "legal_document_versions"("documentType");

-- CreateIndex: consent_records
CREATE INDEX "consent_records_userId_idx" ON "consent_records"("userId");
CREATE INDEX "consent_records_userIdSnapshot_idx" ON "consent_records"("userIdSnapshot");

-- AddForeignKey
ALTER TABLE "consent_records" ADD CONSTRAINT "consent_records_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
