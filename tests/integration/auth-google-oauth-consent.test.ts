// =============================================================================
// GET /api/auth/callback/google — Consent-Pending State
//
// Google OAuth shows no consent UI of its own. A freshly created (or
// existing) OAuth account must never be handed a fabricated "consent
// accepted" flag — hasCurrentConsent is computed from a real ConsentRecord
// read, the same guard every protected server route uses, so the handoff
// session accurately reflects whether the account may reach protected
// functionality yet.
// =============================================================================

import type { NextRequest } from 'next/server'

jest.mock('../../src/utils/canonical-origin', () => ({
  CANONICAL_GOOGLE_CALLBACK_URL: 'https://usedcarsdoctor.com/api/auth/callback/google',
  buildUrlForOrigin: jest.fn(),
  getProductionAuthConfigIssues: jest.fn().mockReturnValue([]),
  getAppOrigin: jest.fn().mockReturnValue('https://usedcarsdoctor.com'),
  getRequestOrigin: jest.fn().mockReturnValue('https://usedcarsdoctor.com'),
  shouldUseCanonicalHost: jest.fn().mockReturnValue(false),
}))

jest.mock('../../src/utils/auth.middleware', () => ({
  issueTokens: jest.fn().mockReturnValue({ accessToken: 'at', refreshToken: 'rt', expiresAt: Date.now() + 900_000 }),
}))

jest.mock('../../src/config/prisma', () => ({
  prisma: {
    user: { findUnique: jest.fn(), create: jest.fn(), update: jest.fn() },
    consentRecord: { findFirst: jest.fn() },
  },
}))

import { GET } from '../../src/app/api/auth/callback/google/route'
import { prisma as mockPrisma } from '../../src/config/prisma'

const GOOGLE_USER = { sub: 'google-1', email: 'oauth@example.com', name: 'OAuth User', email_verified: true }

function callbackReq(): NextRequest {
  return {
    headers: { get: () => null },
    nextUrl: {
      searchParams: {
        get: (key: string) => ({ code: 'auth-code', state: 'state-123' } as Record<string, string>)[key] ?? null,
      },
    },
    cookies: { get: (name: string) => (name === 'gauth_state' ? { value: 'state-123' } : undefined) },
  } as unknown as NextRequest
}

function decodeHandoffSession(res: Response): any {
  const setCookies = (res.headers as any).getSetCookie?.() ?? [res.headers.get('set-cookie') ?? '']
  const gauth = setCookies.find((c: string) => c.startsWith('gauth_session='))
  const raw = decodeURIComponent(gauth!.split(';')[0].slice('gauth_session='.length))
  return JSON.parse(raw)
}

beforeEach(() => {
  jest.clearAllMocks()
  process.env.GOOGLE_CLIENT_ID = 'client-id'
  process.env.GOOGLE_CLIENT_SECRET = 'client-secret'
  process.env.JWT_SECRET = 'test-secret'
  process.env.VERCEL_ENV = 'development'

  global.fetch = jest.fn()
    .mockResolvedValueOnce({ ok: true, json: async () => ({ access_token: 'gtok', id_token: 'idtok', token_type: 'Bearer' }) })
    .mockResolvedValueOnce({ ok: true, json: async () => GOOGLE_USER }) as any
})

describe('Google OAuth callback — consent flag', () => {
  test('a brand-new account (zero ConsentRecord rows) is handed off with hasCurrentConsent: false', async () => {
    ;(mockPrisma as any).user.findUnique.mockResolvedValue(null) // no match by googleId or email
    ;(mockPrisma as any).user.create.mockResolvedValue({
      id: 'user-new', email: GOOGLE_USER.email, name: GOOGLE_USER.name, avatarUrl: null,
      role: 'USER', preferredLanguage: 'en', countryCode: null, preferredCurrency: null,
      createdAt: new Date(),
    })
    ;(mockPrisma as any).consentRecord.findFirst.mockResolvedValue(null)

    const res = await GET(callbackReq())

    expect(res.status).toBe(307) // NextResponse.redirect default
    const session = decodeHandoffSession(res)
    expect(session.user.hasCurrentConsent).toBe(false)
  })

  test('an existing account with a current ConsentRecord is handed off with hasCurrentConsent: true', async () => {
    ;(mockPrisma as any).user.findUnique.mockResolvedValue({
      id: 'user-existing', email: GOOGLE_USER.email, name: GOOGLE_USER.name, avatarUrl: null,
      role: 'USER', preferredLanguage: 'en', countryCode: null, preferredCurrency: null,
      createdAt: new Date(), googleId: 'google-1',
    })
    const { CURRENT_TERMS_VERSION, CURRENT_PRIVACY_VERSION, CURRENT_RISK_ACK_VERSION } = require('../../src/lib/legal/legal-config')
    ;(mockPrisma as any).consentRecord.findFirst.mockResolvedValue({
      termsVersion: CURRENT_TERMS_VERSION,
      privacyVersion: CURRENT_PRIVACY_VERSION,
      riskAckVersion: CURRENT_RISK_ACK_VERSION,
      acceptedAt: new Date(),
    })

    const res = await GET(callbackReq())

    const session = decodeHandoffSession(res)
    expect(session.user.hasCurrentConsent).toBe(true)
  })
})
