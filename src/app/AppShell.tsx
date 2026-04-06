// =============================================================================
// App Shell — Mobile-First Layout
// Mobile:  glass top-bar + bottom navigation
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

const PAGE_META: Record<string, { title: string; accent?: string }> = {
  '/dashboard':  { title: 'Overview' },
  '/vehicle':    { title: 'Vehicles' },
  '/inspection': { title: 'Inspection', accent: '#22d3ee' },
  '/report':     { title: 'Report' },
  '/premium':    { title: 'Premium', accent: '#a855f7' },
  '/community':  { title: 'Community' },
  '/messages':   { title: 'Messages' },
  '/profile':    { title: 'Profile' },
}

interface AppShellProps {
  readonly children: React.ReactNode
}

export default function AppShell({ children }: AppShellProps) {
  const { isAuthenticated, refreshSession, user, logout } = useUserStore()
  const router   = useRouter()
  const pathname = usePathname()

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

  if (!hydrated) return <div style={{ minHeight: '100svh', background: '#080c14' }} />
  if (!isAuthenticated) return null

  const meta    = PAGE_META[pathname] ?? { title: 'Car Inspector AI' }
  const initials = user?.name
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
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
          <Topbar />
          <main style={{ flex: 1, overflowY: 'auto', padding: '24px', scrollbarWidth: 'thin', background: '#080c14' }}>
            {children}
          </main>
        </div>
      </div>

      {/* ── Mobile layout (<768px) ── */}
      <div
        className="mobile-only"
        style={{ flexDirection: 'column', minHeight: '100svh', background: '#080c14' }}
      >
        {/* ── Premium glass top bar ── */}
        <header style={{
          height: 56,
          flexShrink: 0,
          background: 'rgba(8,12,20,0.95)',
          borderBottom: '1px solid rgba(255,255,255,0.06)',
          backdropFilter: 'blur(24px)',
          WebkitBackdropFilter: 'blur(24px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '0 16px',
          position: 'sticky',
          top: 0,
          zIndex: 40,
        }}>
          {/* Left: brand mark + page title */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <Link href="/dashboard" style={{ textDecoration: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <div style={{
                width: 32, height: 32, borderRadius: 10,
                background: 'linear-gradient(135deg, #22d3ee 0%, #818cf8 100%)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                boxShadow: '0 0 12px rgba(34,211,238,0.25)',
              }}>
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#050810" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
                </svg>
              </div>
            </Link>

            <div style={{ minWidth: 0 }}>
              <div style={{
                fontSize: 15, fontWeight: 800, color: '#fff',
                letterSpacing: '-0.4px', lineHeight: 1.1,
                overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
              }}>
                {meta.title}
              </div>
            </div>
          </div>

          {/* Right: premium badge + avatar */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Link href="/premium" style={{
              display: 'flex', alignItems: 'center', gap: 5,
              padding: '5px 10px',
              background: 'rgba(168,85,247,0.08)',
              border: '1px solid rgba(168,85,247,0.18)',
              borderRadius: 8,
              fontSize: 11, fontWeight: 700, color: '#a855f7',
              textDecoration: 'none', letterSpacing: '0.02em',
            }}>
              <svg width="10" height="10" viewBox="0 0 24 24" fill="#a855f7" stroke="none">
                <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>
              </svg>
              Pro
            </Link>

            {/* Avatar / logout */}
            <button
              onClick={handleLogout}
              aria-label="Sign out"
              style={{
                width: 34, height: 34, borderRadius: '50%', flexShrink: 0,
                background: 'linear-gradient(135deg, rgba(34,211,238,0.15), rgba(129,140,248,0.15))',
                border: '1.5px solid rgba(34,211,238,0.25)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 11, fontWeight: 800, color: '#22d3ee',
                cursor: 'pointer', letterSpacing: '0.02em',
              }}
            >
              {initials}
            </button>
          </div>
        </header>

        {/* ── Main content ── */}
        <main
          className="mobile-page-content"
          style={{
            flex: 1,
            overflowY: 'auto',
            padding: '16px 16px 0',
            background: '#080c14',
          }}
        >
          {children}
        </main>

        <BottomNav />
      </div>
    </>
  )
}
