'use client'

import { useState, useEffect, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { useUserStore } from '@/store'

type Tab = 'login' | 'register'

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

  const { login, register, isAuthenticated, isLoading, error, clearError } = useUserStore()

  const [tab,          setTab]          = useState<Tab>('login')
  const [name,         setName]         = useState('')
  const [email,        setEmail]        = useState('')
  const [password,     setPassword]     = useState('')
  const [showPassword, setShowPassword] = useState(false)

  useEffect(() => { if (isAuthenticated) router.replace(redirect) }, [isAuthenticated])
  useEffect(() => { clearError() },                                   [tab])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    clearError()
    try {
      if (tab === 'login') await login({ email, password })
      else                 await register({ name, email, password })
      router.replace(redirect)
    } catch { /* error shown via store */ }
  }

  function submitLabel() {
    if (isLoading && tab === 'login')    return 'Signing in…'
    if (isLoading)                       return 'Creating account…'
    if (tab === 'login')                 return 'Sign In'
    return 'Create Account'
  }

  const inp: React.CSSProperties = {
    width: '100%', padding: '13px 14px', boxSizing: 'border-box',
    background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.09)',
    borderRadius: 11, fontSize: 15, color: '#fff', fontFamily: 'var(--font-sans)', outline: 'none',
    transition: 'border-color 0.15s, box-shadow 0.15s',
  }

  return (
    <div style={{ minHeight: '100vh', background: '#080c14', display: 'flex', fontFamily: 'var(--font-sans)' }}>

      {/* Left — form column */}
      <div style={{ flex: '0 0 auto', width: '100%', maxWidth: 480, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '24px 16px', position: 'relative', zIndex: 1 }}>

      {/* Background glow (left panel only) */}
      <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none', overflow: 'hidden' }}>
        <div style={{ position: 'absolute', top: '-15%', left: '-5%',  width: 520, height: 520, borderRadius: '50%', background: 'rgba(34,211,238,0.035)', filter: 'blur(120px)' }} />
        <div style={{ position: 'absolute', bottom: '-15%', right: '-5%', width: 440, height: 440, borderRadius: '50%', background: 'rgba(129,140,248,0.035)', filter: 'blur(120px)' }} />
      </div>

      <div style={{ width: '100%', maxWidth: 400, position: 'relative', zIndex: 1 }}>

        {/* Brand */}
        <div style={{ textAlign: 'center', marginBottom: 28 }}>
          <Link href="/" style={{ textDecoration: 'none', display: 'inline-block' }}>
            <div style={{ fontSize: 20, fontWeight: 800, color: '#fff', letterSpacing: '-0.5px' }}>
              <span style={{ color: '#22d3ee' }}>Used Car</span> Inspector AI
            </div>
          </Link>
          <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.32)', marginTop: 6 }}>
            AI-powered vehicle inspection
          </div>
        </div>

        {/* Card */}
        <div style={{ background: 'rgba(255,255,255,0.025)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 20, padding: '28px 28px 32px', backdropFilter: 'blur(20px)', WebkitBackdropFilter: 'blur(20px)' }}>

          {/* Tab switcher */}
          <div style={{ display: 'flex', background: 'rgba(255,255,255,0.04)', borderRadius: 11, padding: 4, marginBottom: 26, gap: 4 }}>
            {(['login', 'register'] as Tab[]).map(t => (
              <button
                key={t}
                onClick={() => setTab(t)}
                style={{
                  flex: 1, padding: '9px 0', borderRadius: 8, border: 'none', cursor: 'pointer',
                  fontFamily: 'var(--font-sans)', fontSize: 13, fontWeight: 600, transition: 'all 0.15s',
                  background: tab === t ? 'rgba(255,255,255,0.09)' : 'transparent',
                  color:      tab === t ? '#fff' : 'rgba(255,255,255,0.35)',
                  boxShadow:  tab === t ? '0 1px 3px rgba(0,0,0,0.3)' : 'none',
                }}
              >
                {t === 'login' ? 'Sign In' : 'Create Account'}
              </button>
            ))}
          </div>

          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 13 }}>

            {/* Name — register only */}
            {tab === 'register' && (
              <div>
                <label htmlFor="auth-name" style={{ display: 'block', fontSize: 11, fontWeight: 600, color: 'rgba(255,255,255,0.38)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 7 }}>
                  Full Name
                </label>
                <input
                  id="auth-name"
                  type="text"
                  value={name}
                  onChange={e => setName(e.target.value)}
                  placeholder="Jane Smith"
                  required
                  style={inp}
                />
              </div>
            )}

            {/* Email */}
            <div>
              <label htmlFor="auth-email" style={{ display: 'block', fontSize: 11, fontWeight: 600, color: 'rgba(255,255,255,0.38)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 7 }}>
                Email
              </label>
              <input
                id="auth-email"
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="you@example.com"
                required
                autoComplete="email"
                style={inp}
              />
            </div>

            {/* Password */}
            <div>
              <label htmlFor="auth-password" style={{ display: 'block', fontSize: 11, fontWeight: 600, color: 'rgba(255,255,255,0.38)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 7 }}>
                Password
              </label>
              <div style={{ position: 'relative' }}>
                <input
                  id="auth-password"
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  placeholder={tab === 'register' ? 'Min. 8 characters' : '••••••••'}
                  required
                  minLength={tab === 'register' ? 8 : undefined}
                  autoComplete={tab === 'login' ? 'current-password' : 'new-password'}
                  style={{ ...inp, paddingRight: 46 }}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(v => !v)}
                  tabIndex={-1}
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                  style={{ position: 'absolute', right: 14, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', padding: 0, color: 'rgba(255,255,255,0.3)', display: 'flex', alignItems: 'center' }}
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

            {/* Error */}
            {error && (
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: 9, padding: '11px 13px', background: 'rgba(239,68,68,0.07)', border: '1px solid rgba(239,68,68,0.18)', borderRadius: 10, fontSize: 13, color: '#f87171', lineHeight: 1.4 }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0, marginTop: 1 }}>
                  <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
                </svg>
                {error}
              </div>
            )}

            {/* Submit */}
            <button
              type="submit"
              disabled={isLoading}
              style={{
                marginTop: 4, padding: '14px 0', width: '100%',
                background: isLoading ? 'rgba(34,211,238,0.45)' : '#22d3ee',
                color: '#000', border: 'none', borderRadius: 11,
                fontSize: 14, fontWeight: 800, letterSpacing: '-0.2px',
                fontFamily: 'var(--font-sans)',
                cursor: isLoading ? 'not-allowed' : 'pointer',
                transition: 'opacity 0.15s, background 0.15s',
              }}
            >
              {submitLabel()}
            </button>
          </form>
        </div>

        {/* Footer note */}
        <div style={{ textAlign: 'center', marginTop: 18, fontSize: 12, color: 'rgba(255,255,255,0.2)', lineHeight: 1.6 }}>
          By signing in you agree to our terms of service.
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
          src="https://images.unsplash.com/photo-1503376780353-7e6692767b70?w=1200&q=80&fit=crop"
          alt=""
          style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', objectPosition: 'center' }}
        />
        {/* Dark overlay */}
        <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(135deg, rgba(8,12,20,0.82) 0%, rgba(8,12,20,0.55) 50%, rgba(8,12,20,0.75) 100%)' }} />
        {/* Gradient fade toward left edge to blend with form */}
        <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to right, #080c14 0%, transparent 18%)' }} />

        {/* Panel content */}
        <div style={{ position: 'relative', zIndex: 1, height: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'flex-end', padding: '48px 48px' }}>
          {/* Brand mark */}
          <div style={{ marginBottom: 'auto', paddingTop: 48 }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: 'rgba(255,255,255,0.5)', letterSpacing: '0.12em', textTransform: 'uppercase', marginBottom: 10 }}>
              Used Car Inspector AI
            </div>
          </div>

          {/* Quote */}
          <div>
            <div style={{ width: 32, height: 2, background: '#22d3ee', borderRadius: 2, marginBottom: 20 }} />
            <p style={{ fontSize: 22, fontWeight: 700, color: '#fff', letterSpacing: '-0.4px', lineHeight: 1.35, marginBottom: 16, maxWidth: 360 }}>
              Every used car has a story.<br />
              <span style={{ color: '#22d3ee' }}>Know it before you buy.</span>
            </p>
            <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.42)', lineHeight: 1.6, maxWidth: 340 }}>
              AI-guided inspections, risk scoring, and premium vehicle history reports — built for buyers who do their homework.
            </p>
          </div>
        </div>
      </div>

      <style>{`
        @media (min-width: 960px) {
          .auth-image-panel { display: block !important; }
        }
      `}</style>
    </div>
  )
}
