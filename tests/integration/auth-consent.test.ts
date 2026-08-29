// =============================================================================
// POST /api/auth/register, /api/auth/consent — Consent Enforcement
//
// Server-side consent is authoritative: registration and the post-OAuth
// consent endpoint must never accept a client's say-so about which legal
// document versions were shown. Both reject anything other than the exact
// CURRENT_* versions, and registration only ever creates a User row and its
// ConsentRecord atomically (never one without the other).
// =============================================================================

import type { NextRequest } from 'next/server'
import {
  CURRENT_TERMS_VERSION,
  CURRENT_PRIVACY_VERSION,
  CURRENT_RISK_ACK_VERSION,
  CONSENT_FORM_VERSION,
} from '../../src/lib/legal/legal-config'

jest.mock('../../src/utils/auth.middleware', () => ({
  requireAuth: jest.fn(),
  issueTokens: jest.fn().mockReturnValue({ accessToken: 'at', refreshToken: 'rt', expiresAt: Date.now() + 900_000 }),
}))

jest.mock('../../src/lib/email/senders/send-verify-email', () => ({
  sendVerifyEmail: jest.fn().mockResolvedValue({ success: true, messageId: 'm1' }),
}))

jest.mock('../../src/config/prisma', () => ({
  prisma: {
    user: { findUnique: jest.fn(), create: jest.fn(), delete: jest.fn() },
    consentRecord: { findFirst: jest.fn(), create: jest.fn() },
    $transaction: jest.fn(),
  },
}))

import { POST } from '../../src/app/api/auth/[action]/route'
import { requireAuth } from '../../src/utils/auth.middleware'
import { sendVerifyEmail } from '../../src/lib/email/senders/send-verify-email'
import { prisma as mockPrisma } from '../../src/config/prisma'

const mockRequireAuth = requireAuth as jest.Mock
const mockSendVerifyEmail = sendVerifyEmail as jest.Mock

function postReq(action: string, body: unknown): [NextRequest, { params: { action: string } }] {
  const req = {
    json: async () => body,
    headers: { get: () => null },
    cookies: { get: () => undefined },
  } as unknown as NextRequest
  return [req, { params: { action } }]
}

const VALID_REGISTER_BODY = {
  name: 'Test User',
  email: 'new@example.com',
  password: 'password123',
  countryCode: 'RS',
  termsAccepted: true,
  riskAckAccepted: true,
  termsVersion: CURRENT_TERMS_VERSION,
  privacyVersion: CURRENT_PRIVACY_VERSION,
  riskAckVersion: CURRENT_RISK_ACK_VERSION,
}

const NEW_USER_ROW = {
  id: 'user-new',
  email: 'new@example.com',
  name: 'Test User',
  avatarUrl: null,
  role: 'USER',
  preferredLanguage: 'en',
  countryCode: 'RS',
  preferredCurrency: 'EUR',
  emailVerified: null,
  createdAt: new Date(),
}

beforeEach(() => {
  jest.clearAllMocks()
  ;(mockPrisma as any).user.findUnique.mockResolvedValue(null)
  ;(mockPrisma as any).consentRecord.findFirst.mockResolvedValue(null)
  ;(mockPrisma as any).consentRecord.create.mockResolvedValue({ id: 'consent-1' })
  ;(mockPrisma as any).$transaction.mockImplementation(async (fn: any) => fn(mockPrisma))
  ;(mockPrisma as any).user.create.mockResolvedValue(NEW_USER_ROW)
  mockSendVerifyEmail.mockResolvedValue({ success: true, messageId: 'm1' })
})

describe('POST /api/auth/register — consent gating', () => {
  test('rejects registration missing termsAccepted', async () => {
    const { termsAccepted, ...rest } = VALID_REGISTER_BODY
    const res = await POST(...postReq('register', rest))
    expect(res.status).toBe(422)
    expect(mockPrisma.user.create).not.toHaveBeenCalled()
  })

  test('rejects registration missing riskAckAccepted', async () => {
    const { riskAckAccepted, ...rest } = VALID_REGISTER_BODY
    const res = await POST(...postReq('register', rest))
    expect(res.status).toBe(422)
    expect(mockPrisma.user.create).not.toHaveBeenCalled()
  })

  test('rejects registration where termsAccepted is present but false', async () => {
    const res = await POST(...postReq('register', { ...VALID_REGISTER_BODY, termsAccepted: false }))
    expect(res.status).toBe(422)
    expect(mockPrisma.user.create).not.toHaveBeenCalled()
  })

  test('rejects a forged/stale termsVersion even when both checkboxes are true', async () => {
    const res = await POST(...postReq('register', { ...VALID_REGISTER_BODY, termsVersion: '2020-01-01' }))
    expect(res.status).toBe(422)
    const body = await res.json()
    expect(body.code).toBe('CONSENT_VERSION_MISMATCH')
    expect(mockPrisma.user.create).not.toHaveBeenCalled()
  })

  test('rejects a forged/stale riskAckVersion', async () => {
    const res = await POST(...postReq('register', { ...VALID_REGISTER_BODY, riskAckVersion: 'not-current' }))
    expect(res.status).toBe(422)
    const body = await res.json()
    expect(body.code).toBe('CONSENT_VERSION_MISMATCH')
  })

  test('rejects a forged/stale privacyVersion', async () => {
    const res = await POST(...postReq('register', { ...VALID_REGISTER_BODY, privacyVersion: 'not-current' }))
    expect(res.status).toBe(422)
    const body = await res.json()
    expect(body.code).toBe('CONSENT_VERSION_MISMATCH')
  })

  test('a valid registration creates the user and records consent atomically, in the same transaction', async () => {
    const res = await POST(...postReq('register', VALID_REGISTER_BODY))

    expect(res.status).toBe(201)
    expect(mockPrisma.$transaction).toHaveBeenCalledTimes(1)
    expect(mockPrisma.user.create).toHaveBeenCalledTimes(1)
    expect(mockPrisma.consentRecord.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        userId: 'user-new',
        userIdSnapshot: 'user-new',
        termsVersion: CURRENT_TERMS_VERSION,
        privacyVersion: CURRENT_PRIVACY_VERSION,
        riskAckVersion: CURRENT_RISK_ACK_VERSION,
        formVersion: CONSENT_FORM_VERSION,
        platform: 'WEB',
      }),
    })
  })

  test('the returned user DTO reflects current consent immediately after registration', async () => {
    ;(mockPrisma as any).consentRecord.findFirst.mockResolvedValue({
      termsVersion: CURRENT_TERMS_VERSION,
      privacyVersion: CURRENT_PRIVACY_VERSION,
      riskAckVersion: CURRENT_RISK_ACK_VERSION,
      acceptedAt: new Date(),
    })
    const res = await POST(...postReq('register', VALID_REGISTER_BODY))
    const body = await res.json()
    expect(body.data.user.hasCurrentConsent).toBe(true)
  })
})

describe('POST /api/auth/consent — re-consent / OAuth zero-consent path', () => {
  const EXISTING_USER = { ...NEW_USER_ROW, id: 'user-existing' }

  beforeEach(() => {
    mockRequireAuth.mockResolvedValue({ success: true, userId: 'user-existing', email: 'x@test.com', role: 'USER', emailVerified: true })
    ;(mockPrisma as any).user.findUnique.mockResolvedValue(EXISTING_USER)
  })

  test('401s when unauthenticated — cannot record consent for an unverified identity', async () => {
    mockRequireAuth.mockResolvedValue({ success: false, reason: 'Missing auth cookie' })
    const res = await POST(...postReq('consent', {
      termsAccepted: true, riskAckAccepted: true,
      termsVersion: CURRENT_TERMS_VERSION, privacyVersion: CURRENT_PRIVACY_VERSION, riskAckVersion: CURRENT_RISK_ACK_VERSION,
    }))
    expect(res.status).toBe(401)
  })

  test('rejects a stale version on re-consent the same way registration does', async () => {
    const res = await POST(...postReq('consent', {
      termsAccepted: true, riskAckAccepted: true,
      termsVersion: 'old', privacyVersion: CURRENT_PRIVACY_VERSION, riskAckVersion: CURRENT_RISK_ACK_VERSION,
    }))
    expect(res.status).toBe(422)
    expect(mockPrisma.consentRecord.create).not.toHaveBeenCalled()
  })

  test('a Google OAuth account (zero ConsentRecord rows) can reach current consent via this endpoint', async () => {
    // Starts with no ConsentRecord (OAuth account is consent-pending); after
    // recordConsent() writes the new row, the DTO's fresh read reflects it —
    // simulated here by resolving to the just-written record.
    ;(mockPrisma as any).consentRecord.findFirst.mockResolvedValue({
      termsVersion: CURRENT_TERMS_VERSION,
      privacyVersion: CURRENT_PRIVACY_VERSION,
      riskAckVersion: CURRENT_RISK_ACK_VERSION,
      acceptedAt: new Date(),
    })

    const res = await POST(...postReq('consent', {
      termsAccepted: true, riskAckAccepted: true,
      termsVersion: CURRENT_TERMS_VERSION, privacyVersion: CURRENT_PRIVACY_VERSION, riskAckVersion: CURRENT_RISK_ACK_VERSION,
      platform: 'ANDROID',
    }))

    expect(res.status).toBe(200)
    expect(mockPrisma.consentRecord.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ userId: 'user-existing', platform: 'ANDROID' }),
    })
    const body = await res.json()
    expect(body.data.hasCurrentConsent).toBe(true)
  })

  test('never fabricates acceptance — omitting the required checkbox fields is rejected, not defaulted', async () => {
    const res = await POST(...postReq('consent', {
      termsVersion: CURRENT_TERMS_VERSION, privacyVersion: CURRENT_PRIVACY_VERSION, riskAckVersion: CURRENT_RISK_ACK_VERSION,
    }))
    expect(res.status).toBe(422)
    expect(mockPrisma.consentRecord.create).not.toHaveBeenCalled()
  })
})
