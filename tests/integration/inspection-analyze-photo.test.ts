// =============================================================================
// POST /api/inspection/analyze-photo — Payment Gate Integration Tests
//
// Confirms the fix for the confirmed payment-gate bypass: ownership and AI
// Deep Scan entitlement checks must be unconditional (never behind
// FEATURE_INSPECTION_ACCESS_GATE), must reject cross-user vehicles, and the
// route must rate-limit per user. The OpenAI call itself is mocked — this
// file only proves the security gate, not the analysis pipeline.
// =============================================================================

import { NextResponse, type NextRequest } from 'next/server'

jest.mock('../../src/utils/auth.middleware', () => ({
  requireAuth: jest.fn(),
}))

jest.mock('../../src/lib/inspection/access', () => ({
  verifyVehicleOwnership: jest.fn(),
  hasAiAnalysisAccess: jest.fn(),
}))

jest.mock('../../src/lib/legal/consent-guard', () => ({
  requireCurrentConsent: jest.fn(),
}))

import { POST } from '../../src/app/api/inspection/analyze-photo/route'
import { requireAuth } from '../../src/utils/auth.middleware'
import { verifyVehicleOwnership, hasAiAnalysisAccess } from '../../src/lib/inspection/access'
import { requireCurrentConsent } from '../../src/lib/legal/consent-guard'
import { resetRateLimits } from '../../src/lib/security/rate-limit'

const mockRequireAuth = requireAuth as jest.Mock
const mockVerifyOwnership = verifyVehicleOwnership as jest.Mock
const mockHasAiAnalysisAccess = hasAiAnalysisAccess as jest.Mock
const mockRequireCurrentConsent = requireCurrentConsent as jest.Mock

const AUTH_SUCCESS = { success: true, userId: 'user-1', email: 'u@test.com', role: 'USER', emailVerified: true }

function req(body: unknown): NextRequest {
  return {
    headers: { get: () => null },
    json: async () => body,
  } as unknown as NextRequest
}

function validBody(overrides: Record<string, unknown> = {}) {
  return {
    vehicleId: 'v1',
    imageBase64: 'a'.repeat(200),
    mimeType: 'image/jpeg',
    angle: 'FRONT',
    angleLabel: 'Front',
    locale: 'en',
    ...overrides,
  }
}

function mockOpenAISuccess() {
  ;(global as any).fetch = jest.fn().mockResolvedValue({
    ok: true,
    status: 200,
    json: async () => ({
      choices: [{ finish_reason: 'stop', message: { content: JSON.stringify({ imageQuality: 'good', confidenceScore: 80 }) } }],
      usage: { prompt_tokens: 1, completion_tokens: 1, total_tokens: 2 },
    }),
    text: async () => '',
  })
}

const ORIGINAL_ENV = { ...process.env }

beforeEach(() => {
  jest.clearAllMocks()
  resetRateLimits()
  process.env = { ...ORIGINAL_ENV, OPENAI_API_KEY: 'test-key' }
  mockRequireAuth.mockResolvedValue(AUTH_SUCCESS)
  mockRequireCurrentConsent.mockResolvedValue(null)
  mockVerifyOwnership.mockResolvedValue(true)
  mockHasAiAnalysisAccess.mockResolvedValue(false)
})

afterAll(() => {
  process.env = ORIGINAL_ENV
})

describe('POST /api/inspection/analyze-photo — payment gate', () => {
  test('401s when unauthenticated', async () => {
    mockRequireAuth.mockResolvedValue({ success: false, reason: 'Missing auth cookie' })
    const res = await POST(req(validBody()))
    expect(res.status).toBe(401)
  })

  test('403s when the caller lacks current consent, before ownership is even checked', async () => {
    mockRequireCurrentConsent.mockResolvedValue(NextResponse.json({ code: 'CONSENT_REQUIRED' }, { status: 403 }))
    const res = await POST(req(validBody()))
    expect(res.status).toBe(403)
    expect(mockVerifyOwnership).not.toHaveBeenCalled()
  })

  test('422s when vehicleId is missing — no longer optional', async () => {
    const res = await POST(req(validBody({ vehicleId: undefined })))
    expect(res.status).toBe(422)
    expect(mockVerifyOwnership).not.toHaveBeenCalled()
  })

  test('rejects (403 ACCESS_REQUIRED) an authenticated owner with no entitlement — the confirmed bypass', async () => {
    mockVerifyOwnership.mockResolvedValue(true)
    mockHasAiAnalysisAccess.mockResolvedValue(false)
    const res = await POST(req(validBody()))
    expect(res.status).toBe(403)
    const body = await res.json()
    expect(body.code).toBe('ACCESS_REQUIRED')
  })

  test('rejects (404) a vehicle the caller does not own, even if entitlement would otherwise pass', async () => {
    mockVerifyOwnership.mockResolvedValue(false)
    mockHasAiAnalysisAccess.mockResolvedValue(true) // must never be consulted/relied on after ownership fails
    const res = await POST(req(validBody({ vehicleId: 'someone-elses-vehicle' })))
    expect(res.status).toBe(404)
  })

  test('proceeds to analysis once ownership and entitlement both pass', async () => {
    mockVerifyOwnership.mockResolvedValue(true)
    mockHasAiAnalysisAccess.mockResolvedValue(true)
    mockOpenAISuccess()
    const res = await POST(req(validBody()))
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.data.imageQuality).toBe('good')
  })

  test('entitlement gate cannot be bypassed regardless of FEATURE_INSPECTION_ACCESS_GATE value', async () => {
    mockVerifyOwnership.mockResolvedValue(true)
    mockHasAiAnalysisAccess.mockResolvedValue(false)

    process.env.FEATURE_INSPECTION_ACCESS_GATE = 'false'
    const resFlagFalse = await POST(req(validBody()))
    expect(resFlagFalse.status).toBe(403)

    process.env.FEATURE_INSPECTION_ACCESS_GATE = 'true'
    const resFlagTrue = await POST(req(validBody()))
    expect(resFlagTrue.status).toBe(403)

    delete process.env.FEATURE_INSPECTION_ACCESS_GATE
    const resFlagUnset = await POST(req(validBody()))
    expect(resFlagUnset.status).toBe(403)
  })

  test('rate limits excessive requests from the same user', async () => {
    mockVerifyOwnership.mockResolvedValue(true)
    mockHasAiAnalysisAccess.mockResolvedValue(false)

    let lastStatus = 0
    for (let i = 0; i < 61; i++) {
      const res = await POST(req(validBody()))
      lastStatus = res.status
    }
    expect(lastStatus).toBe(429)
  })
})
