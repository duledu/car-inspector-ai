-- =============================================================================
-- Migration: add_credit_wallet_and_google_play_billing
-- Adds the credit wallet system and Google Play billing infrastructure.
-- This is a purely additive migration — no existing tables are altered.
-- =============================================================================

-- CreateEnum
CREATE TYPE "CreditTransactionType" AS ENUM ('PURCHASE', 'SPEND', 'REFUND', 'ADMIN_GRANT', 'PROMO_GRANT', 'ADJUSTMENT');

-- CreateEnum
CREATE TYPE "CreditProvider" AS ENUM ('GOOGLE_PLAY', 'PROMO', 'ADMIN', 'SYSTEM', 'LEGACY');

-- CreateEnum
CREATE TYPE "GooglePlayPurchaseStatus" AS ENUM ('RECEIVED', 'VERIFIED', 'GRANTED', 'CONSUMED', 'FAILED', 'REFUNDED', 'REVOKED');

-- CreateTable: credit_wallets
CREATE TABLE "credit_wallets" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "balance" INTEGER NOT NULL DEFAULT 0,
    "lifetimePurchased" INTEGER NOT NULL DEFAULT 0,
    "lifetimeSpent" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "credit_wallets_pkey" PRIMARY KEY ("id")
);

-- CreateTable: credit_transactions (immutable ledger)
CREATE TABLE "credit_transactions" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "walletId" TEXT NOT NULL,
    "type" "CreditTransactionType" NOT NULL,
    "provider" "CreditProvider" NOT NULL,
    "amount" INTEGER NOT NULL,
    "balanceBefore" INTEGER NOT NULL,
    "balanceAfter" INTEGER NOT NULL,
    "productId" TEXT,
    "purchaseToken" TEXT,
    "orderId" TEXT,
    "idempotencyKey" TEXT NOT NULL,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "credit_transactions_pkey" PRIMARY KEY ("id")
);

-- CreateTable: google_play_purchases
CREATE TABLE "google_play_purchases" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "purchaseToken" TEXT NOT NULL,
    "orderId" TEXT,
    "purchaseState" TEXT,
    "acknowledgementState" TEXT,
    "consumptionState" TEXT,
    "creditsGranted" INTEGER NOT NULL,
    "status" "GooglePlayPurchaseStatus" NOT NULL,
    "rawPayload" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "google_play_purchases_pkey" PRIMARY KEY ("id")
);

-- CreateIndex: credit_wallets
CREATE UNIQUE INDEX "credit_wallets_userId_key" ON "credit_wallets"("userId");
CREATE INDEX "credit_wallets_userId_idx" ON "credit_wallets"("userId");

-- CreateIndex: credit_transactions
CREATE UNIQUE INDEX "credit_transactions_idempotencyKey_key" ON "credit_transactions"("idempotencyKey");
CREATE INDEX "credit_transactions_userId_idx" ON "credit_transactions"("userId");
CREATE INDEX "credit_transactions_walletId_idx" ON "credit_transactions"("walletId");
CREATE INDEX "credit_transactions_purchaseToken_idx" ON "credit_transactions"("purchaseToken");
CREATE INDEX "credit_transactions_createdAt_idx" ON "credit_transactions"("createdAt");

-- CreateIndex: google_play_purchases
CREATE UNIQUE INDEX "google_play_purchases_purchaseToken_key" ON "google_play_purchases"("purchaseToken");
CREATE INDEX "google_play_purchases_userId_idx" ON "google_play_purchases"("userId");
CREATE INDEX "google_play_purchases_productId_idx" ON "google_play_purchases"("productId");
CREATE INDEX "google_play_purchases_status_idx" ON "google_play_purchases"("status");

-- AddForeignKey
ALTER TABLE "credit_wallets" ADD CONSTRAINT "credit_wallets_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "credit_transactions" ADD CONSTRAINT "credit_transactions_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "credit_transactions" ADD CONSTRAINT "credit_transactions_walletId_fkey" FOREIGN KEY ("walletId") REFERENCES "credit_wallets"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "google_play_purchases" ADD CONSTRAINT "google_play_purchases_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
