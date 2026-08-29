'use client'

// =============================================================================
// Consent-Required Gate
//
// Reached whenever AppShell (UX) detects `user.hasCurrentConsent === false`.
// Covers both cases uniformly: a Google OAuth account that never saw any
// consent UI, and an existing account re-consenting after a required legal-
// document version change. Historical data (vehicles, reports, credits) is
// untouched by this gate — it only blocks starting/continuing protected
// inspection functionality until acceptance is recorded, which the server
// enforces independently via requireCurrentConsent() regardless of what
// this page does.
// =============================================================================

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { useTranslation } from 'react-i18next'
import { useUserStore } from '@/store'
import { isRunningInTwa } from '@/utils/platform/is-twa'
import { ConsentCheckboxRow } from '@/components/legal/ConsentCheckboxRow'
import { CURRENT_TERMS_VERSION, CURRENT_PRIVACY_VERSION, CURRENT_RISK_ACK_VERSION } from '@/lib/legal/legal-config'

export default function ConsentRequiredPage() {
  const { t, i18n }     = useTranslation()
  const router          = useRouter()
  const { submitConsent, logout, isLoading, error, clearError } = useUserStore()

  const [consent1Accepted, setConsent1Accepted] = useState(false)
  const [consent1Touched,  setConsent1Touched]  = useState(false)
  const [consent2Accepted, setConsent2Accepted] = useState(false)
  const [consent2Touched,  setConsent2Touched]  = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    clearError()
    if (!consent1Accepted) { setConsent1Touched(true); return }
    if (!consent2Accepted) { setConsent2Touched(true); return }
    try {
      await submitConsent({
        termsAccepted: true,
        riskAckAccepted: true,
        termsVersion: CURRENT_TERMS_VERSION,
        privacyVersion: CURRENT_PRIVACY_VERSION,
        riskAckVersion: CURRENT_RISK_ACK_VERSION,
        locale: i18n.language,
        platform: isRunningInTwa() ? 'ANDROID' : 'WEB',
      })
      router.replace('/dashboard')
    } catch { /* error shown via store */ }
  }

  async function handleSignOut() {
    await logout()
    globalThis.location.href = '/auth'
  }

  return (
    <div style={{
      minHeight: '100vh',
      background: '#080c14',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      fontFamily: "-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif",
      padding: '24px 16px',
    }}>
      <div style={{ width: '100%', maxWidth: 480 }}>

        <div style={{ textAlign: 'center', marginBottom: 28 }}>
          <Link href="/" style={{ textDecoration: 'none', display: 'inline-block' }}>
            <div style={{ fontSize: 20, fontWeight: 800, color: '#fff', letterSpacing: '-0.5px' }}>
              Used Cars Doctor
            </div>
          </Link>
        </div>

        <form
          onSubmit={handleSubmit}
          style={{
            background: 'rgba(255,255,255,0.025)',
            border: '1px solid rgba(255,255,255,0.08)',
            borderRadius: 20,
            padding: '36px 28px',
          }}
        >
          <h1 style={{ margin: '0 0 10px', fontSize: 20, fontWeight: 800, color: '#fff', letterSpacing: '-0.4px', textAlign: 'center' }}>
            {t('legal.consentRequired.title')}
          </h1>
          <p style={{ margin: '0 0 8px', fontSize: 14, color: 'rgba(255,255,255,0.55)', lineHeight: 1.65, textAlign: 'center' }}>
            {t('legal.consentRequired.body')}
          </p>
          <p style={{ margin: '0 0 24px', fontSize: 12, color: 'rgba(34,211,238,0.7)', lineHeight: 1.6, textAlign: 'center' }}>
            {t('legal.consentRequired.accountNote')}
          </p>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 20 }}>
            <ConsentCheckboxRow
              id="consent-gate-terms"
              checked={consent1Accepted}
              touched={consent1Touched}
              onChange={checked => { setConsent1Accepted(checked); if (checked) setConsent1Touched(false) }}
              errorText={t('auth.register.consent1Error')}
              label={
                <>
                  {t('auth.register.consent1Pre')}{' '}
                  <a href="/legal/terms" target="_blank" rel="noopener noreferrer"
                    style={{ color: '#22d3ee', textDecoration: 'none' }}
                    onClick={e => e.stopPropagation()}
                  >
                    {t('nav.terms')}
                  </a>
                  {' '}{t('auth.register.consent1Mid')}{' '}
                  <a href="/legal/privacy" target="_blank" rel="noopener noreferrer"
                    style={{ color: '#22d3ee', textDecoration: 'none' }}
                    onClick={e => e.stopPropagation()}
                  >
                    {t('nav.privacy')}
                  </a>
                  .
                </>
              }
            />
            <ConsentCheckboxRow
              id="consent-gate-risk"
              checked={consent2Accepted}
              touched={consent2Touched}
              onChange={checked => { setConsent2Accepted(checked); if (checked) setConsent2Touched(false) }}
              errorText={t('auth.register.consent2Error')}
              label={<span style={{ fontWeight: 600, color: 'rgba(255,255,255,0.78)' }}>{t('legal.riskAck.checkbox2')}</span>}
            />
          </div>

          {error && (
            <div style={{
              padding: '10px 14px', background: 'rgba(239,68,68,0.07)', border: '1px solid rgba(239,68,68,0.18)',
              borderRadius: 10, fontSize: 13, color: '#f87171', marginBottom: 16,
            }}>
              {t(error, { defaultValue: t('legal.consentRequired.error') })}
            </div>
          )}

          <button
            type="submit"
            disabled={isLoading}
            style={{
              width: '100%', padding: '14px 0', background: isLoading ? 'rgba(34,211,238,0.4)' : '#22d3ee',
              color: '#000', border: 'none', borderRadius: 11, fontSize: 14, fontWeight: 800,
              cursor: isLoading ? 'not-allowed' : 'pointer', marginBottom: 14, fontFamily: 'inherit',
            }}
          >
            {isLoading ? t('legal.consentRequired.submitting') : t('legal.consentRequired.submit')}
          </button>

          <div style={{ textAlign: 'center' }}>
            <button
              type="button"
              onClick={handleSignOut}
              style={{
                background: 'none', border: 'none', padding: 0, fontSize: 13,
                color: 'rgba(255,255,255,0.3)', cursor: 'pointer', textDecoration: 'underline', fontFamily: 'inherit',
              }}
            >
              {t('legal.consentRequired.signOut')}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
