// =============================================================================
// Credit Wallet Service — Unit Tests
// All Prisma calls are mocked; no database connection required.
//
// Concurrency note: these tests mock $transaction to run its callback
// synchronously against a single shared `mockTx`, so they verify the
// *logic* inside each function (balance math, idempotency, error codes) but
// cannot exercise real interleaved/concurrent transactions the way two
// simultaneous requests against a live Postgres database would. The
// SELECT ... FOR UPDATE locking added to lockWalletForUpdate is a standard,
// well-understood Postgres mechanism for preventing lost updates under
// concurrency; proving it holds under real concurrent load requires a test
// against an actual database (or staging), not this mocked suite.
// =============================================================================

import { getCreditsForGooglePlayProduct, isValidGooglePlayProduct, GOOGLE_PLAY_PRODUCTS } from '../../src/lib/payments/google-play-products'

// jest.mock is hoisted before any const declarations, so all mock state
// must live INSIDE the factory. Access it afterwards via jest.requireMock.
jest.mock('../../src/config/prisma', () => ({
  prisma: {
    creditWallet: {
      upsert: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn(),
    },
    creditTransaction: {
      findFirst: jest.fn(),
      create: jest.fn(),
    },
    $transaction: jest.fn(),
  },
  isMissingTableOrColumnError: jest.fn().mockReturnValue(false),
}))

// Pull the mocked module reference AFTER the mock is registered.
// eslint-disable-next-line @typescript-eslint/no-var-requires
const { prisma: mockPrisma } = jest.requireMock('../../src/config/prisma') as {
  prisma: {
    creditWallet: { upsert: jest.Mock; findUnique: jest.Mock; update: jest.Mock }
    creditTransaction: { findFirst: jest.Mock; create: jest.Mock }
    $transaction: jest.Mock
  }
}

// The tx object used inside $transaction callbacks mimics the interactive
// transaction client. We control it separately from the outer client mock.
// $queryRaw stands in for lockWalletForUpdate's `SELECT ... FOR UPDATE` —
// it's called as a tagged template, but that's just a regular function call
// under the hood, so mockResolvedValue works the same as any other mock.
const mockTx = {
  creditWallet: { upsert: jest.fn(), update: jest.fn() },
  creditTransaction: { create: jest.fn() },
  $queryRaw: jest.fn(),
}

// Import the module under test AFTER mocks are in place.
import {
  getOrCreateWallet,
  getCreditBalance,
  grantCredits,
  spendCredit,
  refundCredits,
  assertSufficientCredits,
  recordExternalPurchaseAudit,
  WalletError,
} from '../../src/lib/credits/credit-wallet'

// ─── Helpers ─────────────────────────────────────────────────────────────────

const baseWallet = {
  id: 'wallet-1',
  userId: 'user-1',
  balance: 0,
  lifetimePurchased: 0,
  lifetimeSpent: 0,
}

function walletWith(overrides: Partial<typeof baseWallet>) {
  return { ...baseWallet, ...overrides }
}

/** Sets up lockWalletForUpdate's raw query to resolve to this wallet row. */
function lockResolves(wallet: typeof baseWallet | null) {
  mockTx.$queryRaw.mockResolvedValue(wallet ? [wallet] : [])
}

beforeEach(() => {
  jest.clearAllMocks()
  // Default: $transaction executes the callback with the tx mock
  mockPrisma.$transaction.mockImplementation(
    async (fn: (tx: typeof mockTx) => Promise<unknown>) => fn(mockTx),
  )
})

// =============================================================================
// getOrCreateWallet
// =============================================================================

describe('getOrCreateWallet', () => {
  test('creates a wallet when none exists and returns snapshot', async () => {
    const expected = walletWith({ balance: 0 })
    mockPrisma.creditWallet.upsert.mockResolvedValue(expected)

    const result = await getOrCreateWallet('user-1')

    expect(mockPrisma.creditWallet.upsert).toHaveBeenCalledWith(
      expect.objectContaining({ where: { userId: 'user-1' } }),
    )
    expect(result.userId).toBe('user-1')
    expect(result.balance).toBe(0)
  })

  test('returns existing wallet when already present', async () => {
    const existing = walletWith({ balance: 3, lifetimePurchased: 5 })
    mockPrisma.creditWallet.upsert.mockResolvedValue(existing)

    const result = await getOrCreateWallet('user-1')

    expect(result.balance).toBe(3)
    expect(result.lifetimePurchased).toBe(5)
  })
})

// =============================================================================
// getCreditBalance
// =============================================================================

describe('getCreditBalance', () => {
  test('returns balance from existing wallet', async () => {
    mockPrisma.creditWallet.findUnique.mockResolvedValue({ balance: 4 })

    const balance = await getCreditBalance('user-1')

    expect(balance).toBe(4)
  })

  test('returns 0 when user has no wallet', async () => {
    mockPrisma.creditWallet.findUnique.mockResolvedValue(null)

    const balance = await getCreditBalance('user-1')

    expect(balance).toBe(0)
  })
})

// =============================================================================
// grantCredits
// =============================================================================

describe('grantCredits', () => {
  test('grants credits and returns updated wallet with new balance', async () => {
    const before = walletWith({ balance: 0 })
    const after  = walletWith({ balance: 2, lifetimePurchased: 2 })

    mockPrisma.creditTransaction.findFirst.mockResolvedValue(null) // no duplicate token
    lockResolves(before)
    mockTx.creditWallet.update.mockResolvedValue(after)
    mockTx.creditTransaction.create.mockResolvedValue({})

    const result = await grantCredits({
      userId: 'user-1',
      amount: 2,
      provider: 'ADMIN',
      type: 'ADMIN_GRANT',
      idempotencyKey: 'key-001',
    })

    expect(result.balance).toBe(2)
    expect(result.lifetimePurchased).toBe(2)
    expect(mockTx.creditTransaction.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          type: 'ADMIN_GRANT',
          provider: 'ADMIN',
          amount: 2,
          balanceBefore: 0,
          balanceAfter: 2,
          idempotencyKey: 'key-001',
        }),
      }),
    )
  })

  test('reduces a negative balance when granting credits (debt repayment)', async () => {
    const before = walletWith({ balance: -3, lifetimePurchased: 2 })
    const after  = walletWith({ balance: 2, lifetimePurchased: 7 })

    mockPrisma.creditTransaction.findFirst.mockResolvedValue(null)
    lockResolves(before)
    mockTx.creditWallet.update.mockResolvedValue(after)
    mockTx.creditTransaction.create.mockResolvedValue({})

    const result = await grantCredits({
      userId: 'user-1',
      amount: 5,
      provider: 'GOOGLE_PLAY',
      type: 'PURCHASE',
      idempotencyKey: 'key-debt-repay',
      purchaseToken: 'tok-new',
    })

    expect(result.balance).toBe(2)
    const updateCall = mockTx.creditWallet.update.mock.calls[0][0]
    expect(updateCall.data.balance).toBe(2) // -3 + 5
  })

  test('throws INVALID_AMOUNT for zero amount', async () => {
    await expect(
      grantCredits({
        userId: 'user-1',
        amount: 0,
        provider: 'ADMIN',
        type: 'ADMIN_GRANT',
        idempotencyKey: 'key-002',
      }),
    ).rejects.toMatchObject({ code: 'INVALID_AMOUNT' })
  })

  test('throws INVALID_AMOUNT for negative amount', async () => {
    await expect(
      grantCredits({
        userId: 'user-1',
        amount: -5,
        provider: 'ADMIN',
        type: 'ADMIN_GRANT',
        idempotencyKey: 'key-003',
      }),
    ).rejects.toMatchObject({ code: 'INVALID_AMOUNT' })
  })

  test('throws DUPLICATE_PURCHASE_TOKEN when same purchaseToken used twice', async () => {
    mockPrisma.creditTransaction.findFirst.mockResolvedValue({ id: 'existing-tx' })

    await expect(
      grantCredits({
        userId: 'user-1',
        amount: 1,
        provider: 'GOOGLE_PLAY',
        type: 'PURCHASE',
        idempotencyKey: 'key-new',
        purchaseToken: 'token-already-used',
      }),
    ).rejects.toMatchObject({ code: 'DUPLICATE_PURCHASE_TOKEN' })

    // Balance must NOT be modified
    expect(mockTx.creditWallet.update).not.toHaveBeenCalled()
    expect(mockPrisma.$transaction).not.toHaveBeenCalled()
  })

  test('does not throw for first use of a purchaseToken', async () => {
    mockPrisma.creditTransaction.findFirst.mockResolvedValue(null)
    const before = walletWith({ balance: 0 })
    const after  = walletWith({ balance: 1, lifetimePurchased: 1 })
    lockResolves(before)
    mockTx.creditWallet.update.mockResolvedValue(after)
    mockTx.creditTransaction.create.mockResolvedValue({})

    await expect(
      grantCredits({
        userId: 'user-1',
        amount: 1,
        provider: 'GOOGLE_PLAY',
        type: 'PURCHASE',
        idempotencyKey: 'key-first-use',
        purchaseToken: 'brand-new-token',
      }),
    ).resolves.toMatchObject({ balance: 1 })
  })

  test('is idempotent: returns current wallet on duplicate idempotencyKey (P2002)', async () => {
    mockPrisma.creditTransaction.findFirst.mockResolvedValue(null)

    // Duck-typed P2002 — matched by the service's fallback check
    mockPrisma.$transaction.mockRejectedValueOnce({ code: 'P2002' })

    const currentWallet = walletWith({ balance: 3 })
    mockPrisma.creditWallet.upsert.mockResolvedValue(currentWallet)

    const result = await grantCredits({
      userId: 'user-1',
      amount: 1,
      provider: 'ADMIN',
      type: 'ADMIN_GRANT',
      idempotencyKey: 'already-used-key',
    })

    // Returns current wallet, balance unchanged
    expect(result.balance).toBe(3)
  })
})

// =============================================================================
// spendCredit
// =============================================================================

describe('spendCredit', () => {
  test('deducts 1 credit and increments lifetimeSpent', async () => {
    const before = walletWith({ balance: 3, lifetimeSpent: 1 })
    const after  = walletWith({ balance: 2, lifetimeSpent: 2 })

    lockResolves(before)
    mockTx.creditWallet.update.mockResolvedValue(after)
    mockTx.creditTransaction.create.mockResolvedValue({})

    const result = await spendCredit({ userId: 'user-1', idempotencyKey: 'spend-001' })

    expect(result.balance).toBe(2)
    expect(result.lifetimeSpent).toBe(2)
    expect(mockTx.creditTransaction.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          type: 'SPEND',
          provider: 'SYSTEM',
          amount: 1,
          balanceBefore: 3,
          balanceAfter: 2,
        }),
      }),
    )
  })

  test('throws INSUFFICIENT_CREDITS when balance is 0', async () => {
    lockResolves(walletWith({ balance: 0 }))

    await expect(
      spendCredit({ userId: 'user-1', idempotencyKey: 'spend-002' }),
    ).rejects.toMatchObject({ code: 'INSUFFICIENT_CREDITS' })

    expect(mockTx.creditWallet.update).not.toHaveBeenCalled()
  })

  test('throws WALLET_NOT_FOUND when user has no wallet', async () => {
    lockResolves(null)

    await expect(
      spendCredit({ userId: 'user-no-wallet', idempotencyKey: 'spend-003' }),
    ).rejects.toMatchObject({ code: 'WALLET_NOT_FOUND' })
  })

  test('throws NEGATIVE_BALANCE_DEBT when the wallet balance is already negative', async () => {
    lockResolves(walletWith({ balance: -3 }))

    await expect(
      spendCredit({ userId: 'user-1', idempotencyKey: 'spend-debt' }),
    ).rejects.toMatchObject({ code: 'NEGATIVE_BALANCE_DEBT' })

    expect(mockTx.creditWallet.update).not.toHaveBeenCalled()
  })

  test('is idempotent: returns current wallet on duplicate idempotencyKey', async () => {
    mockPrisma.$transaction.mockRejectedValueOnce({ code: 'P2002' })

    const currentWallet = walletWith({ balance: 1 })
    mockPrisma.creditWallet.upsert.mockResolvedValue(currentWallet)

    const result = await spendCredit({ userId: 'user-1', idempotencyKey: 'spend-already-used' })

    expect(result.balance).toBe(1)
  })

  test('deducts a custom amount when provided (e.g. redeeming a multi-credit product)', async () => {
    const before = walletWith({ balance: 5, lifetimeSpent: 0 })
    const after  = walletWith({ balance: 2, lifetimeSpent: 3 })

    lockResolves(before)
    mockTx.creditWallet.update.mockResolvedValue(after)
    mockTx.creditTransaction.create.mockResolvedValue({})

    const result = await spendCredit({ userId: 'user-1', idempotencyKey: 'spend-multi', amount: 3 })

    expect(result.balance).toBe(2)
    expect(mockTx.creditTransaction.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ amount: 3, balanceBefore: 5, balanceAfter: 2 }) }),
    )
  })

  test('omitting amount still defaults to 1 (backward compatible)', async () => {
    const before = walletWith({ balance: 5 })
    const after  = walletWith({ balance: 4 })
    lockResolves(before)
    mockTx.creditWallet.update.mockResolvedValue(after)
    mockTx.creditTransaction.create.mockResolvedValue({})

    await spendCredit({ userId: 'user-1', idempotencyKey: 'spend-default' })

    expect(mockTx.creditTransaction.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ amount: 1 }) }),
    )
  })

  test('throws INSUFFICIENT_CREDITS when balance is less than the custom amount', async () => {
    lockResolves(walletWith({ balance: 2 }))

    await expect(
      spendCredit({ userId: 'user-1', idempotencyKey: 'spend-insufficient-multi', amount: 3 }),
    ).rejects.toMatchObject({ code: 'INSUFFICIENT_CREDITS' })
  })

  test('throws INVALID_AMOUNT for a zero or negative custom amount', async () => {
    await expect(
      spendCredit({ userId: 'user-1', idempotencyKey: 'spend-zero', amount: 0 }),
    ).rejects.toMatchObject({ code: 'INVALID_AMOUNT' })
    await expect(
      spendCredit({ userId: 'user-1', idempotencyKey: 'spend-negative', amount: -2 }),
    ).rejects.toMatchObject({ code: 'INVALID_AMOUNT' })
  })
})

// =============================================================================
// recordExternalPurchaseAudit
// =============================================================================

describe('recordExternalPurchaseAudit', () => {
  test('records a zero-amount ledger row without mutating wallet balance', async () => {
    const wallet = walletWith({ balance: 7 })
    mockPrisma.creditWallet.upsert.mockResolvedValue(wallet)
    mockPrisma.creditTransaction.create.mockResolvedValue({})

    await recordExternalPurchaseAudit({
      userId: 'user-1',
      idempotencyKey: 'stripe-purchase-audit:purchase-1',
      provider: 'STRIPE',
      productId: 'INSPECTION_REPORT',
    })

    expect(mockPrisma.creditTransaction.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          type: 'PURCHASE',
          provider: 'STRIPE',
          amount: 0,
          balanceBefore: 7,
          balanceAfter: 7,
        }),
      }),
    )
    // Never touches CreditWallet.balance directly.
    expect(mockPrisma.creditWallet.update).not.toHaveBeenCalled()
  })

  test('is a silent no-op on duplicate idempotencyKey', async () => {
    mockPrisma.creditWallet.upsert.mockResolvedValue(walletWith({ balance: 1 }))
    mockPrisma.creditTransaction.create.mockRejectedValue({ code: 'P2002' })

    await expect(
      recordExternalPurchaseAudit({ userId: 'user-1', idempotencyKey: 'dup-key', provider: 'STRIPE' }),
    ).resolves.toBeUndefined()
  })
})

// =============================================================================
// assertSufficientCredits
// =============================================================================

describe('assertSufficientCredits', () => {
  test('does not throw when balance >= required', async () => {
    mockPrisma.creditWallet.findUnique.mockResolvedValue({ balance: 5 })

    await expect(assertSufficientCredits('user-1', 1)).resolves.toBeUndefined()
    await expect(assertSufficientCredits('user-1', 5)).resolves.toBeUndefined()
  })

  test('throws INSUFFICIENT_CREDITS when balance is 0', async () => {
    mockPrisma.creditWallet.findUnique.mockResolvedValue({ balance: 0 })

    await expect(assertSufficientCredits('user-1')).rejects.toMatchObject({
      code: 'INSUFFICIENT_CREDITS',
    })
  })

  test('throws INSUFFICIENT_CREDITS when balance < required', async () => {
    mockPrisma.creditWallet.findUnique.mockResolvedValue({ balance: 2 })

    await expect(assertSufficientCredits('user-1', 3)).rejects.toMatchObject({
      code: 'INSUFFICIENT_CREDITS',
    })
  })
})

// =============================================================================
// refundCredits
// =============================================================================

describe('refundCredits', () => {
  test('deducts credits and records a REFUND ledger entry', async () => {
    const before = walletWith({ balance: 3 })
    const after  = walletWith({ balance: 2 })

    lockResolves(before)
    mockTx.creditWallet.update.mockResolvedValue(after)
    mockTx.creditTransaction.create.mockResolvedValue({})

    const result = await refundCredits({
      userId: 'user-1',
      amount: 1,
      idempotencyKey: 'refund-001',
      purchaseToken: 'token-xyz',
    })

    expect(result.balance).toBe(2)
    expect(mockTx.creditTransaction.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          type: 'REFUND',
          provider: 'GOOGLE_PLAY',
          amount: -1,
        }),
      }),
    )
  })

  test('goes negative (debt) when the refund exceeds the current balance — never clamps', async () => {
    const before = walletWith({ balance: 0 })
    const after  = walletWith({ balance: -5 })

    lockResolves(before)
    mockTx.creditWallet.update.mockResolvedValue(after)
    mockTx.creditTransaction.create.mockResolvedValue({})

    const result = await refundCredits({ userId: 'user-1', amount: 5, idempotencyKey: 'refund-002' })

    expect(result.balance).toBe(-5)
    const updateCall = mockTx.creditWallet.update.mock.calls[0][0]
    expect(updateCall.data.balance).toBe(-5)
    expect(mockTx.creditTransaction.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ amount: -5, balanceBefore: 0, balanceAfter: -5 }) }),
    )
  })

  test('a partial refund shortfall also goes negative rather than clamping to 0', async () => {
    const before = walletWith({ balance: 2 })
    const after  = walletWith({ balance: -3 })

    lockResolves(before)
    mockTx.creditWallet.update.mockResolvedValue(after)
    mockTx.creditTransaction.create.mockResolvedValue({})

    const result = await refundCredits({ userId: 'user-1', amount: 5, idempotencyKey: 'refund-partial' })

    expect(result.balance).toBe(-3) // 2 - 5
  })

  test('throws INVALID_AMOUNT for zero refund', async () => {
    await expect(
      refundCredits({ userId: 'user-1', amount: 0, idempotencyKey: 'refund-003' }),
    ).rejects.toMatchObject({ code: 'INVALID_AMOUNT' })
  })

  test('throws INVALID_AMOUNT for negative refund', async () => {
    await expect(
      refundCredits({ userId: 'user-1', amount: -2, idempotencyKey: 'refund-004' }),
    ).rejects.toMatchObject({ code: 'INVALID_AMOUNT' })
  })
})

// =============================================================================
// WalletError
// =============================================================================

describe('WalletError', () => {
  test('has the correct name and code', () => {
    const err = new WalletError('test error', 'INSUFFICIENT_CREDITS')
    expect(err.name).toBe('WalletError')
    expect(err.code).toBe('INSUFFICIENT_CREDITS')
    expect(err.message).toBe('test error')
    expect(err).toBeInstanceOf(Error)
  })

  test('supports the NEGATIVE_BALANCE_DEBT code', () => {
    const err = new WalletError('you owe credits', 'NEGATIVE_BALANCE_DEBT')
    expect(err.code).toBe('NEGATIVE_BALANCE_DEBT')
  })
})

// =============================================================================
// Google Play product mapping
// =============================================================================

describe('GOOGLE_PLAY_PRODUCTS mapping', () => {
  test('all five products are defined with correct credit counts', () => {
    for (let i = 1; i <= 5; i++) {
      expect(GOOGLE_PLAY_PRODUCTS[`inspection_credit_${i}`]).toBe(i)
    }
  })

  test('getCreditsForGooglePlayProduct returns correct credit count', () => {
    expect(getCreditsForGooglePlayProduct('inspection_credit_1')).toBe(1)
    expect(getCreditsForGooglePlayProduct('inspection_credit_2')).toBe(2)
    expect(getCreditsForGooglePlayProduct('inspection_credit_3')).toBe(3)
    expect(getCreditsForGooglePlayProduct('inspection_credit_4')).toBe(4)
    expect(getCreditsForGooglePlayProduct('inspection_credit_5')).toBe(5)
  })

  test('getCreditsForGooglePlayProduct returns null for unknown product', () => {
    expect(getCreditsForGooglePlayProduct('unknown_product')).toBeNull()
    expect(getCreditsForGooglePlayProduct('')).toBeNull()
    expect(getCreditsForGooglePlayProduct('inspection_credit_6')).toBeNull()
    expect(getCreditsForGooglePlayProduct('inspection_credit_99')).toBeNull()
  })

  test('isValidGooglePlayProduct correctly identifies known products', () => {
    expect(isValidGooglePlayProduct('inspection_credit_1')).toBe(true)
    expect(isValidGooglePlayProduct('inspection_credit_5')).toBe(true)
    expect(isValidGooglePlayProduct('inspection_credit_6')).toBe(false)
    expect(isValidGooglePlayProduct('com.other.product')).toBe(false)
    expect(isValidGooglePlayProduct('')).toBe(false)
  })

  test('no product maps to 0 or negative credits', () => {
    Object.values(GOOGLE_PLAY_PRODUCTS).forEach((credits) => {
      expect(credits).toBeGreaterThan(0)
    })
  })
})
