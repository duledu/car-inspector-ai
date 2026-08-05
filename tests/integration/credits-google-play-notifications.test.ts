// =============================================================================
// POST /api/credits/google-play/notifications — Integration Tests
// Exercises the real route handler with Prisma, the OIDC verifier, and the
// Google Play voided-purchases re-verification mocked at their module
// boundaries. Covers: OIDC auth required, shared-secret required, payload
// not trusted without independent re-confirmation, and the happy path.
// =============================================================================

import type { NextRequest } from 'next/server'

// jest.mock is hoisted before any const declarations, so all mock state
// must live INSIDE the factory. Access it afterwards via jest.requireMock.
//
// The route module does `new OAuth2Client()` exactly once at import time and
// reuses that instance for every request, so the factory must return the
// SAME verifyIdToken mock from every constructor call (not a fresh jest.fn()
// per call) — otherwise controlling it from the test would have no effect
// on what the route actually invokes.
jest.mock('google-auth-library', () => {
  const verifyIdToken = jest.fn()
  return {
    OAuth2Client: jest.fn().mockImplementation(() => ({ verifyIdToken })),
    __mockVerifyIdToken: verifyIdToken,
  }
})

jest.mock('../../src/lib/payments/google-play-verification', () => ({
  wasPurchaseVoided: jest.fn(),
}))

jest.mock('../../src/lib/credits/credit-wallet', () => ({
  refundCredits: jest.fn(),
}))

jest.mock('../../src/config/prisma', () => ({
  prisma: {
    googlePlayPurchase: { findUnique: jest.fn(), update: jest.fn() },
  },
}))

import { POST } from '../../src/app/api/credits/google-play/notifications/route'
import { wasPurchaseVoided } from '../../src/lib/payments/google-play-verification'
import { refundCredits } from '../../src/lib/credits/credit-wallet'
import { prisma as mockPrisma } from '../../src/config/prisma'

const mockWasPurchaseVoided = wasPurchaseVoided as jest.Mock
const mockRefundCredits = refundCredits as jest.Mock
const { __mockVerifyIdToken: mockVerifyIdToken } = jest.requireMock('google-auth-library') as {
  __mockVerifyIdToken: jest.Mock
}

const RTDN_TOKEN = 'test-shared-secret'
const OIDC_AUDIENCE = 'https://usedcarsdoctor.com/api/credits/google-play/notifications'
const SERVICE_ACCOUNT_EMAIL = 'pubsub-push@test-project.iam.gserviceaccount.com'

const ORIGINAL_ENV = { ...process.env }

function setValidEnv() {
  process.env.GOOGLE_PLAY_RTDN_TOKEN = RTDN_TOKEN
  process.env.GOOGLE_PLAY_RTDN_OIDC_AUDIENCE = OIDC_AUDIENCE
  process.env.GOOGLE_PLAY_RTDN_SERVICE_ACCOUNT_EMAIL = SERVICE_ACCOUNT_EMAIL
}

function pubsubEnvelope(notification: unknown) {
  return { message: { data: Buffer.from(JSON.stringify(notification)).toString('base64') } }
}

function req(opts: { authHeader?: string | null; token?: string | null; body?: unknown }): NextRequest {
  const body = opts.body ?? pubsubEnvelope({})
  return {
    headers: { get: (name: string) => (name.toLowerCase() === 'authorization' ? opts.authHeader ?? null : null) },
    nextUrl: { searchParams: { get: (name: string) => (name === 'token' ? opts.token ?? null : null) } },
    json: async () => body,
  } as unknown as NextRequest
}

function validAuthHeader() {
  return 'Bearer valid-oidc-token'
}

function acceptOidc() {
  mockVerifyIdToken.mockResolvedValue({
    getPayload: () => ({
      iss: 'https://accounts.google.com',
      email: SERVICE_ACCOUNT_EMAIL,
      email_verified: true,
    }),
  })
}

beforeEach(() => {
  jest.clearAllMocks()
  process.env = { ...ORIGINAL_ENV }
  setValidEnv()
})

afterAll(() => {
  process.env = ORIGINAL_ENV
})

describe('POST /api/credits/google-play/notifications — authentication', () => {
  test('401s when no Authorization header is present', async () => {
    const res = await POST(req({ token: RTDN_TOKEN, body: pubsubEnvelope({}) }))
    expect(res.status).toBe(401)
    expect(mockVerifyIdToken).not.toHaveBeenCalled()
  })

  test('401s when the OIDC token fails verification', async () => {
    mockVerifyIdToken.mockRejectedValue(new Error('invalid signature'))
    const res = await POST(req({ authHeader: validAuthHeader(), token: RTDN_TOKEN }))
    expect(res.status).toBe(401)
  })

  test('401s when the OIDC payload email does not match the configured service account', async () => {
    mockVerifyIdToken.mockResolvedValue({
      getPayload: () => ({ iss: 'https://accounts.google.com', email: 'someone-else@evil.com', email_verified: true }),
    })
    const res = await POST(req({ authHeader: validAuthHeader(), token: RTDN_TOKEN }))
    expect(res.status).toBe(401)
  })

  test('fails closed (401) when OIDC env vars are not configured, even with a well-formed header', async () => {
    delete process.env.GOOGLE_PLAY_RTDN_OIDC_AUDIENCE
    acceptOidc()
    const res = await POST(req({ authHeader: validAuthHeader(), token: RTDN_TOKEN }))
    expect(res.status).toBe(401)
  })

  test('401s when OIDC passes but the shared-secret token is wrong', async () => {
    acceptOidc()
    const res = await POST(req({ authHeader: validAuthHeader(), token: 'wrong-token' }))
    expect(res.status).toBe(401)
  })

  test('401s when OIDC passes but the shared-secret token is missing', async () => {
    acceptOidc()
    const res = await POST(req({ authHeader: validAuthHeader(), token: null }))
    expect(res.status).toBe(401)
  })
})

describe('POST /api/credits/google-play/notifications — voided-purchase handling', () => {
  test('does not refund when Google\'s voidedpurchases.list does not confirm the token', async () => {
    acceptOidc()
    ;(mockPrisma as any).googlePlayPurchase.findUnique.mockResolvedValue({
      id: 'gpp-1', userId: 'user-1', status: 'GRANTED', creditsGranted: 3,
    })
    mockWasPurchaseVoided.mockResolvedValue(false) // Google does not confirm the claimed void

    const res = await POST(req({
      authHeader: validAuthHeader(),
      token: RTDN_TOKEN,
      body: pubsubEnvelope({ voidedPurchaseNotification: { purchaseToken: 'tok-unconfirmed', orderId: 'GPA.1' } }),
    }))

    expect(res.status).toBe(200) // still acks Pub/Sub
    expect(mockRefundCredits).not.toHaveBeenCalled()
  })

  test('refunds only after Google independently confirms the void', async () => {
    acceptOidc()
    ;(mockPrisma as any).googlePlayPurchase.findUnique.mockResolvedValue({
      id: 'gpp-1', userId: 'user-1', status: 'GRANTED', creditsGranted: 3,
    })
    ;(mockPrisma as any).googlePlayPurchase.update.mockResolvedValue({})
    mockWasPurchaseVoided.mockResolvedValue(true)
    mockRefundCredits.mockResolvedValue({ id: 'w1', userId: 'user-1', balance: -3, lifetimePurchased: 3, lifetimeSpent: 0 })

    const res = await POST(req({
      authHeader: validAuthHeader(),
      token: RTDN_TOKEN,
      body: pubsubEnvelope({ voidedPurchaseNotification: { purchaseToken: 'tok-confirmed', orderId: 'GPA.2' } }),
    }))

    expect(res.status).toBe(200)
    expect(mockRefundCredits).toHaveBeenCalledWith(
      expect.objectContaining({ userId: 'user-1', amount: 3, purchaseToken: 'tok-confirmed' }),
    )
    expect((mockPrisma as any).googlePlayPurchase.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: { status: 'REVOKED' } }),
    )
  })

  test('skips refund gracefully when the purchaseToken is unknown to us', async () => {
    acceptOidc()
    ;(mockPrisma as any).googlePlayPurchase.findUnique.mockResolvedValue(null)

    const res = await POST(req({
      authHeader: validAuthHeader(),
      token: RTDN_TOKEN,
      body: pubsubEnvelope({ voidedPurchaseNotification: { purchaseToken: 'tok-unknown' } }),
    }))

    expect(res.status).toBe(200)
    expect(mockWasPurchaseVoided).not.toHaveBeenCalled()
    expect(mockRefundCredits).not.toHaveBeenCalled()
  })

  test('skips refund when nothing was ever granted for that token', async () => {
    acceptOidc()
    ;(mockPrisma as any).googlePlayPurchase.findUnique.mockResolvedValue({
      id: 'gpp-1', userId: 'user-1', status: 'FAILED', creditsGranted: 0,
    })
    ;(mockPrisma as any).googlePlayPurchase.update.mockResolvedValue({})

    const res = await POST(req({
      authHeader: validAuthHeader(),
      token: RTDN_TOKEN,
      body: pubsubEnvelope({ voidedPurchaseNotification: { purchaseToken: 'tok-never-granted' } }),
    }))

    expect(res.status).toBe(200)
    expect(mockWasPurchaseVoided).not.toHaveBeenCalled()
    expect(mockRefundCredits).not.toHaveBeenCalled()
  })

  test('repeated delivery of the same notification calls refundCredits with the same idempotencyKey', async () => {
    acceptOidc()
    ;(mockPrisma as any).googlePlayPurchase.findUnique.mockResolvedValue({
      id: 'gpp-1', userId: 'user-1', status: 'GRANTED', creditsGranted: 2,
    })
    ;(mockPrisma as any).googlePlayPurchase.update.mockResolvedValue({})
    mockWasPurchaseVoided.mockResolvedValue(true)
    mockRefundCredits.mockResolvedValue({ id: 'w1', userId: 'user-1', balance: 0, lifetimePurchased: 2, lifetimeSpent: 0 })

    const body = pubsubEnvelope({ voidedPurchaseNotification: { purchaseToken: 'tok-redelivered', orderId: 'GPA.3' } })

    await POST(req({ authHeader: validAuthHeader(), token: RTDN_TOKEN, body }))
    await POST(req({ authHeader: validAuthHeader(), token: RTDN_TOKEN, body }))

    expect(mockRefundCredits).toHaveBeenCalledTimes(2)
    const [firstCallArgs] = mockRefundCredits.mock.calls[0]
    const [secondCallArgs] = mockRefundCredits.mock.calls[1]
    expect(firstCallArgs.idempotencyKey).toBe(secondCallArgs.idempotencyKey)
    // Real double-refund protection is refundCredits' own idempotencyKey
    // uniqueness constraint, covered in credit-wallet.test.ts — this test
    // only proves the route always derives the same key for the same token.
  })
})

describe('POST /api/credits/google-play/notifications — malformed input', () => {
  test('acks (200) on a malformed JSON body without throwing', async () => {
    acceptOidc()
    const badReq = {
      headers: { get: () => validAuthHeader() },
      nextUrl: { searchParams: { get: (name: string) => (name === 'token' ? RTDN_TOKEN : null) } },
      json: async () => { throw new Error('bad json') },
    } as unknown as NextRequest

    const res = await POST(badReq)
    expect(res.status).toBe(200)
  })

  test('acks (200) when the Pub/Sub envelope has no message.data', async () => {
    acceptOidc()
    const res = await POST(req({ authHeader: validAuthHeader(), token: RTDN_TOKEN, body: {} }))
    expect(res.status).toBe(200)
    expect(mockRefundCredits).not.toHaveBeenCalled()
  })
})
