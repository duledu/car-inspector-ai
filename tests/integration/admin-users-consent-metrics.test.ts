// =============================================================================
// GET /api/admin/users — consent-aware metrics
//
// Fixes an audit finding: the admin "registered"/"verified" counts used to
// treat every User row identically, so a Google OAuth account created with
// zero consent UI (emailVerified is set by Google immediately, independent
// of any Terms/risk-ack acceptance) was indistinguishable from a real,
// fully active user. ConsentRecord remains the only source of truth — this
// route derives everything from it via isConsentCurrent(), the exact same
// comparison requireCurrentConsent() uses on every protected route, applied
// here to a bulk "latest record per user" query instead of a single-user one.
// =============================================================================

import type { NextRequest } from 'next/server'

jest.mock('../../src/lib/admin/admin-guard', () => ({
  requireAdmin: jest.fn(),
}))

jest.mock('../../src/config/prisma', () => ({
  prisma: {
    user: { findMany: jest.fn() },
    consentRecord: { findMany: jest.fn() },
  },
}))

import { GET } from '../../src/app/api/admin/users/route'
import { requireAdmin } from '../../src/lib/admin/admin-guard'
import { prisma as mockPrisma } from '../../src/config/prisma'
import {
  CURRENT_TERMS_VERSION,
  CURRENT_PRIVACY_VERSION,
  CURRENT_RISK_ACK_VERSION,
} from '../../src/lib/legal/legal-config'

const mockRequireAdmin = requireAdmin as jest.Mock

function req(): NextRequest {
  return {} as unknown as NextRequest
}

function currentVersions() {
  return {
    termsVersion: CURRENT_TERMS_VERSION,
    privacyVersion: CURRENT_PRIVACY_VERSION,
    riskAckVersion: CURRENT_RISK_ACK_VERSION,
  }
}

function staleVersions() {
  return { termsVersion: 'stale-2020-01-01', privacyVersion: 'stale-2020-01-01', riskAckVersion: 'stale-2020-01-01' }
}

beforeEach(() => {
  jest.clearAllMocks()
  mockRequireAdmin.mockResolvedValue({ success: true, adminEmail: 'admin@test.com' })
})

describe('GET /api/admin/users — consent metrics', () => {
  test('a user with no consent (never accepted anything) is excluded from total/registered', async () => {
    ;(mockPrisma as any).user.findMany
      .mockResolvedValueOnce([{ id: 'u-no-consent', emailVerified: new Date() }]) // allUsers
      .mockResolvedValueOnce([]) // recentUsers
    ;(mockPrisma as any).consentRecord.findMany.mockResolvedValue([]) // never consented

    const res = await GET(req())
    const body = await res.json()

    expect(body.data.stats.total).toBe(0)
    expect(body.data.stats.noConsent).toBe(1)
    expect(body.data.stats.staleConsent).toBe(0)
    expect(body.data.stats.currentConsent).toBe(0)
    expect(body.data.stats.verified).toBe(0)
  })

  test('a user with stale consent (accepted an old version) counts toward total but not verified', async () => {
    ;(mockPrisma as any).user.findMany
      .mockResolvedValueOnce([{ id: 'u-stale', emailVerified: new Date() }])
      .mockResolvedValueOnce([])
    ;(mockPrisma as any).consentRecord.findMany.mockResolvedValue([
      { userId: 'u-stale', ...staleVersions() },
    ])

    const res = await GET(req())
    const body = await res.json()

    expect(body.data.stats.total).toBe(1)
    expect(body.data.stats.staleConsent).toBe(1)
    expect(body.data.stats.currentConsent).toBe(0)
    expect(body.data.stats.noConsent).toBe(0)
    // Registered but not current — must not be counted as verified/active
    // even though their email is verified.
    expect(body.data.stats.verified).toBe(0)
    expect(body.data.stats.unverified).toBe(1)
  })

  test('a user with current valid consent and a verified email counts as verified/active', async () => {
    ;(mockPrisma as any).user.findMany
      .mockResolvedValueOnce([{ id: 'u-current', emailVerified: new Date() }])
      .mockResolvedValueOnce([])
    ;(mockPrisma as any).consentRecord.findMany.mockResolvedValue([
      { userId: 'u-current', ...currentVersions() },
    ])

    const res = await GET(req())
    const body = await res.json()

    expect(body.data.stats.total).toBe(1)
    expect(body.data.stats.currentConsent).toBe(1)
    expect(body.data.stats.staleConsent).toBe(0)
    expect(body.data.stats.noConsent).toBe(0)
    expect(body.data.stats.verified).toBe(1)
    expect(body.data.stats.unverified).toBe(0)
  })

  test('a Google OAuth consent-pending shell is not counted as a registered/verified user', async () => {
    // Exactly the OAuth callback's upsertGoogleUser() shape: emailVerified is
    // set by Google immediately, with zero ConsentRecord rows at all.
    ;(mockPrisma as any).user.findMany
      .mockResolvedValueOnce([{ id: 'oauth-shell', emailVerified: new Date() }])
      .mockResolvedValueOnce([{
        id: 'oauth-shell', email: 'oauth@test.com', name: 'OAuth User',
        emailVerified: new Date(), createdAt: new Date(), role: 'USER',
      }])
    ;(mockPrisma as any).consentRecord.findMany.mockResolvedValue([])

    const res = await GET(req())
    const body = await res.json()

    expect(body.data.stats.total).toBe(0)
    expect(body.data.stats.noConsent).toBe(1)
    expect(body.data.stats.verified).toBe(0)

    const recent = body.data.recentUsers.find((u: any) => u.id === 'oauth-shell')
    expect(recent.hasCurrentConsent).toBe(false)
    expect(recent.isConsentPending).toBe(true)
  })

  test('recentUsers carries hasCurrentConsent/isConsentPending derived from the same map used for the aggregate counts', async () => {
    ;(mockPrisma as any).user.findMany
      .mockResolvedValueOnce([
        { id: 'u-current', emailVerified: new Date() },
        { id: 'u-stale', emailVerified: new Date() },
        { id: 'u-none', emailVerified: new Date() },
      ])
      .mockResolvedValueOnce([
        { id: 'u-current', email: 'a@test.com', name: 'A', emailVerified: new Date(), createdAt: new Date(), role: 'USER' },
        { id: 'u-stale', email: 'b@test.com', name: 'B', emailVerified: new Date(), createdAt: new Date(), role: 'USER' },
        { id: 'u-none', email: 'c@test.com', name: 'C', emailVerified: new Date(), createdAt: new Date(), role: 'USER' },
      ])
    ;(mockPrisma as any).consentRecord.findMany.mockResolvedValue([
      { userId: 'u-current', ...currentVersions() },
      { userId: 'u-stale', ...staleVersions() },
    ])

    const res = await GET(req())
    const body = await res.json()
    const byId = Object.fromEntries(body.data.recentUsers.map((u: any) => [u.id, u]))

    expect(byId['u-current']).toMatchObject({ hasCurrentConsent: true, isConsentPending: false })
    expect(byId['u-stale']).toMatchObject({ hasCurrentConsent: false, isConsentPending: true })
    expect(byId['u-none']).toMatchObject({ hasCurrentConsent: false, isConsentPending: true })
  })

  test('401/403s when the caller is not an admin, before any user data is queried', async () => {
    const { apiError } = require('../../src/utils/api-response')
    mockRequireAdmin.mockResolvedValue({ success: false, response: apiError('Forbidden', { status: 403, code: 'FORBIDDEN' }) })

    const res = await GET(req())

    expect(res.status).toBe(403)
    expect((mockPrisma as any).user.findMany).not.toHaveBeenCalled()
    expect((mockPrisma as any).consentRecord.findMany).not.toHaveBeenCalled()
  })
})
