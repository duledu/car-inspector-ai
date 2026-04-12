'use client'

// =============================================================================
// Google OAuth — Complete
// Picks up the single-use gauth_session cookie via /api/auth/google/session,
// stores the session in Zustand, and redirects to the dashboard.
// =============================================================================

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useUserStore } from '@/store'
import type { AuthSession } from '@/types'

export default function GoogleComplete() {
  const router          = useRouter()
  const loginWithGoogle = useUserStore(s => s.loginWithGoogle)

  useEffect(() => {
    let cancelled = false

    async function finalize() {
      try {
        const res = await fetch('/api/auth/google/session', { credentials: 'same-origin' })
        if (!res.ok) throw new Error('no session')
        const { data }: { data: AuthSession } = await res.json()
        if (!cancelled) {
          loginWithGoogle(data)
          router.replace('/dashboard')
        }
      } catch {
        if (!cancelled) router.replace('/auth?error=googleFailed')
      }
    }

    finalize()
    return () => { cancelled = true }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div style={{
      minHeight: '100vh',
      background: '#080c14',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 16,
      fontFamily: 'var(--font-sans)',
    }}>
      {/* Spinner */}
      <div style={{
        width: 36, height: 36,
        border: '3px solid rgba(255,255,255,0.08)',
        borderTopColor: '#22d3ee',
        borderRadius: '50%',
        animation: 'spin 0.7s linear infinite',
      }} />
      <span style={{ fontSize: 14, color: 'rgba(255,255,255,0.35)' }}>Signing in…</span>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  )
}
