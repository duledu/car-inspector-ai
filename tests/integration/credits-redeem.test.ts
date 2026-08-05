// =============================================================================
// POST /api/credits/redeem — Integration Tests
// Exercises the real route handler + real credit-wallet.ts + real
// premium-access.ts together, with Prisma and access.ts's vehicle/report
// helpers mocked at their module boundaries.
// =============================================================================

import type { NextRequest } from 'next/server'

jest.mock('../../src/utils/auth.middleware', () => ({
  requireAuth: jest.fn(),
}))

jest.mock('../../src/lib/inspection/access', () => ({
  verifyVehicleOwnership: jest.fn(),
  grantAccess: jest.fn(),
}))

jest.mock('../../src/config/prisma', () => ({
  prisma: {
    premiumPurchase: { findFirst: jest.fn(), upsert: jest.fn(), update: jest.fn() },
    accessGrant: { upsert: jest.fn() },
    paymentEvent: { create: jest.fn() },
    creditWallet: { findUnique: jest.fn(), upsert: jest.fn(), update: jest.fn() },
    creditTransaction: { findFirst: jest.fn(), create: jest.fn() },
    $transaction: jest.fn(),
  },
  isMissingTableOrColumnError: jest.fn().mockReturnValue(false),
}))

import { POST } from '../../src/app/api/credits/redeem/route'
import { requireAuth } from '../../src/utils/auth.middleware'
import { verifyVehicleOwnership, grantAccess } from '../../src/lib/inspection/access'
import { prisma as mockPrisma } from '../../src/config/prisma'
import { resetRateLimits } from '../../src/lib/security/rate-limit'

const mockRequireAuth = requireAuth as jest.Mock
const mockVerifyOwnership = verifyVehicleOwnership as jest.Mock
const mockGrantAccess = grantAccess as jest.Mock

// $queryRaw stands in for lockWalletForUpdate's SELECT ... FOR UPDATE —
// spendCredit and refundCredits both read the wallet balance through it now
// (see credit-wallet.ts), rather than tx.creditWallet.findUnique.
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
  mockVerifyOwnership.mockResolvedValue(true)
  mockGrantAccess.mockResolvedValue({ id: 'report-1', status: 'ACTIVE' })
  ;(mockPrisma as any).$transaction.mockImplementation(async (fn: any) => fn(mockTx))
  ;(mockPrisma as any).creditTransaction.findFirst.mockResolvedValue(null)
  ;(mockPrisma as any).premiumPurchase.findFirst.mockResolvedValue(null)
  ;(mockPrisma as any).accessGrant.upsert.mockResolvedValue({})
  ;(mockPrisma as any).paymentEvent.create.mockResolvedValue({})
})

describe('POST /api/credits/redeem', () => {
  test('401s when unauthenticated', async () => {
    mockRequireAuth.mockResolvedValue({ success: false, reason: 'Missing auth cookie' })
    const res = await POST(req({ vehicleId: 'v1', productType: 'INSPECTION_REPORT' }))
    expect(res.status).toBe(401)
  })

  test('404s when the vehicle is not owned by the caller', async () => {
    mockVerifyOwnership.mockResolvedValue(false)
    const res = await POST(req({ vehicleId: 'not-mine', productType: 'INSPECTION_REPORT' }))
    expect(res.status).toBe(404)
  })

  test('400s with PRODUCT_NOT_AVAILABLE_ON_ANDROID for CarVertical', async () => {
    const res = await POST(req({ vehicleId: 'v1', productType: 'CARVERTICAL_REPORT' }))
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.code).toBe('PRODUCT_NOT_AVAILABLE_ON_ANDROID')
  })

  test('409s when the product was already purchased for this vehicle', async () => {
    ;(mockPrisma as any).premiumPurchase.findFirst.mockResolvedValue({ id: 'p1', status: 'PAID' })
    const res = await POST(req({ vehicleId: 'v1', productType: 'INSPECTION_REPORT' }))
    expect(res.status).toBe(409)
    const body = await res.json()
    expect(body.code).toBe('ALREADY_PURCHASED')
  })

  test('402s with INSUFFICIENT_CREDITS when the wallet balance is too low', async () => {
    mockTx.$queryRaw.mockResolvedValue([{ id: 'w1', userId: 'user-1', balance: 0 }])
    const res = await POST(req({ vehicleId: 'v1', productType: 'INSPECTION_REPORT' }))
    expect(res.status).toBe(402)
    const body = await res.json()
    expect(body.code).toBe('INSUFFICIENT_CREDITS')
  })

  test('402s with NEGATIVE_BALANCE_DEBT when the wallet balance is already negative', async () => {
    mockTx.$queryRaw.mockResolvedValue([{ id: 'w1', userId: 'user-1', balance: -2 }])
    const res = await POST(req({ vehicleId: 'v1', productType: 'INSPECTION_REPORT' }))
    expect(res.status).toBe(402)
    const body = await res.json()
    expect(body.code).toBe('NEGATIVE_BALANCE_DEBT')
  })

  test('spends credits and grants access for INSPECTION_REPORT (cost 1)', async () => {
    mockTx.$queryRaw.mockResolvedValue([{ id: 'w1', userId: 'user-1', balance: 5 }])
    mockTx.creditWallet.update.mockResolvedValue({ id: 'w1', userId: 'user-1', balance: 4, lifetimePurchased: 5, lifetimeSpent: 1 })
    mockTx.creditTransaction.create.mockResolvedValue({})
    ;(mockPrisma as any).premiumPurchase.upsert.mockResolvedValue({ id: 'purchase-1', userId: 'user-1', vehicleId: 'v1', productType: 'INSPECTION_REPORT' })
    ;(mockPrisma as any).premiumPurchase.update.mockResolvedValue({ id: 'purchase-1', userId: 'user-1', vehicleId: 'v1', productType: 'INSPECTION_REPORT' })

    const res = await POST(req({ vehicleId: 'v1', productType: 'INSPECTION_REPORT' }))

    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.data.status).toBe('GRANTED')
    expect(body.data.creditsSpent).toBe(1)
    expect(body.data.balance).toBe(4)
    expect(mockGrantAccess).toHaveBeenCalledWith('user-1', 'v1', expect.objectContaining({ grantedVia: 'purchase' }))
  })

  test('spends 5 credits for FULL_INSPECTION_BUNDLE', async () => {
    mockTx.$queryRaw.mockResolvedValue([{ id: 'w1', userId: 'user-1', balance: 10 }])
    mockTx.creditWallet.update.mockResolvedValue({ id: 'w1', userId: 'user-1', balance: 5, lifetimePurchased: 10, lifetimeSpent: 5 })
    mockTx.creditTransaction.create.mockResolvedValue({})
    ;(mockPrisma as any).premiumPurchase.upsert.mockResolvedValue({ id: 'purchase-2', userId: 'user-1', vehicleId: 'v1', productType: 'FULL_INSPECTION_BUNDLE' })
    ;(mockPrisma as any).premiumPurchase.update.mockResolvedValue({ id: 'purchase-2', userId: 'user-1', vehicleId: 'v1', productType: 'FULL_INSPECTION_BUNDLE' })

    const res = await POST(req({ vehicleId: 'v1', productType: 'FULL_INSPECTION_BUNDLE' }))

    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.data.creditsSpent).toBe(5)
    // Not the INSPECTION_REPORT product — access.ts's grantAccess (InspectionReport
    // activation) is only called for INSPECTION_REPORT.
    expect(mockGrantAccess).not.toHaveBeenCalled()
  })

  test('refunds the spent credits if granting access fails after a successful spend', async () => {
    mockTx.$queryRaw.mockResolvedValue([{ id: 'w1', userId: 'user-1', balance: 5 }])
    mockTx.creditWallet.update.mockResolvedValue({ id: 'w1', userId: 'user-1', balance: 4, lifetimePurchased: 5, lifetimeSpent: 1 })
    mockTx.creditTransaction.create.mockResolvedValue({})
    ;(mockPrisma as any).premiumPurchase.upsert.mockRejectedValue(new Error('db exploded'))

    const res = await POST(req({ vehicleId: 'v1', productType: 'INSPECTION_REPORT' }))

    expect(res.status).toBe(500)
    const body = await res.json()
    expect(body.code).toBe('GRANT_FAILED')
    // The refund is itself a spendCredit-adjacent wallet call — verify a
    // second (refund) transaction was recorded in the same mocked ledger.
    expect(mockTx.creditTransaction.create.mock.calls.length).toBeGreaterThanOrEqual(2)
  })
})
