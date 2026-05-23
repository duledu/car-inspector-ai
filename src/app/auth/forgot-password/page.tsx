'use client'

import { useState, Suspense } from 'react'
import Link from 'next/link'
import { useTranslation } from 'react-i18next'
import { authApi } from '@/services/api/auth.api'

export default function ForgotPasswordPage() {
  return (
    <Suspense>
      <ForgotPasswordContent />
    </Suspense>
  )
}

function ForgotPasswordContent() {
  const { t } = useTranslation()
  const [email,     setEmail]     = useState('')
  const [submitted, setSubmitted] = useState(false)
  const [loading,   setLoading]   = useState(false)
  const [error,     setError]     = useState<string | null>(null)

  const inp: React.CSSProperties = {
    width: '100%', padding: '13px 14px', boxSizing: 'border-box',
    background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.09)',
    borderRadius: 11, fontSize: 15, color: '#fff', fontFamily: 'var(--font-sans)', outline: 'none',
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setLoading(true)
    try {
      await authApi.forgotPassword(email)
      setSubmitted(true)
    } catch {
      setError(t('auth.forgotPassword.error'))
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="auth-helper-root" style={{ minHeight: '100dvh', background: '#080c14', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'var(--font-sans)', padding: '24px 16px', overflowX: 'hidden' }}>
      <div style={{ width: '100%', maxWidth: 400, minWidth: 0 }}>

        <div className="auth-helper-brand" style={{ textAlign: 'center', marginBottom: 28 }}>
          <Link href="/" style={{ textDecoration: 'none', display: 'inline-flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img className="auth-helper-logo" src="/logo-icon.svg" alt="Used Cars Doctor" width={44} height={51} />
            <div className="auth-helper-title" style={{ fontSize: 20, fontWeight: 800, color: '#fff', letterSpacing: 0 }}>
              Used Cars Doctor
            </div>
          </Link>
        </div>

        <div className="auth-helper-card" style={{ background: 'rgba(255,255,255,0.025)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 20, padding: '28px 28px 32px' }}>

          {submitted ? (
            <div style={{ textAlign: 'center' }}>
              <div style={{ width: 48, height: 48, borderRadius: '50%', background: 'rgba(34,211,238,0.1)', border: '1px solid rgba(34,211,238,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 20px', color: '#22d3ee' }}>
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <rect width="20" height="16" x="2" y="4" rx="2"/><path d="m22 7-10 6L2 7"/>
                </svg>
              </div>
              <h2 style={{ margin: '0 0 10px', fontSize: 20, fontWeight: 800, color: '#fff' }}>
                {t('auth.forgotPassword.sentTitle')}
              </h2>
              <p style={{ margin: '0 0 24px', fontSize: 14, color: 'rgba(255,255,255,0.5)', lineHeight: 1.6 }}>
                {t('auth.forgotPassword.sentBody', { email })}
              </p>
              <Link href="/auth" style={{ color: '#22d3ee', fontSize: 14, textDecoration: 'none' }}>
                ← {t('auth.backToSignIn')}
              </Link>
            </div>
          ) : (
            <>
              <h2 style={{ margin: '0 0 8px', fontSize: 22, fontWeight: 800, color: '#fff' }}>
                {t('auth.forgotPassword.title')}
              </h2>
              <p style={{ margin: '0 0 24px', fontSize: 14, color: 'rgba(255,255,255,0.45)', lineHeight: 1.6 }}>
                {t('auth.forgotPassword.subtitle')}
              </p>

              <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                <div>
                  <label htmlFor="fp-email" style={{ display: 'block', fontSize: 11, fontWeight: 600, color: 'rgba(255,255,255,0.38)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 7 }}>
                    {t('auth.email')}
                  </label>
                  <input
                    id="fp-email"
                    type="email"
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                    placeholder={t('auth.emailPlaceholder')}
                    required
                    autoComplete="email"
                    style={inp}
                  />
                </div>

                {error && (
                  <div style={{ padding: '11px 13px', background: 'rgba(239,68,68,0.07)', border: '1px solid rgba(239,68,68,0.18)', borderRadius: 10, fontSize: 13, color: '#f87171' }}>
                    {error}
                  </div>
                )}

                <button
                  type="submit"
                  disabled={loading}
                  style={{ minHeight: 48, padding: '14px 16px', width: '100%', background: loading ? 'rgba(34,211,238,0.45)' : '#22d3ee', color: '#000', border: 'none', borderRadius: 11, fontSize: 14, fontWeight: 800, fontFamily: 'var(--font-sans)', cursor: loading ? 'not-allowed' : 'pointer' }}
                >
                  {loading ? t('auth.forgotPassword.sending') : t('auth.forgotPassword.submit')}
                </button>
              </form>

              <div style={{ textAlign: 'center', marginTop: 20 }}>
                <Link href="/auth" style={{ color: 'rgba(255,255,255,0.35)', fontSize: 13, textDecoration: 'none' }}>
                  ← {t('auth.backToSignIn')}
                </Link>
              </div>
            </>
          )}
        </div>
      </div>
      <style>{`
        .auth-helper-root {
          min-height: 100vh;
          min-height: 100dvh;
          padding-top: max(24px, env(safe-area-inset-top));
          padding-bottom: max(24px, env(safe-area-inset-bottom));
        }
        @media (max-width: 520px) {
          .auth-helper-root {
            align-items: flex-start !important;
            padding: max(16px, env(safe-area-inset-top)) 12px max(18px, env(safe-area-inset-bottom)) !important;
          }
          .auth-helper-brand {
            margin-bottom: 16px !important;
          }
          .auth-helper-logo {
            width: 36px !important;
            height: auto !important;
          }
          .auth-helper-title {
            font-size: 18px !important;
          }
          .auth-helper-card {
            border-radius: 16px !important;
            padding: 20px 16px 22px !important;
          }
        }
        @media (orientation: landscape) and (max-height: 520px) {
          .auth-helper-root {
            align-items: flex-start !important;
            padding-top: 10px !important;
            padding-bottom: 10px !important;
          }
          .auth-helper-brand {
            margin-bottom: 8px !important;
          }
          .auth-helper-logo {
            display: none !important;
          }
          .auth-helper-card {
            padding: 16px !important;
          }
        }
      `}</style>
    </div>
  )
}
