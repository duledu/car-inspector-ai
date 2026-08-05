-- =============================================================================
-- Migration: add_stripe_credit_provider
-- Adds STRIPE to the CreditProvider enum so Stripe purchases can be recorded
-- as audit-only rows in the shared credit_transactions ledger (zero wallet
-- balance impact — see recordExternalPurchaseAudit). Purely additive.
-- =============================================================================

ALTER TYPE "CreditProvider" ADD VALUE 'STRIPE';
