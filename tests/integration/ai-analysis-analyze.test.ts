// =============================================================================
// POST /api/ai-analysis/analyze — Payment Gate Integration Tests
//
// Confirms the fix for the confirmed payment-gate bypass: ownership and AI
// Deep Scan entitlement checks must be unconditional (never behind
// FEATURE_INSPECTION_ACCESS_GATE), must reject cross-user vehicles, and the
// route must rate-limit per user.
// =============================================================================

import { NextResponse, type NextRequest } from 'next/server'

jest.mock('../../src/utils/auth.middleware', () => ({
  requireAuth: jest.fn(),
}))

jest.mock('../../src/lib/inspection/access', () => ({
  hasAiAnalysisAccess: jest.fn(),
}))

jest.mock('../../src/lib/legal/consent-guard', () => ({
  requireCurrentConsent: jest.fn(),
}))

jest.mock('../../src/config/prisma', () => ({
  prisma: {
    vehicle: { findFirst: jest.fn() },
    aIResult: { create: jest.fn() },
  },
}))

import { POST } from '../../src/app/api/ai-analysis/analyze/route'
import { requireAuth } from '../../src/utils/auth.middleware'
import { hasAiAnalysisAccess } from '../../src/lib/inspection/access'
import { requireCurrentConsent } from '../../src/lib/legal/consent-guard'
import { prisma as mockPrisma } from '../../src/config/prisma'
import { resetRateLimits } from '../../src/lib/security/rate-limit'

const mockRequireAuth = requireAuth as jest.Mock
const mockHasAiAnalysisAccess = hasAiAnalysisAccess as jest.Mock
const mockRequireCurrentConsent = requireCurrentConsent as jest.Mock

const AUTH_SUCCESS = { success: true, userId: 'user-1', email: 'u@test.com', role: 'USER', emailVerified: true }

function req(body: unknown): NextRequest {
  return { json: async () => body } as unknown as NextRequest
}

function validBody(overrides: Record<string, unknown> = {}) {
  return {
    vehicleId: 'v1',
    photoResults: [
      { angle: 'FRONT', label: 'Front', signal: 'ok', severity: 'ok', detail: 'fine', confidence: 80, isUsable: true },
    ],
    ...overrides,
  }
}

const ORIGINAL_ENV = { ...process.env }

beforeEach(() => {
  jest.clearAllMocks()
  resetRateLimits()
  process.env = { ...ORIGINAL_ENV }
  mockRequireAuth.mockResolvedValue(AUTH_SUCCESS)
  mockRequireCurrentConsent.mockResolvedValue(null)
  ;(mockPrisma as any).vehicle.findFirst.mockResolvedValue({ id: 'v1' })
  ;(mockPrisma as any).aIResult.create.mockResolvedValue({
    id: 'ai-1', vehicleId: 'v1', overallScore: 90, modelVersion: 'gpt-4o-v1', createdAt: new Date(),
  })
  mockHasAiAnalysisAccess.mockResolvedValue(false)
})

afterAll(() => {
  process.env = ORIGINAL_ENV
})

describe('POST /api/ai-analysis/analyze — payment gate', () => {
  test('401s when unauthenticated', async () => {
    mockRequireAuth.mockResolvedValue({ success: false, reason: 'Missing auth cookie' })
    const res = await POST(req(validBody()))
    expect(res.status).toBe(401)
  })

  test('403s when the caller lacks current consent, before the entitlement check', async () => {
    mockRequireCurrentConsent.mockResolvedValue(NextResponse.json({ code: 'CONSENT_REQUIRED' }, { status: 403 }))
    mockHasAiAnalysisAccess.mockResolvedValue(true)
    const res = await POST(req(validBody()))
    expect(res.status).toBe(403)
    const body = await res.json()
    expect(body.code).toBe('CONSENT_REQUIRED')
  })

  test('rejects (403 ACCESS_REQUIRED) an authenticated owner with no entitlement — the confirmed bypass', async () => {
    mockHasAiAnalysisAccess.mockResolvedValue(false)
    const res = await POST(req(validBody()))
    expect(res.status).toBe(403)
    const body = await res.json()
    expect(body.code).toBe('ACCESS_REQUIRED')
    expect((mockPrisma as any).aIResult.create).not.toHaveBeenCalled()
  })

  test('rejects (404) a vehicle the caller does not own, even if entitlement would otherwise pass', async () => {
    ;(mockPrisma as any).vehicle.findFirst.mockResolvedValue(null)
    mockHasAiAnalysisAccess.mockResolvedValue(true)
    const res = await POST(req(validBody({ vehicleId: 'someone-elses-vehicle' })))
    expect(res.status).toBe(404)
    expect((mockPrisma as any).aIResult.create).not.toHaveBeenCalled()
  })

  test('proceeds and persists once ownership and entitlement both pass', async () => {
    mockHasAiAnalysisAccess.mockResolvedValue(true)
    const res = await POST(req(validBody()))
    expect(res.status).toBe(200)
    expect((mockPrisma as any).aIResult.create).toHaveBeenCalled()
  })

  test('entitlement gate cannot be bypassed regardless of FEATURE_INSPECTION_ACCESS_GATE value', async () => {
    mockHasAiAnalysisAccess.mockResolvedValue(false)

    process.env.FEATURE_INSPECTION_ACCESS_GATE = 'false'
    const resFlagFalse = await POST(req(validBody()))
    expect(resFlagFalse.status).toBe(403)

    process.env.FEATURE_INSPECTION_ACCESS_GATE = 'true'
    const resFlagTrue = await POST(req(validBody()))
    expect(resFlagTrue.status).toBe(403)
  })

  test('rate limits excessive requests from the same user', async () => {
    mockHasAiAnalysisAccess.mockResolvedValue(false)
    let lastStatus = 0
    for (let i = 0; i < 21; i++) {
      const res = await POST(req(validBody()))
      lastStatus = res.status
    }
    expect(lastStatus).toBe(429)
  })
})
