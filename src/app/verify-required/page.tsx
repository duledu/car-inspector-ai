'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { useTranslation } from 'react-i18next'
import { useUserStore } from '@/store'
import { authApi } from '@/services/api/auth.api'

export default function VerifyRequiredPage() {
  const { t }             = useTranslation()
  const router            = useRouter()
  const logout            = useUserStore(s => s.logout)
  const user              = useUserStore(s => s.user)
  const isAuthenticated   = useUserStore(s => s.isAuthenticated)
  const refreshSession    = useUserStore(s => s.refreshSession)

  const [status,  setStatus]  = useState<'idle' | 'sending' | 'sent' | 'error'>('idle')
  const [errMsg,  setErrMsg]  = useState('')

  // On mount: refresh session from server. If the user has already verified
  // their email (e.g. clicked the link in another tab), the refreshed session
  // will have emailVerified:true and we can send them straight to the app.
  useEffect(() => {
    if (!isAuthenticated) return
    refreshSession().then(() => {
      // The store update is reactive — the check below will fire when
      // user.emailVerified changes in Zustand.
    })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    if (user?.emailVerified === true) {
      router.replace('/dashboard')
    }
  }, [user?.emailVerified, router])

  async function handleResend() {
    setStatus('sending')
    setErrMsg('')
    try {
      await authApi.sendVerificationEmail()
      setStatus('sent')
    } catch {
      setStatus('error')
      setErrMsg(t('auth.verifyRequired.resendError'))
    }
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
      <div style={{ width: '100%', maxWidth: 440 }}>

        {/* Brand */}
        <div style={{ textAlign: 'center', marginBottom: 28 }}>
          <Link href="/" style={{ textDecoration: 'none', display: 'inline-block' }}>
            <div style={{ fontSize: 20, fontWeight: 800, color: '#fff', letterSpacing: '-0.5px' }}>
              <span style={{ color: '#22d3ee' }}>Used Car</span> Inspector AI
            </div>
          </Link>
        </div>

        {/* Card */}
        <div style={{
          background: 'rgba(255,255,255,0.025)',
          border: '1px solid rgba(255,255,255,0.08)',
          borderRadius: 20,
          padding: '40px 32px',
          textAlign: 'center',
        }}>

          {/* Icon */}
          <div style={{
            width: 56, height: 56, borderRadius: '50%',
            background: 'rgba(34,211,238,0.08)',
            border: '1px solid rgba(34,211,238,0.18)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            margin: '0 auto 24px',
          }}>
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#22d3ee" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/>
              <polyline points="22,6 12,13 2,6"/>
            </svg>
          </div>

          <h1 style={{ margin: '0 0 10px', fontSize: 22, fontWeight: 800, color: '#fff', letterSpacing: '-0.4px' }}>
            {t('auth.verifyRequired.title')}
          </h1>

          <p style={{ margin: '0 0 8px', fontSize: 14, color: 'rgba(255,255,255,0.5)', lineHeight: 1.65 }}>
            {t('auth.verifyRequired.body')}
          </p>

          {user?.email && (
            <p style={{ margin: '0 0 28px', fontSize: 13, color: 'rgba(34,211,238,0.7)', fontWeight: 600 }}>
              {user.email}
            </p>
          )}

          {/* Resend button */}
          {status === 'sent' ? (
            <div style={{
              padding: '14px 20px',
              background: 'rgba(34,211,238,0.06)',
              border: '1px solid rgba(34,211,238,0.18)',
              borderRadius: 12,
              fontSize: 14,
              color: '#22d3ee',
              fontWeight: 600,
              marginBottom: 20,
            }}>
              {t('auth.verifyRequired.resendSent')}
            </div>
          ) : (
            <button
              onClick={handleResend}
              disabled={status === 'sending'}
              style={{
                width: '100%',
                padding: '14px 0',
                background: status === 'sending' ? 'rgba(34,211,238,0.4)' : '#22d3ee',
                color: '#000',
                border: 'none',
                borderRadius: 11,
                fontSize: 14,
                fontWeight: 800,
                cursor: status === 'sending' ? 'not-allowed' : 'pointer',
                marginBottom: 12,
                fontFamily: 'inherit',
              }}
            >
              {status === 'sending'
                ? t('auth.verifyRequired.resendSending')
                : t('auth.verifyRequired.resendButton')}
            </button>
          )}

          {status === 'error' && errMsg && (
            <div style={{
              padding: '10px 14px',
              background: 'rgba(239,68,68,0.07)',
              border: '1px solid rgba(239,68,68,0.18)',
              borderRadius: 10,
              fontSize: 13,
              color: '#f87171',
              marginBottom: 12,
            }}>
              {errMsg}
            </div>
          )}

          {/* Sign out */}
          <button
            onClick={handleSignOut}
            style={{
              background: 'none',
              border: 'none',
              padding: 0,
              fontSize: 13,
              color: 'rgba(255,255,255,0.3)',
              cursor: 'pointer',
              textDecoration: 'underline',
              fontFamily: 'inherit',
            }}
          >
            {t('auth.verifyRequired.signOut')}
          </button>
        </div>
      </div>
    </div>
  )
}
