// =============================================================================
// Credit Wallet Service — Unit Tests
// All Prisma calls are mocked; no database connection required.
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
const mockTx = {
  creditWallet: { upsert: jest.fn(), findUnique: jest.fn(), update: jest.fn() },
  creditTransaction: { create: jest.fn() },
}

// Import the module under test AFTER mocks are in place.
import {
  getOrCreateWallet,
  getCreditBalance,
  grantCredits,
  spendCredit,
  refundCredits,
  assertSufficientCredits,
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
    mockTx.creditWallet.upsert.mockResolvedValue(before)
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
    mockTx.creditWallet.upsert.mockResolvedValue(before)
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

    mockTx.creditWallet.findUnique.mockResolvedValue(before)
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
    mockTx.creditWallet.findUnique.mockResolvedValue(walletWith({ balance: 0 }))

    await expect(
      spendCredit({ userId: 'user-1', idempotencyKey: 'spend-002' }),
    ).rejects.toMatchObject({ code: 'INSUFFICIENT_CREDITS' })

    expect(mockTx.creditWallet.update).not.toHaveBeenCalled()
  })

  test('throws WALLET_NOT_FOUND when user has no wallet', async () => {
    mockTx.creditWallet.findUnique.mockResolvedValue(null)

    await expect(
      spendCredit({ userId: 'user-no-wallet', idempotencyKey: 'spend-003' }),
    ).rejects.toMatchObject({ code: 'WALLET_NOT_FOUND' })
  })

  test('is idempotent: returns current wallet on duplicate idempotencyKey', async () => {
    mockPrisma.$transaction.mockRejectedValueOnce({ code: 'P2002' })

    const currentWallet = walletWith({ balance: 1 })
    mockPrisma.creditWallet.upsert.mockResolvedValue(currentWallet)

    const result = await spendCredit({ userId: 'user-1', idempotencyKey: 'spend-already-used' })

    expect(result.balance).toBe(1)
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

    mockTx.creditWallet.upsert.mockResolvedValue(before)
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
        }),
      }),
    )
  })

  test('clamps balance to 0 — never goes negative on refund', async () => {
    const before = walletWith({ balance: 0 })
    const after  = walletWith({ balance: 0 })

    mockTx.creditWallet.upsert.mockResolvedValue(before)
    mockTx.creditWallet.update.mockResolvedValue(after)
    mockTx.creditTransaction.create.mockResolvedValue({})

    await refundCredits({ userId: 'user-1', amount: 5, idempotencyKey: 'refund-002' })

    const updateCall = mockTx.creditWallet.update.mock.calls[0][0]
    expect(updateCall.data.balance).toBe(0)
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
