import type { NextRequest } from 'next/server'
import { getRequestMeta, recordConsent } from '@/lib/legal/consent-record'
import {
  CURRENT_TERMS_VERSION,
  CURRENT_PRIVACY_VERSION,
  CURRENT_RISK_ACK_VERSION,
  CONSENT_FORM_VERSION,
} from '@/lib/legal/legal-config'

function reqWithHeaders(headers: Record<string, string>): NextRequest {
  return {
    headers: { get: (name: string) => headers[name.toLowerCase()] ?? null },
  } as unknown as NextRequest
}

describe('getRequestMeta', () => {
  it('extracts the first address from x-forwarded-for', () => {
    const meta = getRequestMeta(reqWithHeaders({ 'x-forwarded-for': '1.2.3.4, 5.6.7.8', 'user-agent': 'test-ua' }))
    expect(meta.ipAddress).toBe('1.2.3.4')
    expect(meta.userAgent).toBe('test-ua')
  })

  it('falls back to x-real-ip when x-forwarded-for is absent', () => {
    const meta = getRequestMeta(reqWithHeaders({ 'x-real-ip': '9.9.9.9' }))
    expect(meta.ipAddress).toBe('9.9.9.9')
  })

  it('returns null fields when no relevant headers are present', () => {
    const meta = getRequestMeta(reqWithHeaders({}))
    expect(meta.ipAddress).toBeNull()
    expect(meta.userAgent).toBeNull()
  })
})

describe('recordConsent', () => {
  it('always writes the CURRENT_* versions, ignoring anything a caller might otherwise supply', async () => {
    const create = jest.fn().mockResolvedValue({ id: 'consent-1' })
    const client = { consentRecord: { create } } as any

    await recordConsent(
      {
        userId: 'user-1',
        locale: 'sr',
        platform: 'ANDROID',
        meta: { ipAddress: '1.1.1.1', userAgent: 'ua' },
      },
      client,
    )

    expect(create).toHaveBeenCalledWith({
      data: {
        userId: 'user-1',
        userIdSnapshot: 'user-1',
        termsVersion: CURRENT_TERMS_VERSION,
        privacyVersion: CURRENT_PRIVACY_VERSION,
        riskAckVersion: CURRENT_RISK_ACK_VERSION,
        locale: 'sr',
        platform: 'ANDROID',
        formVersion: CONSENT_FORM_VERSION,
        ipAddress: '1.1.1.1',
        userAgent: 'ua',
      },
    })
  })

  it('works with a transaction client the same way as the top-level client', async () => {
    const create = jest.fn().mockResolvedValue({ id: 'consent-2' })
    const tx = { consentRecord: { create } } as any

    await recordConsent(
      { userId: 'user-2', locale: 'en', platform: 'WEB', meta: { ipAddress: null, userAgent: null } },
      tx,
    )

    expect(create).toHaveBeenCalledTimes(1)
    expect(create.mock.calls[0][0].data.userIdSnapshot).toBe('user-2')
  })
})
