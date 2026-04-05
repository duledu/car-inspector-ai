// =============================================================================
// App Shell Layout — Mobile-First
// Mobile: top bar + bottom navigation
// Desktop: sidebar + topbar
// =============================================================================

'use client'

import { useEffect, useState } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import Link from 'next/link'
import { useUserStore } from '@/store'
import { Sidebar } from '@/components/layout/Sidebar'
import { Topbar } from '@/components/layout/Topbar'
import { BottomNav } from '@/components/layout/BottomNav'

const PAGE_TITLES: Record<string, string> = {
  '/dashboard':  'Overview',
  '/vehicle':    'Vehicles',
  '/inspection': 'Inspection',
  '/report':     'Report',
  '/premium':    'Premium',
  '/community':  'Community',
  '/messages':   'Messages',
  '/profile':    'Profile',
}

interface AppShellProps {
  readonly children: React.ReactNode
}

export default function AppShell({ children }: AppShellProps) {
  const { isAuthenticated, refreshSession, user, logout } = useUserStore()
  const router   = useRouter()
  const pathname = usePathname()

  // Hydration guard — Zustand persist rehydrates from localStorage client-side only.
  const [hydrated, setHydrated] = useState(false)
  useEffect(() => { setHydrated(true) }, [])

  useEffect(() => {
    if (!hydrated) return
    if (!isAuthenticated) {
      router.replace(`/auth?redirect=${encodeURIComponent(pathname)}`)
      return
    }
    refreshSession()
  }, [hydrated, isAuthenticated])

  if (!hydrated) return <div style={{ minHeight: '100vh', background: '#080c14' }} />
  if (!isAuthenticated) return null

  const pageTitle = PAGE_TITLES[pathname] ?? 'Used Car Inspector AI'
  const initials  = user?.name
    ? user.name.split(' ').map((n: string) => n[0]).slice(0, 2).join('').toUpperCase()
    : 'U'

  const handleLogout = async () => {
    await logout()
    router.push('/auth')
  }

  return (
    <>
      {/* ── Desktop layout (768px+) ── */}
      <div
        className="desktop-only"
        style={{ height: '100vh', overflow: 'hidden', background: '#080c14' }}
      >
        <Sidebar />
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', background: '#080c14' }}>
          <Topbar />
          <main style={{ flex: 1, overflowY: 'auto', padding: '24px', scrollbarWidth: 'thin', background: '#080c14' }}>
            {children}
          </main>
        </div>
      </div>

      {/* ── Mobile layout (< 768px) ── */}
      <div
        className="mobile-only"
        style={{ flexDirection: 'column', minHeight: '100vh', background: '#080c14' }}
      >
        {/* Mobile top bar */}
        <header style={{
          height: 52,
          flexShrink: 0,
          background: 'rgba(8,12,20,0.97)',
          borderBottom: '1px solid rgba(255,255,255,0.07)',
          backdropFilter: 'blur(16px)',
          WebkitBackdropFilter: 'blur(16px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '0 16px',
          position: 'sticky',
          top: 0,
          zIndex: 40,
        }}>
          {/* Brand / page title */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <Link href="/dashboard" style={{ textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 6 }}>
              <div style={{
                width: 28, height: 28, borderRadius: 8,
                background: 'linear-gradient(135deg, #22d3ee, #818cf8)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                flexShrink: 0,
              }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#000" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
                </svg>
              </div>
            </Link>
            <span style={{ fontSize: 15, fontWeight: 700, color: '#fff', letterSpacing: '-0.3px' }}>
              {pageTitle}
            </span>
          </div>

          {/* Right controls */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            {/* More menu trigger */}
            <Link href="/premium" style={{
              display: 'flex', alignItems: 'center', gap: 4,
              padding: '5px 10px',
              background: 'rgba(168,85,247,0.1)',
              border: '1px solid rgba(168,85,247,0.2)',
              borderRadius: 7,
              fontSize: 11, fontWeight: 700, color: '#a855f7',
              textDecoration: 'none',
            }}>
              Premium
            </Link>
            {/* Avatar */}
            <button
              onClick={handleLogout}
              aria-label="Account"
              style={{
                width: 32, height: 32, borderRadius: '50%', flexShrink: 0,
                background: 'linear-gradient(135deg, rgba(34,211,238,0.2), rgba(129,140,248,0.2))',
                border: '1.5px solid rgba(34,211,238,0.3)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 11, fontWeight: 800, color: '#22d3ee',
                cursor: 'pointer',
              }}
            >
              {initials}
            </button>
          </div>
        </header>

        {/* Mobile main content */}
        <main
          className="mobile-page-content"
          style={{
            flex: 1,
            overflowY: 'auto',
            padding: '16px',
            background: '#080c14',
          }}
        >
          {children}
        </main>

        {/* Bottom navigation */}
        <BottomNav />
      </div>
    </>
  )
}
