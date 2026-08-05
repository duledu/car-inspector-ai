// =============================================================================
// POST /api/credits/google-play/verify — Integration Tests
// Exercises the real route handler + real credit-wallet.ts ledger logic
// together, with Prisma and the Google Play Developer API client mocked at
// their respective module boundaries (no real network or database calls).
// =============================================================================

import type { NextRequest } from 'next/server'

jest.mock('../../src/utils/auth.middleware', () => ({
  requireAuth: jest.fn(),
}))

jest.mock('../../src/lib/payments/google-play-verification', () => {
  const actual = jest.requireActual('../../src/lib/payments/google-play-verification')
  return {
    __esModule: true,
    GooglePlayVerificationError: actual.GooglePlayVerificationError,
    verifyGooglePlayPurchase: jest.fn(),
    acknowledgeGooglePlayPurchase: jest.fn(),
    consumeGooglePlayPurchase: jest.fn(),
  }
})

jest.mock('../../src/lib/payments/google-play-auth', () => ({
  getPackageName: jest.fn(() => 'com.usedcarsdoctor.app'),
}))

jest.mock('../../src/config/prisma', () => ({
  prisma: {
    googlePlayPurchase: { findUnique: jest.fn(), create: jest.fn(), update: jest.fn() },
    creditWallet: { findUnique: jest.fn(), upsert: jest.fn(), update: jest.fn() },
    creditTransaction: { findFirst: jest.fn(), create: jest.fn() },
    $transaction: jest.fn(),
  },
  isMissingTableOrColumnError: jest.fn().mockReturnValue(false),
}))

import { POST } from '../../src/app/api/credits/google-play/verify/route'
import { requireAuth } from '../../src/utils/auth.middleware'
import {
  verifyGooglePlayPurchase,
  acknowledgeGooglePlayPurchase,
  consumeGooglePlayPurchase,
} from '../../src/lib/payments/google-play-verification'
import { prisma as mockPrisma } from '../../src/config/prisma'
import { resetRateLimits } from '../../src/lib/security/rate-limit'

const mockRequireAuth = requireAuth as jest.Mock
const mockVerify = verifyGooglePlayPurchase as jest.Mock
const mockAcknowledge = acknowledgeGooglePlayPurchase as jest.Mock
const mockConsume = consumeGooglePlayPurchase as jest.Mock

const mockTx = {
  creditWallet: { upsert: jest.fn(), update: jest.fn() },
  creditTransaction: { create: jest.fn() },
  $queryRaw: jest.fn(),
}

function req(body: unknown): NextRequest {
  return { json: async () => body } as unknown as NextRequest
}

const AUTH_SUCCESS = { success: true, userId: 'user-1', email: 'u@test.com', role: 'USER', emailVerified: true }

beforeEach(() => {
  jest.clearAllMocks()
  resetRateLimits()
  mockRequireAuth.mockResolvedValue(AUTH_SUCCESS)
  mockAcknowledge.mockResolvedValue(undefined)
  mockConsume.mockResolvedValue(undefined)
  ;(mockPrisma as any).$transaction.mockImplementation(async (fn: any) => fn(mockTx))
  ;(mockPrisma as any).creditTransaction.findFirst.mockResolvedValue(null) // no duplicate purchaseToken by default
})

describe('POST /api/credits/google-play/verify', () => {
  test('401s when unauthenticated', async () => {
    mockRequireAuth.mockResolvedValue({ success: false, reason: 'Missing auth cookie' })
    const res = await POST(req({ productId: 'inspection_credit_1', purchaseToken: 'x'.repeat(20) }))
    expect(res.status).toBe(401)
  })

  test('400s for an unknown product ID', async () => {
    const res = await POST(req({ productId: 'not_a_real_sku', purchaseToken: 'x'.repeat(20) }))
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.code).toBe('INVALID_PRODUCT')
    expect(mockVerify).not.toHaveBeenCalled()
  })

  test('grants credits and consumes the purchase on a PURCHASED (state 0) token', async () => {
    ;(mockPrisma as any).googlePlayPurchase.findUnique.mockResolvedValue(null)
    ;(mockPrisma as any).googlePlayPurchase.create.mockResolvedValue({ id: 'gpp-1' })
    ;(mockPrisma as any).googlePlayPurchase.update.mockResolvedValue({})
    mockVerify.mockResolvedValue({
      purchaseToken: 'tok-new', productId: 'inspection_credit_3', orderId: 'GPA.1',
      purchaseState: 0, consumptionState: 0, acknowledgementState: 0, purchaseTimeMillis: '1',
    })
    mockTx.$queryRaw.mockResolvedValue([{ id: 'wallet-1', userId: 'user-1', balance: 0, lifetimePurchased: 0, lifetimeSpent: 0 }])
    mockTx.creditWallet.update.mockResolvedValue({ id: 'wallet-1', userId: 'user-1', balance: 3, lifetimePurchased: 3, lifetimeSpent: 0 })
    mockTx.creditTransaction.create.mockResolvedValue({})

    const res = await POST(req({ productId: 'inspection_credit_3', purchaseToken: 'tok-new'.padEnd(20, '0') }))

    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.data.status).toBe('GRANTED')
    expect(body.data.creditsGranted).toBe(3)
    expect(body.data.balance).toBe(3)
    expect(mockAcknowledge).toHaveBeenCalled()
    expect(mockConsume).toHaveBeenCalled()
  })

  test('replays ALREADY_GRANTED without re-verifying for a token already GRANTED', async () => {
    ;(mockPrisma as any).googlePlayPurchase.findUnique.mockResolvedValue({
      id: 'gpp-1', status: 'GRANTED', creditsGranted: 3,
    })
    ;(mockPrisma as any).creditWallet.findUnique.mockResolvedValue({ balance: 3 })

    const res = await POST(req({ productId: 'inspection_credit_3', purchaseToken: 'tok-old'.padEnd(20, '0') }))

    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.data.status).toBe('ALREADY_GRANTED')
    expect(mockVerify).not.toHaveBeenCalled()
  })

  test('409s for a token already REFUNDED', async () => {
    ;(mockPrisma as any).googlePlayPurchase.findUnique.mockResolvedValue({ id: 'gpp-1', status: 'REFUNDED', creditsGranted: 1 })
    const res = await POST(req({ productId: 'inspection_credit_1', purchaseToken: 'tok-refunded'.padEnd(20, '0') }))
    expect(res.status).toBe(409)
    const body = await res.json()
    expect(body.code).toBe('PURCHASE_REVOKED')
  })

  test('does not grant credits for a PENDING (state 2) purchase', async () => {
    ;(mockPrisma as any).googlePlayPurchase.findUnique.mockResolvedValue(null)
    ;(mockPrisma as any).googlePlayPurchase.create.mockResolvedValue({ id: 'gpp-1' })
    ;(mockPrisma as any).googlePlayPurchase.update.mockResolvedValue({})
    mockVerify.mockResolvedValue({
      purchaseToken: 'tok-pending', productId: 'inspection_credit_1', orderId: '',
      purchaseState: 2, consumptionState: 0, acknowledgementState: 0, purchaseTimeMillis: '1',
    })

    const res = await POST(req({ productId: 'inspection_credit_1', purchaseToken: 'tok-pending'.padEnd(20, '0') }))

    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.data.status).toBe('PENDING')
    expect(body.data.creditsGranted).toBe(0)
    expect(mockTx.creditTransaction.create).not.toHaveBeenCalled()
  })

  test('does not grant credits for a CANCELLED (state 1) purchase', async () => {
    ;(mockPrisma as any).googlePlayPurchase.findUnique.mockResolvedValue(null)
    ;(mockPrisma as any).googlePlayPurchase.create.mockResolvedValue({ id: 'gpp-1' })
    ;(mockPrisma as any).googlePlayPurchase.update.mockResolvedValue({})
    mockVerify.mockResolvedValue({
      purchaseToken: 'tok-cancelled', productId: 'inspection_credit_1', orderId: '',
      purchaseState: 1, consumptionState: 0, acknowledgementState: 0, purchaseTimeMillis: '1',
    })

    const res = await POST(req({ productId: 'inspection_credit_1', purchaseToken: 'tok-cancelled'.padEnd(20, '0') }))

    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.data.status).toBe('CANCELLED')
    expect(mockTx.creditTransaction.create).not.toHaveBeenCalled()
  })

  test('rejects an invalid/unknown token with 400', async () => {
    ;(mockPrisma as any).googlePlayPurchase.findUnique.mockResolvedValue(null)
    ;(mockPrisma as any).googlePlayPurchase.create.mockResolvedValue({ id: 'gpp-1' })
    ;(mockPrisma as any).googlePlayPurchase.update.mockResolvedValue({})
    const { GooglePlayVerificationError } = jest.requireActual('../../src/lib/payments/google-play-verification')
    mockVerify.mockRejectedValue(new GooglePlayVerificationError('bad token', 'INVALID_TOKEN'))

    const res = await POST(req({ productId: 'inspection_credit_1', purchaseToken: 'tok-invalid'.padEnd(20, '0') }))

    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.code).toBe('INVALID_TOKEN')
  })

  test('a concurrent duplicate grant (DUPLICATE_PURCHASE_TOKEN from the wallet) is treated as idempotent success', async () => {
    ;(mockPrisma as any).googlePlayPurchase.findUnique.mockResolvedValue(null)
    ;(mockPrisma as any).googlePlayPurchase.create.mockResolvedValue({ id: 'gpp-1' })
    ;(mockPrisma as any).googlePlayPurchase.update.mockResolvedValue({})
    mockVerify.mockResolvedValue({
      purchaseToken: 'tok-race', productId: 'inspection_credit_1', orderId: 'GPA.race',
      purchaseState: 0, consumptionState: 0, acknowledgementState: 0, purchaseTimeMillis: '1',
    })
    // Simulate another concurrent request having already used this token.
    ;(mockPrisma as any).creditTransaction.findFirst.mockResolvedValue({ id: 'existing-tx' })
    ;(mockPrisma as any).creditWallet.findUnique.mockResolvedValue({ balance: 1 })

    const res = await POST(req({ productId: 'inspection_credit_1', purchaseToken: 'tok-race'.padEnd(20, '0') }))

    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.data.status).toBe('ALREADY_GRANTED')
  })
})
