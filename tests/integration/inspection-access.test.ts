// =============================================================================
// GET/POST /api/inspection/access — Integration Tests
// Covers the promo-redemption rate limiting added as part of the payment-gate
// hardening (VIP0629 is a permanent, unlimited-use, hardcoded promo code —
// its redemption endpoint must not be brute-forceable).
// =============================================================================

import { NextResponse, type NextRequest } from 'next/server'

jest.mock('../../src/utils/auth.middleware', () => ({
  requireAuth: jest.fn(),
}))

jest.mock('../../src/lib/inspection/access', () => ({
  getInspectionAccess: jest.fn(),
  grantAccess: jest.fn(),
  verifyVehicleOwnership: jest.fn(),
}))

jest.mock('../../src/lib/legal/consent-guard', () => ({
  requireCurrentConsent: jest.fn(),
}))

import { GET, POST } from '../../src/app/api/inspection/access/route'
import { requireAuth } from '../../src/utils/auth.middleware'
import { verifyVehicleOwnership, grantAccess } from '../../src/lib/inspection/access'
import { requireCurrentConsent } from '../../src/lib/legal/consent-guard'
import { resetRateLimits } from '../../src/lib/security/rate-limit'

const mockRequireAuth = requireAuth as jest.Mock
const mockVerifyOwnership = verifyVehicleOwnership as jest.Mock
const mockGrantAccess = grantAccess as jest.Mock
const mockRequireCurrentConsent = requireCurrentConsent as jest.Mock

const AUTH_SUCCESS = { success: true, userId: 'user-1', email: 'u@test.com', role: 'USER', emailVerified: true }

function postReq(body: unknown): NextRequest {
  return { json: async () => body } as unknown as NextRequest
}

function getReq(vehicleId: string | null): NextRequest {
  return { nextUrl: { searchParams: { get: () => vehicleId } } } as unknown as NextRequest
}

beforeEach(() => {
  jest.clearAllMocks()
  resetRateLimits()
  mockRequireAuth.mockResolvedValue(AUTH_SUCCESS)
  mockRequireCurrentConsent.mockResolvedValue(null)
  mockVerifyOwnership.mockResolvedValue(true)
  mockGrantAccess.mockResolvedValue({ id: 'report-1', status: 'ACTIVE' })
})

describe('POST /api/inspection/access — promo redemption', () => {
  test('403s when the caller lacks current consent, before rate-limit/ownership checks', async () => {
    mockRequireCurrentConsent.mockResolvedValue(NextResponse.json({ code: 'CONSENT_REQUIRED' }, { status: 403 }))
    const res = await POST(postReq({ vehicleId: 'v1', code: 'VIP0629' }))
    expect(res.status).toBe(403)
    expect(mockGrantAccess).not.toHaveBeenCalled()
  })

  test('400s for an unknown code', async () => {
    const res = await POST(postReq({ vehicleId: 'v1', code: 'NOT-REAL' }))
    expect(res.status).toBe(400)
    expect(mockGrantAccess).not.toHaveBeenCalled()
  })

  test('grants access for a valid code', async () => {
    const res = await POST(postReq({ vehicleId: 'v1', code: 'VIP0629' }))
    expect(res.status).toBe(200)
    expect(mockGrantAccess).toHaveBeenCalledWith('user-1', 'v1', expect.objectContaining({ promoCode: 'VIP0629' }))
  })

  test('rate limits excessive redemption attempts from the same user, even against an unauthenticated brute-force pattern of valid-looking requests', async () => {
    let lastStatus = 0
    for (let i = 0; i < 6; i++) {
      const res = await POST(postReq({ vehicleId: 'v1', code: `GUESS-${i}` }))
      lastStatus = res.status
    }
    expect(lastStatus).toBe(429)
  })

  test('rate limit is keyed per user, not global', async () => {
    for (let i = 0; i < 5; i++) {
      await POST(postReq({ vehicleId: 'v1', code: `GUESS-${i}` }))
    }
    const blocked = await POST(postReq({ vehicleId: 'v1', code: 'GUESS-5' }))
    expect(blocked.status).toBe(429)

    mockRequireAuth.mockResolvedValue({ ...AUTH_SUCCESS, userId: 'user-2' })
    const otherUser = await POST(postReq({ vehicleId: 'v1', code: 'VIP0629' }))
    expect(otherUser.status).toBe(200)
  })
})

describe('GET /api/inspection/access — unaffected by promo hardening', () => {
  test('is not rate-limited (read-only status check)', async () => {
    const { getInspectionAccess } = jest.requireMock('../../src/lib/inspection/access')
    getInspectionAccess.mockResolvedValue({ status: 'NONE', grantedVia: null })
    let lastStatus = 0
    for (let i = 0; i < 10; i++) {
      const res = await GET(getReq('v1'))
      lastStatus = res.status
    }
    expect(lastStatus).toBe(200)
  })

  test('is never gated by consent — reading access status must not require re-consent', async () => {
    mockRequireCurrentConsent.mockResolvedValue(NextResponse.json({ code: 'CONSENT_REQUIRED' }, { status: 403 }))
    const { getInspectionAccess } = jest.requireMock('../../src/lib/inspection/access')
    getInspectionAccess.mockResolvedValue({ status: 'NONE', grantedVia: null })
    const res = await GET(getReq('v1'))
    expect(res.status).toBe(200)
  })
})
