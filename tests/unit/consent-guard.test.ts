import {
  CURRENT_TERMS_VERSION,
  CURRENT_PRIVACY_VERSION,
  CURRENT_RISK_ACK_VERSION,
} from '@/lib/legal/legal-config'

describe('consent guard', () => {
  const prismaMock = {
    consentRecord: { findFirst: jest.fn() },
  }

  beforeEach(() => {
    jest.resetModules()
    jest.clearAllMocks()
    jest.doMock('@/config/prisma', () => ({ prisma: prismaMock }))
  })

  it('has no current consent when the user has never accepted anything', async () => {
    const { hasCurrentConsent } = await import('@/lib/legal/consent-guard')
    prismaMock.consentRecord.findFirst.mockResolvedValue(null)

    const result = await hasCurrentConsent('user-1')

    expect(result).toEqual({ hasCurrentConsent: false, latestRecord: null })
  })

  it('has current consent when the latest record matches all three current versions', async () => {
    const { hasCurrentConsent } = await import('@/lib/legal/consent-guard')
    const record = {
      termsVersion: CURRENT_TERMS_VERSION,
      privacyVersion: CURRENT_PRIVACY_VERSION,
      riskAckVersion: CURRENT_RISK_ACK_VERSION,
      acceptedAt: new Date(),
    }
    prismaMock.consentRecord.findFirst.mockResolvedValue(record)

    const result = await hasCurrentConsent('user-1')

    expect(result.hasCurrentConsent).toBe(true)
    expect(result.latestRecord).toEqual(record)
  })

  it.each([
    ['termsVersion', 'stale-terms'],
    ['privacyVersion', 'stale-privacy'],
    ['riskAckVersion', 'stale-risk-ack'],
  ])('does not have current consent when only %s is stale', async (field, staleValue) => {
    const { hasCurrentConsent } = await import('@/lib/legal/consent-guard')
    const record = {
      termsVersion: CURRENT_TERMS_VERSION,
      privacyVersion: CURRENT_PRIVACY_VERSION,
      riskAckVersion: CURRENT_RISK_ACK_VERSION,
      acceptedAt: new Date(),
      [field]: staleValue,
    }
    prismaMock.consentRecord.findFirst.mockResolvedValue(record)

    const result = await hasCurrentConsent('user-1')

    expect(result.hasCurrentConsent).toBe(false)
  })

  it('reads the most recent record, not just any record', async () => {
    const { hasCurrentConsent } = await import('@/lib/legal/consent-guard')
    prismaMock.consentRecord.findFirst.mockResolvedValue(null)

    await hasCurrentConsent('user-1')

    expect(prismaMock.consentRecord.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { userId: 'user-1' },
        orderBy: { acceptedAt: 'desc' },
      }),
    )
  })

  it('requireCurrentConsent returns null (proceed) when consent is current', async () => {
    const { requireCurrentConsent } = await import('@/lib/legal/consent-guard')
    prismaMock.consentRecord.findFirst.mockResolvedValue({
      termsVersion: CURRENT_TERMS_VERSION,
      privacyVersion: CURRENT_PRIVACY_VERSION,
      riskAckVersion: CURRENT_RISK_ACK_VERSION,
      acceptedAt: new Date(),
    })

    const result = await requireCurrentConsent('user-1')

    expect(result).toBeNull()
  })

  it('requireCurrentConsent returns a 403 CONSENT_REQUIRED response when consent is missing', async () => {
    const { requireCurrentConsent } = await import('@/lib/legal/consent-guard')
    prismaMock.consentRecord.findFirst.mockResolvedValue(null)

    const result = await requireCurrentConsent('user-1')

    expect(result).not.toBeNull()
    expect(result!.status).toBe(403)
    const body = await result!.json()
    expect(body.code).toBe('CONSENT_REQUIRED')
  })
})
