'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useTranslation } from 'react-i18next'
import { useUserStore } from '@/store'
import { LanguageSwitcher } from './LanguageSwitcher'

// Page title keys correspond to topbar.{slug}.title / topbar.{slug}.sub in translations
const SLUG_MAP: Record<string, string> = {
  '/dashboard':  'dashboard',
  '/vehicle':    'vehicle',
  '/inspection': 'inspection',
  '/report':     'report',
  '/premium':    'premium',
  '/community':  'community',
  '/messages':   'messages',
  '/profile':    'profile',
}

export function Topbar() {
  const pathname      = usePathname()
  const router        = useRouter()
  const { t }         = useTranslation()
  const { user, logout } = useUserStore()

  const slug  = SLUG_MAP[pathname]
  const title = slug ? t(`topbar.${slug}.title`) : t('topbar.fallback.title')
  const sub   = slug ? t(`topbar.${slug}.sub`)   : ''

  const handleLogout = async () => {
    await logout()
    router.push('/auth')
  }

  const initials = user?.name
    ? user.name.split(' ').map((n: string) => n[0]).slice(0, 2).join('').toUpperCase()
    : 'U'

  return (
    <header
      style={{
        height: 56,
        minHeight: 56,
        borderBottom: '1px solid rgba(255,255,255,0.05)',
        background: 'rgba(8,12,20,0.92)',
        backdropFilter: 'blur(16px)',
        WebkitBackdropFilter: 'blur(16px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '0 20px',
        flexShrink: 0,
        gap: 16,
        position: 'sticky',
        top: 0,
        zIndex: 40,
      }}
    >
      {/* Page title */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
        <div>
          <div style={{ fontSize: 14, fontWeight: 700, color: '#fff', letterSpacing: '-0.25px', lineHeight: 1.2 }}>
            {title}
          </div>
          {sub && (
            <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.28)', lineHeight: 1.2 }}>
              {sub}
            </div>
          )}
        </div>
      </div>

      {/* Right controls */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
        {/* Inspect CTA */}
        <a
          href="/inspection"
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 5,
            padding: '6px 13px',
            background: 'rgba(34,211,238,0.1)',
            border: '1px solid rgba(34,211,238,0.22)',
            borderRadius: 9,
            fontSize: 12,
            fontWeight: 600,
            color: '#22d3ee',
            textDecoration: 'none',
            whiteSpace: 'nowrap',
          }}
        >
          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
          </svg>
          {t('common.inspect')}
        </a>

        {/* Language switcher */}
        <LanguageSwitcher />

        {/* Divider */}
        <div style={{ width: 1, height: 20, background: 'rgba(255,255,255,0.07)' }} />

        {/* User avatar + name */}
        {user && (
          <Link
            href="/profile"
            aria-label="Open profile"
            className="user-profile-trigger"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 7,
              textDecoration: 'none',
              cursor: 'pointer',
              padding: '4px 6px',
              margin: '-4px -6px',
              borderRadius: 10,
              transition: 'background 0.15s ease, box-shadow 0.15s ease, opacity 0.15s ease',
            }}
          >
            <div
              style={{
                width: 30,
                height: 30,
                borderRadius: '50%',
                background: 'linear-gradient(135deg, rgba(34,211,238,0.22), rgba(129,140,248,0.22))',
                border: '1.5px solid rgba(34,211,238,0.25)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: 11,
                fontWeight: 700,
                color: '#22d3ee',
                letterSpacing: '0.02em',
                flexShrink: 0,
              }}
            >
              {initials}
            </div>
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              <span style={{ fontSize: 12, fontWeight: 600, color: 'rgba(255,255,255,0.75)', maxWidth: 110, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', lineHeight: 1.2 }}>
                {user.name}
              </span>
              <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.28)', lineHeight: 1.2 }}>
                {user.role === 'USER' ? t('common.member') : user.role}
              </span>
            </div>
          </Link>
        )}

        {/* Sign out */}
        <button
          onClick={handleLogout}
          aria-label={t('common.signOut')}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 5,
            padding: '6px 10px',
            background: 'transparent',
            border: '1px solid rgba(255,255,255,0.07)',
            borderRadius: 8,
            fontSize: 11,
            color: 'rgba(255,255,255,0.3)',
            cursor: 'pointer',
            fontFamily: 'var(--font-sans)',
          }}
        >
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/>
            <polyline points="16 17 21 12 16 7"/>
            <line x1="21" y1="12" x2="9" y2="12"/>
          </svg>
          {t('common.signOut')}
        </button>
      </div>
    </header>
  )
}
