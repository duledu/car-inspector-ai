// =============================================================================
// Credit Wallet Service
// Source of truth for user inspection credit balances.
//
// Architecture:
//   - CreditWallet    : live balance + lifetime counters per user
//   - CreditTransaction : immutable ledger row for every balance mutation
//
// Safety guarantees:
//   - ALL mutations run inside a Prisma interactive transaction, and lock the
//     wallet row (SELECT ... FOR UPDATE) before computing a new balance —
//     concurrent grant/spend/refund calls for the same wallet serialize
//     instead of racing on a stale read (see lockWalletForUpdate)
//   - spendCredit forbids spending into or further past a negative balance
//     (throws INSUFFICIENT_CREDITS / NEGATIVE_BALANCE_DEBT)
//   - refundCredits does NOT clamp at 0 — a refund that exceeds the current
//     balance pushes it negative (debt), rather than silently absorbing the
//     shortfall. Previously-granted access is never auto-revoked; the debt
//     instead blocks further spending until a new purchase repays it.
//   - Every transaction carries an idempotencyKey (@unique) — duplicate calls
//     return the existing result without mutating the balance
//   - Duplicate purchaseTokens can never grant credits twice
//   - The ledger is append-only; rows are never updated or deleted
// =============================================================================

import { Prisma } from '@prisma/client'
import type { CreditProvider, CreditTransactionType } from '@prisma/client'
import { prisma } from '@/config/prisma'

// ─── Error types ─────────────────────────────────────────────────────────────

export class WalletError extends Error {
  constructor(
    message: string,
    public readonly code:
      | 'INSUFFICIENT_CREDITS'
      | 'DUPLICATE_TRANSACTION'
      | 'DUPLICATE_PURCHASE_TOKEN'
      | 'INVALID_AMOUNT'
      | 'WALLET_NOT_FOUND'
      | 'NEGATIVE_BALANCE_DEBT',
  ) {
    super(message)
    this.name = 'WalletError'
  }
}

// ─── Types ───────────────────────────────────────────────────────────────────

export interface WalletSnapshot {
  id: string
  userId: string
  balance: number
  lifetimePurchased: number
  lifetimeSpent: number
}

export interface GrantCreditsInput {
  userId: string
  amount: number
  provider: CreditProvider
  type: CreditTransactionType
  idempotencyKey: string
  productId?: string
  purchaseToken?: string
  orderId?: string
  metadata?: Record<string, unknown>
}

export interface SpendCreditInput {
  userId: string
  idempotencyKey: string
  /** Credits to deduct. Defaults to 1 for backward compatibility. */
  amount?: number
  productId?: string
  metadata?: Record<string, unknown>
}

export interface RefundCreditsInput {
  userId: string
  amount: number
  idempotencyKey: string
  purchaseToken?: string
  metadata?: Record<string, unknown>
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function isUniqueConstraintError(err: unknown): boolean {
  // Primary: real Prisma error class
  if (err instanceof Prisma.PrismaClientKnownRequestError) {
    return err.code === 'P2002'
  }
  // Fallback: duck-type for wrapped or mocked errors (test environments)
  const e = err as { code?: string }
  return typeof e?.code === 'string' && e.code === 'P2002'
}

interface WalletRow {
  id: string
  userId: string
  balance: number
  lifetimePurchased: number
  lifetimeSpent: number
}

/**
 * Reads AND locks a wallet row for the remainder of the current transaction
 * via SELECT ... FOR UPDATE. Any concurrent grant/spend/refund for the same
 * wallet blocks here until this transaction commits, then reads the
 * up-to-date balance — this is what prevents the lost-update race that a
 * plain findUnique()-then-update() would allow under concurrent requests.
 *
 * Caller is responsible for ensuring the row exists first (via upsert) when
 * that's expected — this returns null if no row is found.
 */
async function lockWalletForUpdate(tx: Prisma.TransactionClient, userId: string): Promise<WalletRow | null> {
  const rows = await tx.$queryRaw<WalletRow[]>`
    SELECT id, "userId", balance, "lifetimePurchased", "lifetimeSpent"
    FROM credit_wallets WHERE "userId" = ${userId} FOR UPDATE
  `
  return rows[0] ?? null
}

// ─── Service functions ───────────────────────────────────────────────────────

/**
 * Returns the wallet for a user, creating one atomically if it does not exist.
 */
export async function getOrCreateWallet(userId: string): Promise<WalletSnapshot> {
  const wallet = await prisma.creditWallet.upsert({
    where: { userId },
    update: {},
    create: { userId, balance: 0, lifetimePurchased: 0, lifetimeSpent: 0 },
    select: { id: true, userId: true, balance: true, lifetimePurchased: true, lifetimeSpent: true },
  })
  return wallet
}

/**
 * Returns the current credit balance for a user.
 * Returns 0 if the user has no wallet yet.
 */
export async function getCreditBalance(userId: string): Promise<number> {
  const wallet = await prisma.creditWallet.findUnique({
    where: { userId },
    select: { balance: true },
  })
  return wallet?.balance ?? 0
}

/**
 * Grants credits to a user's wallet and records a ledger entry.
 *
 * Idempotent: if idempotencyKey already exists, returns the current wallet
 * without modifying the balance.
 *
 * purchaseToken uniqueness: if a purchaseToken is supplied and it already
 * appears in the ledger, throws DUPLICATE_PURCHASE_TOKEN to prevent double-grants.
 */
export async function grantCredits(input: GrantCreditsInput): Promise<WalletSnapshot> {
  const { userId, amount, provider, type, idempotencyKey, productId, purchaseToken, orderId, metadata } = input

  if (amount <= 0) {
    throw new WalletError('Grant amount must be positive', 'INVALID_AMOUNT')
  }

  // Check for duplicate purchaseToken before entering the transaction
  if (purchaseToken) {
    const existing = await prisma.creditTransaction.findFirst({
      where: { purchaseToken },
      select: { id: true },
    })
    if (existing) {
      throw new WalletError(
        `Purchase token has already been used to grant credits: ${purchaseToken}`,
        'DUPLICATE_PURCHASE_TOKEN',
      )
    }
  }

  try {
    return await prisma.$transaction(async (tx) => {
      // Guarantee the row exists — safe under concurrency (Postgres upsert
      // compiles to INSERT ... ON CONFLICT DO UPDATE).
      await tx.creditWallet.upsert({
        where: { userId },
        update: {},
        create: { userId, balance: 0, lifetimePurchased: 0, lifetimeSpent: 0 },
      })

      // Lock the row before reading the balance we'll compute against.
      const wallet = await lockWalletForUpdate(tx, userId)
      if (!wallet) {
        throw new WalletError('Wallet not found immediately after upsert', 'WALLET_NOT_FOUND')
      }

      const newBalance = wallet.balance + amount

      const [updatedWallet] = await Promise.all([
        tx.creditWallet.update({
          where: { id: wallet.id },
          data: {
            balance: newBalance,
            lifetimePurchased: { increment: amount },
          },
          select: { id: true, userId: true, balance: true, lifetimePurchased: true, lifetimeSpent: true },
        }),
        tx.creditTransaction.create({
          data: {
            userId,
            walletId: wallet.id,
            type,
            provider,
            amount,
            balanceBefore: wallet.balance,
            balanceAfter: newBalance,
            productId: productId ?? null,
            purchaseToken: purchaseToken ?? null,
            orderId: orderId ?? null,
            idempotencyKey,
            metadata: metadata ? (metadata as Prisma.InputJsonValue) : undefined,
          },
        }),
      ])

      return updatedWallet
    })
  } catch (err) {
    if (isUniqueConstraintError(err)) {
      // idempotencyKey collision — return current wallet without mutation
      return getOrCreateWallet(userId)
    }
    throw err
  }
}

/**
 * Spends `amount` credits (default 1) from a user's wallet and records a
 * ledger entry.
 *
 * Idempotent: if idempotencyKey already exists, returns the current wallet.
 * Throws INSUFFICIENT_CREDITS if balance < amount.
 */
export async function spendCredit(input: SpendCreditInput): Promise<WalletSnapshot> {
  const { userId, idempotencyKey, productId, metadata } = input
  const amount = input.amount ?? 1

  if (amount <= 0) {
    throw new WalletError('Spend amount must be positive', 'INVALID_AMOUNT')
  }

  try {
    return await prisma.$transaction(async (tx) => {
      const wallet = await lockWalletForUpdate(tx, userId)

      if (!wallet) {
        throw new WalletError('Wallet not found — user has no credits', 'WALLET_NOT_FOUND')
      }

      // A negative balance means a prior refund exceeded what was available
      // to claw back (some/all of it was already spent). Access already
      // granted from that spend is never auto-revoked, but no further
      // spending is allowed until a new purchase repays the debt.
      if (wallet.balance < 0) {
        throw new WalletError(
          `Wallet balance is negative (${wallet.balance}) due to a prior refund adjustment. Purchase credits to clear the balance before spending.`,
          'NEGATIVE_BALANCE_DEBT',
        )
      }

      if (wallet.balance < amount) {
        throw new WalletError(
          `Insufficient credits: balance is ${wallet.balance}, need ${amount}`,
          'INSUFFICIENT_CREDITS',
        )
      }

      const newBalance = wallet.balance - amount

      const [updatedWallet] = await Promise.all([
        tx.creditWallet.update({
          where: { id: wallet.id },
          data: {
            balance: newBalance,
            lifetimeSpent: { increment: amount },
          },
          select: { id: true, userId: true, balance: true, lifetimePurchased: true, lifetimeSpent: true },
        }),
        tx.creditTransaction.create({
          data: {
            userId,
            walletId: wallet.id,
            type: 'SPEND',
            provider: 'SYSTEM',
            amount,
            balanceBefore: wallet.balance,
            balanceAfter: newBalance,
            productId: productId ?? null,
            idempotencyKey,
            metadata: metadata ? (metadata as Prisma.InputJsonValue) : undefined,
          },
        }),
      ])

      return updatedWallet
    })
  } catch (err) {
    // Re-throw WalletErrors (INSUFFICIENT_CREDITS, WALLET_NOT_FOUND) as-is
    if (err instanceof WalletError) throw err

    if (isUniqueConstraintError(err)) {
      // idempotencyKey already used — return current wallet
      return getOrCreateWallet(userId)
    }
    throw err
  }
}

/**
 * Refunds credits to a user's wallet (e.g. after a Google Play refund event).
 * Records a REFUND ledger entry.
 *
 * Debt model: if the refunded amount exceeds what's currently available
 * (because some/all of it was already spent), the balance goes negative
 * instead of clamping to 0. Previously-granted access from that spend is
 * never automatically revoked — the negative balance instead blocks all
 * further spending (see spendCredit's NEGATIVE_BALANCE_DEBT check) until a
 * new purchase repays the debt.
 *
 * Idempotent: if idempotencyKey already exists, returns current wallet.
 */
export async function refundCredits(input: RefundCreditsInput): Promise<WalletSnapshot> {
  const { userId, amount, idempotencyKey, purchaseToken, metadata } = input

  if (amount <= 0) {
    throw new WalletError('Refund amount must be positive', 'INVALID_AMOUNT')
  }

  try {
    return await prisma.$transaction(async (tx) => {
      await tx.creditWallet.upsert({
        where: { userId },
        update: {},
        create: { userId, balance: 0, lifetimePurchased: 0, lifetimeSpent: 0 },
      })

      const wallet = await lockWalletForUpdate(tx, userId)
      if (!wallet) {
        throw new WalletError('Wallet not found immediately after upsert', 'WALLET_NOT_FOUND')
      }

      const newBalance = wallet.balance - amount

      const [updatedWallet] = await Promise.all([
        tx.creditWallet.update({
          where: { id: wallet.id },
          data: { balance: newBalance },
          select: { id: true, userId: true, balance: true, lifetimePurchased: true, lifetimeSpent: true },
        }),
        tx.creditTransaction.create({
          data: {
            userId,
            walletId: wallet.id,
            type: 'REFUND',
            provider: 'GOOGLE_PLAY',
            amount: -amount,
            balanceBefore: wallet.balance,
            balanceAfter: newBalance,
            purchaseToken: purchaseToken ?? null,
            idempotencyKey,
            metadata: metadata ? (metadata as Prisma.InputJsonValue) : undefined,
          },
        }),
      ])

      return updatedWallet
    })
  } catch (err) {
    if (err instanceof WalletError) throw err
    if (isUniqueConstraintError(err)) {
      return getOrCreateWallet(userId)
    }
    throw err
  }
}

export interface RecordExternalPurchaseInput {
  userId: string
  idempotencyKey: string
  provider: CreditProvider
  productId?: string
  metadata?: Record<string, unknown>
}

/**
 * Records a purchase made through a non-wallet-native payment rail (e.g.
 * Stripe on the web) as an immutable, zero-balance-impact ledger entry.
 *
 * This keeps CreditTransaction as the single cross-platform purchase
 * history for a user — "what did they ever buy, on which platform" — without
 * merging that purchase into the spendable Android credit balance. Stripe
 * purchases keep granting access directly (see grantPremiumAccess); this
 * call only adds an audit row alongside that, it never mutates
 * CreditWallet.balance or lifetimePurchased.
 *
 * Idempotent: if idempotencyKey already exists, this is a silent no-op.
 */
export async function recordExternalPurchaseAudit(input: RecordExternalPurchaseInput): Promise<void> {
  const { userId, idempotencyKey, provider, productId, metadata } = input

  try {
    const wallet = await getOrCreateWallet(userId)
    await prisma.creditTransaction.create({
      data: {
        userId,
        walletId: wallet.id,
        type: 'PURCHASE',
        provider,
        amount: 0,
        balanceBefore: wallet.balance,
        balanceAfter: wallet.balance,
        productId: productId ?? null,
        idempotencyKey,
        metadata: metadata ? (metadata as Prisma.InputJsonValue) : undefined,
      },
    })
  } catch (err) {
    if (isUniqueConstraintError(err)) return // already recorded — no-op
    throw err
  }
}

/**
 * Throws INSUFFICIENT_CREDITS if the user cannot afford `amount` credits.
 * Call this before any operation that consumes credits, as a fast pre-check.
 */
export async function assertSufficientCredits(userId: string, amount = 1): Promise<void> {
  const balance = await getCreditBalance(userId)
  if (balance < amount) {
    throw new WalletError(
      `Insufficient credits: balance is ${balance}, need ${amount}`,
      'INSUFFICIENT_CREDITS',
    )
  }
}
