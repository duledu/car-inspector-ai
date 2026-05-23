'use client'

import { useState, useEffect, Suspense } from 'react'
import type { CSSProperties } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { useTranslation } from 'react-i18next'
import { useUserStore } from '@/store'
import { SUPPORTED_LANGS, LANG_META, isSupportedLang, LANG_COOKIE } from '@/i18n/shared'
import type { SupportedLang } from '@/i18n/shared'
import { balanceHeadlineText } from '@/lib/typography'
import { COUNTRY_LIST, getCountryConfig } from '@/lib/markets/country-config'

type Tab = 'login' | 'register'

const balancedHeadlineStyle = {
  textWrap: 'balance',
  overflowWrap: 'normal',
  hyphens: 'manual',
} as CSSProperties

export default function AuthPage() {
  return (
    <Suspense>
      <AuthPageContent />
    </Suspense>
  )
}

function AuthPageContent() {
  const router       = useRouter()
  const searchParams = useSearchParams()
  const redirect     = searchParams.get('redirect') ?? '/dashboard'
  const urlError     = searchParams.get('error')
  const errorReason  = searchParams.get('reason')
  const { t }        = useTranslation()

  const { login, register, isAuthenticated, isLoading, error, clearError } = useUserStore()

  const [tab,              setTab]              = useState<Tab>('login')
  const [name,             setName]             = useState('')
  const [email,            setEmail]            = useState('')
  const [password,         setPassword]         = useState('')
  const [showPassword,     setShowPassword]      = useState(false)
  const [countryCode,      setCountryCode]      = useState('')
  const [countryTouched,   setCountryTouched]   = useState(false)
  const [consentAccepted,  setConsentAccepted]  = useState(false)
  const [consentTouched,   setConsentTouched]   = useState(false)
  const [lang,         setLang]         = useState<SupportedLang>(() => {
    if (typeof document === 'undefined') return 'en'
    const cookie = document.cookie.split('; ').find(r => r.startsWith(`${LANG_COOKIE}=`))
    const val = cookie ? decodeURIComponent(cookie.split('=')[1] ?? '') : null
    return isSupportedLang(val) ? val : 'en'
  })

  useEffect(() => { if (isAuthenticated) router.replace(redirect) }, [isAuthenticated])
  useEffect(() => {
    clearError()
    setCountryCode('')
    setCountryTouched(false)
    setConsentAccepted(false)
    setConsentTouched(false)
  }, [tab])
  useEffect(() => {
    if (urlError) {
      console.error('[auth/google] sign-in failed', {
        error: urlError,
        reason: errorReason ?? 'none',
      })
    }
  }, [urlError, errorReason])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    clearError()
    if (tab === 'register' && !consentAccepted) {
      setConsentTouched(true)
      return
    }
    if (tab === 'register' && !countryCode) {
      setCountryTouched(true)
      return
    }
    try {
      if (tab === 'login') {
        await login({ email, password })
      } else {
        const countryConfig = getCountryConfig(countryCode)
        await register({
          name,
          email,
          password,
          preferredLanguage: lang,
          country: countryConfig.name,
          countryCode,
          preferredCurrency: countryConfig.currency,
        })
      }
      router.replace(redirect)
    } catch { /* error shown via store */ }
  }

  const handleGoogleSignIn = async (e: React.MouseEvent<HTMLAnchorElement>) => {
    if (isLoading) {
      e.preventDefault()
      return
    }

    if ('serviceWorker' in navigator) {
      e.preventDefault()
      try {
        const registrations = await navigator.serviceWorker.getRegistrations()
        await Promise.all(registrations.map(registration => registration.unregister()))
      } catch {
        // Continue with OAuth even if service worker cleanup is unavailable.
      }
      window.location.assign('/api/auth/google/init')
    }
  }

  function submitLabel() {
    if (isLoading && tab === 'login') return t('auth.signingIn')
    if (isLoading)                    return t('auth.creatingAccount')
    if (tab === 'login')              return t('auth.signIn')
    return t('auth.createAccount')
  }

  const registerBlocked = tab === 'register' && (!countryCode || !consentAccepted)

  const inp: React.CSSProperties = {
    width: '100%', padding: '13px 14px', boxSizing: 'border-box',
    background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.09)',
    borderRadius: 11, fontSize: 15, color: '#fff', fontFamily: 'var(--font-sans)', outline: 'none',
    transition: 'border-color 0.15s, box-shadow 0.15s',
  }

  return (
    <div className="auth-root" style={{ minHeight: '100dvh', background: '#080c14', display: 'flex', fontFamily: 'var(--font-sans)', overflowX: 'hidden' }}>

      {/* Left — form column */}
      <div className="auth-form-column" style={{ flex: '0 0 auto', width: '100%', maxWidth: 480, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '24px 16px', position: 'relative', zIndex: 1 }}>

      {/* Background glow (left panel only) */}
      <div className="auth-glow-wrap" style={{ position: 'absolute', inset: 0, pointerEvents: 'none', overflow: 'hidden' }}>
        <div className="auth-glow" style={{ position: 'absolute', top: '-15%', left: '-5%',  width: 520, height: 520, borderRadius: '50%', background: 'rgba(34,211,238,0.035)', filter: 'blur(120px)' }} />
        <div className="auth-glow" style={{ position: 'absolute', bottom: '-15%', right: '-5%', width: 440, height: 440, borderRadius: '50%', background: 'rgba(129,140,248,0.035)', filter: 'blur(120px)' }} />
      </div>

      <div className="auth-card-shell" style={{ width: '100%', maxWidth: 400, position: 'relative', zIndex: 1 }}>

        {/* Brand */}
        <div className="auth-brand" style={{ textAlign: 'center', marginBottom: 28 }}>
          <Link href="/" style={{ textDecoration: 'none', display: 'inline-flex', flexDirection: 'column', alignItems: 'center', gap: 10 }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img className="auth-logo" src="/logo-icon.svg" alt="Used Cars Doctor" width={48} height={56} />
            <div className="auth-brand-title" style={{ fontSize: 20, fontWeight: 800, color: '#fff', letterSpacing: 0 }}>
              Used Cars Doctor
            </div>
          </Link>
          <div className="auth-tagline" style={{ fontSize: 13, color: 'rgba(255,255,255,0.32)', marginTop: 6 }}>
            {t('auth.tagline')}
          </div>
        </div>

        {/* Card */}
        <div className="auth-card" style={{ background: 'rgba(255,255,255,0.025)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 20, padding: '28px 28px 32px', backdropFilter: 'blur(20px)', WebkitBackdropFilter: 'blur(20px)' }}>

          {/* Tab switcher */}
          <div className="auth-tabbar" style={{ display: 'flex', background: 'rgba(255,255,255,0.04)', borderRadius: 11, padding: 4, marginBottom: 26, gap: 4 }}>
            {(['login', 'register'] as Tab[]).map(tabOption => (
              <button
                key={tabOption}
                onClick={() => setTab(tabOption)}
                style={{
                  flex: 1, minHeight: 42, padding: '9px 8px', borderRadius: 8, border: 'none', cursor: 'pointer',
                  fontFamily: 'var(--font-sans)', fontSize: 13, fontWeight: 600, transition: 'all 0.15s',
                  background: tab === tabOption ? 'rgba(255,255,255,0.09)' : 'transparent',
                  color:      tab === tabOption ? '#fff' : 'rgba(255,255,255,0.35)',
                  boxShadow:  tab === tabOption ? '0 1px 3px rgba(0,0,0,0.3)' : 'none',
                }}
              >
                {tabOption === 'login' ? t('auth.signIn') : t('auth.createAccount')}
              </button>
            ))}
          </div>

          {/* Google sign-in */}
          <a
            className="auth-google-button"
            href={isLoading ? undefined : '/api/auth/google/init'}
            onClick={handleGoogleSignIn}
            aria-disabled={isLoading}
            style={{
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10,
              minHeight: 46, padding: '12px 14px', width: '100%', boxSizing: 'border-box', borderRadius: 11, textDecoration: 'none',
              background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)',
              color: '#fff', fontSize: 14, fontWeight: 600, fontFamily: 'var(--font-sans)',
              transition: 'opacity 0.15s',
              opacity: isLoading ? 0.45 : 1,
              pointerEvents: isLoading ? 'none' : 'auto',
              cursor: isLoading ? 'default' : 'pointer',
            }}
          >
            <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden="true">
              <path fill="#EA4335" d="M24 9.5c3.1 0 5.8 1.1 8 2.9l6-6C34.3 3.1 29.4 1 24 1 14.9 1 7.2 6.5 3.8 14.3l7 5.4C12.5 13.5 17.8 9.5 24 9.5z"/>
              <path fill="#4285F4" d="M46.5 24.5c0-1.6-.1-3.1-.4-4.5H24v8.5h12.7c-.6 3-2.3 5.5-4.8 7.2l7.4 5.7C43.5 37.1 46.5 31.3 46.5 24.5z"/>
              <path fill="#FBBC05" d="M10.8 28.3A14.6 14.6 0 0 1 9.5 24c0-1.5.3-3 .7-4.3l-7-5.4A23.9 23.9 0 0 0 .5 24c0 3.9.9 7.5 2.7 10.7l7.6-6.4z"/>
              <path fill="#34A853" d="M24 47c5.4 0 9.9-1.8 13.2-4.8l-7.4-5.7c-1.8 1.2-4.1 2-5.8 2-6.2 0-11.5-4.2-13.4-10l-7.6 6.4C7.2 41.5 14.9 47 24 47z"/>
            </svg>
            {t('auth.googleContinue')}
          </a>

          {/* OR divider */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, margin: '4px 0' }}>
            <div style={{ flex: 1, height: 1, background: 'rgba(255,255,255,0.08)' }} />
            <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.25)', fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase' }}>
              {t('auth.orDivider')}
            </span>
            <div style={{ flex: 1, height: 1, background: 'rgba(255,255,255,0.08)' }} />
          </div>

          {/* URL error (e.g. from Google OAuth redirect) */}
          {urlError && (
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: 9, padding: '11px 13px', background: 'rgba(239,68,68,0.07)', border: '1px solid rgba(239,68,68,0.18)', borderRadius: 10, fontSize: 13, color: '#f87171', lineHeight: 1.4 }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0, marginTop: 1 }}>
                <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
              </svg>
              {t(`auth.error.${urlError}`, { defaultValue: t('auth.error.googleFailed') })}
            </div>
          )}

          <form className="auth-form" onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 13 }}>

            {/* Name — register only */}
            {tab === 'register' && (
              <div>
                <label htmlFor="auth-name" style={{ display: 'block', fontSize: 11, fontWeight: 600, color: 'rgba(255,255,255,0.38)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 7 }}>
                  {t('auth.fullName')}
                </label>
                <input
                  id="auth-name"
                  type="text"
                  value={name}
                  onChange={e => setName(e.target.value)}
                  placeholder={t('auth.namePlaceholder')}
                  required
                  style={inp}
                />
              </div>
            )}

            {/* Email */}
            <div>
              <label htmlFor="auth-email" style={{ display: 'block', fontSize: 11, fontWeight: 600, color: 'rgba(255,255,255,0.38)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 7 }}>
                {t('auth.email')}
              </label>
              <input
                id="auth-email"
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder={t('auth.emailPlaceholder')}
                required
                autoComplete="email"
                style={inp}
              />
            </div>

            {/* Password */}
            <div>
              <label htmlFor="auth-password" style={{ display: 'block', fontSize: 11, fontWeight: 600, color: 'rgba(255,255,255,0.38)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 7 }}>
                {t('auth.password')}
              </label>
              <div style={{ position: 'relative' }}>
                <input
                  id="auth-password"
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  placeholder={tab === 'register' ? t('auth.passwordNew') : t('auth.passwordCurrent')}
                  required
                  minLength={tab === 'register' ? 8 : undefined}
                  autoComplete={tab === 'login' ? 'current-password' : 'new-password'}
                  style={{ ...inp, paddingRight: 46 }}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(v => !v)}
                  tabIndex={-1}
                  aria-label={showPassword ? t('auth.hidePassword') : t('auth.showPassword')}
                  style={{ position: 'absolute', right: 4, top: '50%', transform: 'translateY(-50%)', width: 40, height: 40, background: 'none', border: 'none', cursor: 'pointer', padding: 0, color: 'rgba(255,255,255,0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                >
                  {showPassword ? (
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94"/>
                      <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19"/>
                      <line x1="1" y1="1" x2="23" y2="23"/>
                    </svg>
                  ) : (
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
                      <circle cx="12" cy="12" r="3"/>
                    </svg>
                  )}
                </button>
              </div>
            </div>

            {/* Error — store.error now holds a translation key */}
            {error && (
              <div role="alert" aria-live="polite" style={{ display: 'flex', alignItems: 'flex-start', gap: 9, padding: '11px 13px', background: 'rgba(239,68,68,0.07)', border: '1px solid rgba(239,68,68,0.18)', borderRadius: 10, fontSize: 13, color: '#f87171', lineHeight: 1.4 }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0, marginTop: 1 }}>
                  <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
                </svg>
                {t(error, { defaultValue: error })}
              </div>
            )}

            {/* Language preference — register tab only */}
            {tab === 'register' && (
              <div>
                <label htmlFor="auth-lang" style={{ display: 'block', fontSize: 11, fontWeight: 600, color: 'rgba(255,255,255,0.38)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 7 }}>
                  {t('auth.preferredLanguage')}
                </label>
                <select
                  id="auth-lang"
                  value={lang}
                  onChange={e => setLang(e.target.value as SupportedLang)}
                  style={{
                    width: '100%', padding: '13px 14px', boxSizing: 'border-box',
                    background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.09)',
                    borderRadius: 11, fontSize: 15, color: '#fff',
                    fontFamily: 'var(--font-sans)', outline: 'none', cursor: 'pointer',
                    appearance: 'auto', WebkitAppearance: 'menulist',
                  }}
                >
                  {SUPPORTED_LANGS.map(l => (
                    <option key={l} value={l} style={{ background: '#0d1420', color: '#fff' }}>
                      {LANG_META[l].full}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {/* Country / market location - register tab only */}
            {tab === 'register' && (
              <div>
                <label htmlFor="auth-country" style={{ display: 'block', fontSize: 11, fontWeight: 600, color: 'rgba(255,255,255,0.38)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 7 }}>
                  {t('auth.countryMarketLocation', { defaultValue: 'Country / Market Location' })}
                </label>
                <select
                  id="auth-country"
                  value={countryCode}
                  onChange={e => {
                    setCountryCode(e.target.value)
                    if (e.target.value) setCountryTouched(false)
                  }}
                  onBlur={() => setCountryTouched(true)}
                  required
                  aria-describedby="auth-country-help"
                  aria-invalid={countryTouched && !countryCode}
                  style={{
                    width: '100%', padding: '13px 14px', boxSizing: 'border-box',
                    background: 'rgba(255,255,255,0.04)',
                    border: `1px solid ${countryTouched && !countryCode ? 'rgba(239,68,68,0.45)' : 'rgba(255,255,255,0.09)'}`,
                    borderRadius: 11, fontSize: 15, color: countryCode ? '#fff' : 'rgba(255,255,255,0.42)',
                    fontFamily: 'var(--font-sans)', outline: 'none', cursor: 'pointer',
                    appearance: 'auto', WebkitAppearance: 'menulist',
                    boxShadow: countryTouched && !countryCode ? '0 0 0 3px rgba(239,68,68,0.08)' : 'none',
                  }}
                >
                  <option value="" style={{ background: '#0d1420', color: 'rgba(255,255,255,0.5)' }}>
                    {t('auth.selectCountryMarket', { defaultValue: 'Select your country / market' })}
                  </option>
                  {COUNTRY_LIST.map(country => (
                    <option key={country.code} value={country.code} style={{ background: '#0d1420', color: '#fff' }}>
                      {country.name} ({country.currency})
                    </option>
                  ))}
                </select>
                <p id="auth-country-help" style={{ margin: '7px 0 0', fontSize: 12, color: countryTouched && !countryCode ? '#f87171' : 'rgba(255,255,255,0.32)', lineHeight: 1.45 }}>
                  {countryTouched && !countryCode
                    ? t('auth.countryRequired', { defaultValue: 'Select your country / market location to continue.' })
                    : t('auth.countryMarketHelp', { defaultValue: 'Used to estimate average vehicle prices in your local market.' })}
                </p>
              </div>
            )}

            {/* Legal consent — register tab only */}
            {tab === 'register' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                <label
                  style={{
                    display: 'flex',
                    alignItems: 'flex-start',
                    gap: 12,
                    cursor: 'pointer',
                    padding: '11px 12px',
                    borderRadius: 10,
                    background: consentTouched && !consentAccepted ? 'rgba(239,68,68,0.05)' : 'rgba(255,255,255,0.025)',
                    border: `1px solid ${consentTouched && !consentAccepted ? 'rgba(239,68,68,0.28)' : 'rgba(255,255,255,0.08)'}`,
                    transition: 'border-color 0.15s, background 0.15s',
                  }}
                >
                  <span style={{ position: 'relative', width: 22, height: 22, flexShrink: 0, marginTop: 1 }}>
                    <input
                      type="checkbox"
                      id="auth-consent"
                      checked={consentAccepted}
                      onChange={e => {
                        setConsentAccepted(e.target.checked)
                        if (e.target.checked) setConsentTouched(false)
                      }}
                      style={{
                        position: 'absolute',
                        inset: 0,
                        width: 22,
                        height: 22,
                        margin: 0,
                        opacity: 0,
                        cursor: 'pointer',
                      }}
                    />
                    <span
                      aria-hidden="true"
                      style={{
                        width: 22,
                        height: 22,
                        borderRadius: 7,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        background: consentAccepted ? '#22d3ee' : 'rgba(255,255,255,0.045)',
                        border: `1px solid ${consentAccepted ? '#22d3ee' : 'rgba(255,255,255,0.2)'}`,
                        boxShadow: consentAccepted ? '0 0 0 3px rgba(34,211,238,0.12)' : 'inset 0 0 0 1px rgba(0,0,0,0.2)',
                        color: '#020617',
                        transition: 'background 0.15s, border-color 0.15s, box-shadow 0.15s',
                      }}
                    >
                      {consentAccepted && (
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                          <polyline points="20 6 9 17 4 12"/>
                        </svg>
                      )}
                    </span>
                  </span>
                  <span style={{ fontSize: 13, color: 'rgba(255,255,255,0.62)', lineHeight: 1.6 }}>
                    {t('auth.register.consentPre')}{' '}
                    <a href="/legal/terms" target="_blank" rel="noopener noreferrer"
                      style={{ color: '#22d3ee', textDecoration: 'none' }}
                      onClick={e => e.stopPropagation()}
                    >
                      {t('nav.terms')}
                    </a>
                    {' '}{t('auth.register.consentMid')}{' '}
                    <a href="/legal/privacy" target="_blank" rel="noopener noreferrer"
                      style={{ color: '#22d3ee', textDecoration: 'none' }}
                      onClick={e => e.stopPropagation()}
                    >
                      {t('nav.privacy')}
                    </a>
                    .
                  </span>
                </label>
                {consentTouched && !consentAccepted && (
                  <div role="alert" aria-live="polite" style={{ display: 'flex', alignItems: 'center', gap: 7, paddingLeft: 2, fontSize: 12, color: '#f87171' }}>
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" style={{ flexShrink: 0 }}>
                      <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
                    </svg>
                    {t('auth.register.consentError')}
                  </div>
                )}
              </div>
            )}

            {/* Forgot password — login tab only */}
            {tab === 'login' && (
              <div style={{ textAlign: 'right', marginTop: -4 }}>
                <Link href="/auth/forgot-password" style={{ fontSize: 12, color: 'rgba(255,255,255,0.35)', textDecoration: 'none' }}
                  onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = '#22d3ee' }}
                  onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = 'rgba(255,255,255,0.35)' }}
                >
                  {t('auth.forgotPasswordLink')}
                </Link>
              </div>
            )}

            {/* Submit */}
            <button
              type="submit"
              disabled={isLoading || registerBlocked}
              className="auth-submit"
              style={{
                marginTop: 4, minHeight: 48, padding: '14px 16px', width: '100%',
                background: isLoading || registerBlocked ? 'rgba(34,211,238,0.35)' : '#22d3ee',
                color: '#000', border: 'none', borderRadius: 11,
                fontSize: 14, fontWeight: 800, letterSpacing: 0,
                fontFamily: 'var(--font-sans)',
                cursor: isLoading || registerBlocked ? 'not-allowed' : 'pointer',
                transition: 'opacity 0.15s, background 0.15s',
              }}
            >
              {submitLabel()}
            </button>
          </form>
        </div>

        {/* Footer note */}
        <div className="auth-footer-note" style={{ textAlign: 'center', marginTop: 18, fontSize: 12, color: 'rgba(255,255,255,0.2)', lineHeight: 1.6 }}>
          <div>{t('auth.termsNote')}</div>
          <div style={{ marginTop: 6 }}>
            <Link href="/legal/terms" style={{ color: 'rgba(255,255,255,0.32)', textDecoration: 'none' }}
              onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = 'rgba(255,255,255,0.6)' }}
              onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = 'rgba(255,255,255,0.32)' }}
            >
              {t('nav.terms')}
            </Link>
            <span style={{ margin: '0 8px', color: 'rgba(255,255,255,0.12)' }}>·</span>
            <Link href="/legal/privacy" style={{ color: 'rgba(255,255,255,0.32)', textDecoration: 'none' }}
              onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = 'rgba(255,255,255,0.6)' }}
              onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = 'rgba(255,255,255,0.32)' }}
            >
              {t('nav.privacy')}
            </Link>
          </div>
        </div>
      </div>
      </div>{/* end left column */}

      {/* Right — cinematic image panel (hidden on mobile) */}
      <div style={{
        flex: 1, position: 'relative', overflow: 'hidden',
        display: 'none',
      }}
        className="auth-image-panel"
      >
        {/* Background car image */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/icons/cardoctorImg.jpg"
          alt=""
          style={{
            position: 'absolute', inset: 0, width: '130%', height: '100%',
            objectFit: 'cover',
            objectPosition: '70% center',
            right: 0, left: 'auto',
            filter: 'brightness(0.88) saturate(0.8) contrast(1.05)',
          }}
        />
        <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(135deg, rgba(8,12,20,0.68) 0%, rgba(8,12,20,0.42) 50%, rgba(8,12,20,0.60) 100%)' }} />
        <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to right, #080c14 0%, transparent 18%)' }} />
        <div style={{ position: 'absolute', inset: 0, background: 'radial-gradient(ellipse 110% 90% at 60% 50%, transparent 40%, rgba(4,8,18,0.5) 75%, rgba(4,8,18,0.78) 100%)' }} />

        {/* Panel content */}
        <div style={{ position: 'relative', zIndex: 1, height: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'flex-end', padding: '48px 48px' }}>
          {/* Brand mark */}
          <div style={{ marginBottom: 'auto', paddingTop: 48 }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: 'rgba(255,255,255,0.5)', letterSpacing: '0.12em', textTransform: 'uppercase', marginBottom: 10 }}>
              Used Cars Doctor
            </div>
          </div>

          {/* Quote */}
          <div>
            <div style={{ width: 32, height: 2, background: '#22d3ee', borderRadius: 2, marginBottom: 20 }} />
            <p style={{ ...balancedHeadlineStyle, fontSize: 'clamp(20px, 2.1vw, 24px)', fontWeight: 700, color: '#fff', letterSpacing: 0, lineHeight: 1.28, marginBottom: 16, maxWidth: 390 }}>
              {balanceHeadlineText(t('auth.heroTitle'))}<br />
              <span style={{ color: '#22d3ee' }}>{balanceHeadlineText(t('auth.heroTitleAccent'))}</span>
            </p>
            <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.42)', lineHeight: 1.6, maxWidth: 340 }}>
              {t('auth.heroSub')}
            </p>
          </div>
        </div>
      </div>

      <style>{`
        .auth-root {
          min-height: 100vh;
          min-height: 100dvh;
        }
        .auth-form-column {
          padding-top: max(24px, env(safe-area-inset-top));
          padding-bottom: max(24px, env(safe-area-inset-bottom));
        }
        .auth-card-shell {
          min-width: 0;
        }
        .auth-card,
        .auth-google-button,
        .auth-submit,
        .auth-tabbar button,
        .auth-footer-note {
          max-width: 100%;
        }
        .auth-footer-note a {
          display: inline-flex;
          min-height: 32px;
          align-items: center;
        }
        @media (min-width: 960px) {
          .auth-image-panel { display: block !important; }
        }
        @media (max-width: 520px) {
          .auth-form-column {
            max-width: none !important;
            justify-content: flex-start !important;
            padding: max(14px, env(safe-area-inset-top)) 12px max(18px, env(safe-area-inset-bottom)) !important;
          }
          .auth-brand {
            margin-bottom: 16px !important;
          }
          .auth-logo {
            width: 38px !important;
            height: auto !important;
          }
          .auth-brand-title {
            font-size: 18px !important;
          }
          .auth-tagline {
            font-size: 12px !important;
            line-height: 1.35 !important;
          }
          .auth-card {
            border-radius: 16px !important;
            padding: 18px 16px 20px !important;
          }
          .auth-tabbar {
            margin-bottom: 16px !important;
          }
          .auth-form {
            gap: 11px !important;
          }
          .auth-glow {
            width: 260px !important;
            height: 260px !important;
            filter: blur(82px) !important;
            opacity: 0.75;
          }
          .auth-footer-note {
            margin-top: 12px !important;
            font-size: 11px !important;
          }
        }
        @media (max-height: 700px) and (max-width: 520px) {
          .auth-brand {
            margin-bottom: 10px !important;
          }
          .auth-logo {
            width: 32px !important;
          }
          .auth-tagline {
            display: none !important;
          }
          .auth-card {
            padding: 14px 14px 16px !important;
          }
          .auth-tabbar {
            margin-bottom: 12px !important;
          }
          .auth-form {
            gap: 9px !important;
          }
          .auth-footer-note {
            margin-top: 8px !important;
          }
        }
        @media (orientation: landscape) and (max-height: 520px) {
          .auth-form-column {
            justify-content: flex-start !important;
            padding-top: 10px !important;
            padding-bottom: 10px !important;
          }
          .auth-brand {
            margin-bottom: 8px !important;
          }
          .auth-logo,
          .auth-tagline {
            display: none !important;
          }
          .auth-card {
            padding: 14px !important;
          }
        }
      `}</style>
    </div>
  )
}
