// =============================================================================
// App Shell — Mobile-First Layout
// Mobile:  glass top-bar + bottom navigation
// Desktop: sidebar + topbar
// =============================================================================

'use client'

import { useEffect, useState } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import Link from 'next/link'
import { useTranslation } from 'react-i18next'
import { useUserStore } from '@/store'
import { isSupportedLang, LANG_COOKIE } from '@/i18n/shared'
import { Sidebar } from '@/components/layout/Sidebar'
import { Topbar } from '@/components/layout/Topbar'
import { BottomNav } from '@/components/layout/BottomNav'
import { LanguageSwitcher } from '@/components/layout/LanguageSwitcher'
import { AmbientBackground } from '@/components/layout/AmbientBackground'

// Applies the authenticated user's saved language preference to i18n + cookie.
// Runs whenever preferredLanguage changes in the store (login, register, profile update).
function UserLangSync() {
  const { i18n } = useTranslation()
  const preferredLanguage = useUserStore(state => state.user?.preferredLanguage)

  useEffect(() => {
    if (!preferredLanguage || !isSupportedLang(preferredLanguage)) return
    if (i18n.language === preferredLanguage) return
    i18n.changeLanguage(preferredLanguage)
    document.cookie = `${LANG_COOKIE}=${encodeURIComponent(preferredLanguage)}; Path=/; Max-Age=31536000; SameSite=Lax`
  }, [preferredLanguage, i18n])

  return null
}

// Maps pathnames to topbar translation key slugs (used for mobile header title)
const PAGE_SLUG: Record<string, { slug: string; accent?: string }> = {
  '/dashboard':  { slug: 'dashboard' },
  '/vehicle':    { slug: 'vehicle' },
  '/inspection': { slug: 'inspection', accent: '#22d3ee' },
  '/report':     { slug: 'report' },
  '/premium':    { slug: 'premium', accent: '#a855f7' },
  '/community':  { slug: 'community' },
  '/messages':   { slug: 'messages' },
  '/profile':    { slug: 'profile' },
}

const APP_BACKGROUND_PATHS = new Set([
  '/dashboard',
  '/vehicle',
  '/report',
  '/premium',
  '/community',
  '/messages',
  '/profile',
])

interface AppShellProps {
  readonly children: React.ReactNode
}

export default function AppShell({ children }: AppShellProps) {
  const { isAuthenticated, refreshSession, user } = useUserStore()
  const router   = useRouter()
  const pathname = usePathname()
  const { t }    = useTranslation()

  const [hydrated, setHydrated] = useState(false)
  useEffect(() => { setHydrated(true) }, [])

  useEffect(() => {
    if (!hydrated) return
    if (!isAuthenticated) {
      router.replace(`/auth?redirect=${encodeURIComponent(pathname)}`)
      return
    }
    if (user?.emailVerified === false) {
      router.replace('/verify-required')
      return
    }
    refreshSession()
  }, [hydrated, isAuthenticated, user?.emailVerified])

  if (!hydrated) return <div style={{ minHeight: '100svh', background: '#080c14' }} />
  if (!isAuthenticated) return null
  if (user?.emailVerified === false) return null

  const pageMeta = PAGE_SLUG[pathname] ?? { slug: 'fallback' }
  const backgroundContext = pathname === '/inspection'
    ? 'inspection'
    : APP_BACKGROUND_PATHS.has(pathname) ? 'app' : 'default'
  const initials = user?.name
    ? user.name.split(' ').map((n: string) => n[0]).slice(0, 2).join('').toUpperCase()
    : 'U'

  return (
    <>
      <UserLangSync />
      {/* ── Desktop layout (768px+) ── */}
      <div
        className="desktop-only app-readability"
        style={{ height: '100vh', overflow: 'hidden', background: '#080c14', position: 'relative', isolation: 'isolate' }}
      >
        <AmbientBackground variant="desktop" context={backgroundContext} />
        <div style={{ position: 'relative', zIndex: 1, display: 'flex', width: '100%', height: '100%' }}>
          <Sidebar />
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
            <Topbar />
            <main style={{ flex: 1, overflowY: 'auto', padding: '24px', scrollbarWidth: 'thin', background: 'transparent' }}>
              {children}
            </main>
          </div>
        </div>
      </div>

      {/* ── Mobile layout (<768px) ── */}
      <div
        className="mobile-only app-readability"
        style={{ flexDirection: 'column', height: '100dvh', minHeight: '100svh', background: '#080c14', position: 'relative', isolation: 'isolate', overflow: 'hidden' }}
      >
        <AmbientBackground variant="mobile" context={backgroundContext} />
        {/* ── Premium glass top bar ── */}
        <header style={{
          height: 56,
          flexShrink: 0,
          background: 'rgba(6,9,16,0.97)',
          borderBottom: '1px solid rgba(255,255,255,0.06)',
          backdropFilter: 'blur(28px)',
          WebkitBackdropFilter: 'blur(28px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '0 16px',
          position: 'sticky',
          top: 0,
          zIndex: 40,
          boxShadow: '0 1px 0 rgba(255,255,255,0.04), 0 4px 20px rgba(0,0,0,0.3)',
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
                {t(`topbar.${pageMeta.slug}.title`)}
              </div>
            </div>
          </div>

          {/* Right: language switcher + premium badge + avatar */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <LanguageSwitcher />
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

            {/* Avatar → profile */}
            <Link
              href="/profile"
              aria-label="View profile"
              style={{
                width: 34, height: 34, borderRadius: '50%', flexShrink: 0,
                background: 'linear-gradient(135deg, rgba(34,211,238,0.15), rgba(129,140,248,0.15))',
                border: '1.5px solid rgba(34,211,238,0.25)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 11, fontWeight: 800, color: '#22d3ee',
                textDecoration: 'none', letterSpacing: '0.02em',
              }}
            >
              {initials}
            </Link>
          </div>
        </header>

        {/* ── Main content ── */}
        <main
          className="mobile-page-content"
          style={{
            flex: 1,
            overflowY: 'auto',
            /* Bottom padding clears the fixed 64px nav + safe area (iOS/Android) */
            padding: '16px 16px calc(92px + env(safe-area-inset-bottom, 0px))',
            background: 'transparent',
            position: 'relative',
            zIndex: 1,
          }}
        >
          {children}
        </main>

        <BottomNav />
      </div>
    </>
  )
}
