'use client'

import { useEffect, useState, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { useTranslation } from 'react-i18next'
import { apiClient } from '@/services/api/client'
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
  const { t }        = useTranslation()
  const searchParams = useSearchParams()
  const token        = searchParams.get('token') ?? ''

  const [state, setState] = useState<State>(token ? 'verifying' : 'invalid')

  useEffect(() => {
    if (!token) return
    apiClient
      .post<ApiResponse<{ success: boolean }>>('/auth/verify-email', { token })
      .then(() => setState('success'))
      .catch((err: unknown) => {
        const msg = err instanceof Error ? err.message : ''
        setState(msg.includes('expired') ? 'expired' : 'invalid')
      })
  }, [token])

  const icon  = state === 'success' ? '✓' : state === 'verifying' ? '⏳' : '✕'
  const color = state === 'success' ? 'rgba(34,211,238,0.1)' : state === 'verifying' ? 'rgba(255,255,255,0.06)' : 'rgba(239,68,68,0.1)'
  const borderColor = state === 'success' ? 'rgba(34,211,238,0.2)' : state === 'verifying' ? 'rgba(255,255,255,0.1)' : 'rgba(239,68,68,0.2)'

  return (
    <div style={{ minHeight: '100vh', background: '#080c14', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'var(--font-sans)', padding: '24px 16px' }}>
      <div style={{ width: '100%', maxWidth: 400 }}>

        <div style={{ textAlign: 'center', marginBottom: 28 }}>
          <Link href="/" style={{ textDecoration: 'none', display: 'inline-block' }}>
            <div style={{ fontSize: 20, fontWeight: 800, color: '#fff', letterSpacing: '-0.5px' }}>
              <span style={{ color: '#22d3ee' }}>Used Car</span> Inspector AI
            </div>
          </Link>
        </div>

        <div style={{ background: 'rgba(255,255,255,0.025)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 20, padding: '36px 28px', textAlign: 'center' }}>
          <div style={{ width: 56, height: 56, borderRadius: '50%', background: color, border: `1px solid ${borderColor}`, display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 20px', fontSize: 24 }}>
            {icon}
          </div>

          <h2 style={{ margin: '0 0 10px', fontSize: 20, fontWeight: 800, color: '#fff' }}>
            {t(`auth.verifyEmail.${state}Title`)}
          </h2>
          <p style={{ margin: '0 0 24px', fontSize: 14, color: 'rgba(255,255,255,0.5)', lineHeight: 1.6 }}>
            {t(`auth.verifyEmail.${state}Body`)}
          </p>

          {state === 'success' && (
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
