'use client'

import { useEffect, useState, Suspense } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { useTranslation } from 'react-i18next'
import { apiClient } from '@/services/api/client'
import { useUserStore } from '@/store'
import type { ApiResponse } from '@/types'

export default function VerifyEmailPage() {
  return (
    <Suspense>
      <VerifyEmailContent />
    </Suspense>
  )
}

type State = 'verifying' | 'success' | 'expired' | 'invalid'

function VerifyEmailContent() {
  const { t }           = useTranslation()
  const router          = useRouter()
  const searchParams    = useSearchParams()
  const token           = searchParams.get('token') ?? ''
  const { isAuthenticated, refreshSession } = useUserStore()

  const [state, setState] = useState<State>(token ? 'verifying' : 'invalid')

  useEffect(() => {
    if (!token) return
    apiClient
      .post<ApiResponse<{ success: boolean }>>('/auth/verify-email', { token })
      .then(async () => {
        setState('success')
        // If the user is logged in, refresh their session so Zustand gets
        // emailVerified:true. Then redirect to the app — no manual re-login needed.
        if (isAuthenticated) {
          await refreshSession()
          router.replace('/dashboard')
        }
      })
      .catch((err: unknown) => {
        const msg = err instanceof Error ? err.message : ''
        setState(msg.includes('expired') ? 'expired' : 'invalid')
      })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token])

  function iconBg(): string {
    if (state === 'success')   return 'rgba(34,211,238,0.1)'
    if (state === 'verifying') return 'rgba(255,255,255,0.06)'
    return 'rgba(239,68,68,0.1)'
  }
  function iconBorder(): string {
    if (state === 'success')   return 'rgba(34,211,238,0.2)'
    if (state === 'verifying') return 'rgba(255,255,255,0.1)'
    return 'rgba(239,68,68,0.2)'
  }
  function iconSvg() {
    if (state === 'success') {
      return <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#22d3ee" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
    }
    if (state === 'verifying') {
      return <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.5)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
    }
    return <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#f87171" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
  }

  return (
    <div style={{ minHeight: '100vh', background: '#080c14', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: "-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif", padding: '24px 16px' }}>
      <div style={{ width: '100%', maxWidth: 400 }}>

        <div style={{ textAlign: 'center', marginBottom: 28 }}>
          <Link href="/" style={{ textDecoration: 'none', display: 'inline-block' }}>
            <div style={{ fontSize: 20, fontWeight: 800, color: '#fff', letterSpacing: '-0.5px' }}>
              <span style={{ color: '#22d3ee' }}>Used Car</span> Inspector AI
            </div>
          </Link>
        </div>

        <div style={{ background: 'rgba(255,255,255,0.025)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 20, padding: '36px 28px', textAlign: 'center' }}>
          <div style={{ width: 56, height: 56, borderRadius: '50%', background: iconBg(), border: `1px solid ${iconBorder()}`, display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 20px' }}>
            {iconSvg()}
          </div>

          <h2 style={{ margin: '0 0 10px', fontSize: 20, fontWeight: 800, color: '#fff' }}>
            {t(`auth.verifyEmail.${state}Title`)}
          </h2>
          <p style={{ margin: '0 0 24px', fontSize: 14, color: 'rgba(255,255,255,0.5)', lineHeight: 1.6 }}>
            {/* If logged in and success, show a redirecting message instead */}
            {state === 'success' && isAuthenticated
              ? t('auth.verifyEmail.redirecting', 'Redirecting you to the app…')
              : t(`auth.verifyEmail.${state}Body`)}
          </p>

          {state === 'success' && !isAuthenticated && (
            <Link href="/auth" style={{ display: 'inline-block', padding: '12px 28px', background: '#22d3ee', color: '#000', borderRadius: 11, fontSize: 14, fontWeight: 800, textDecoration: 'none' }}>
              {t('auth.signIn')}
            </Link>
          )}
          {(state === 'expired' || state === 'invalid') && (
            <Link href="/auth" style={{ color: '#22d3ee', fontSize: 14, textDecoration: 'none' }}>
              ← {t('auth.backToSignIn')}
            </Link>
          )}
        </div>
      </div>
    </div>
  )
}
