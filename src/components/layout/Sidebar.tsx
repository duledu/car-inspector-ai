'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useTranslation } from 'react-i18next'
import { LanguageSwitcher } from './LanguageSwitcher'

const NAV = [
  {
    labelKey: 'nav.dashboard',
    href: '/dashboard',
    icon: (
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="3" width="7" height="7" rx="1" /><rect x="14" y="3" width="7" height="7" rx="1" />
        <rect x="3" y="14" width="7" height="7" rx="1" /><rect x="14" y="14" width="7" height="7" rx="1" />
      </svg>
    ),
  },
  {
    labelKey: 'nav.vehicles',
    href: '/vehicle',
    icon: (
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d="M5 17H3a2 2 0 0 1-2-2V9a2 2 0 0 1 2-2h13l4 4v4a2 2 0 0 1-2 2h-2" />
        <circle cx="7.5" cy="17.5" r="2.5" /><circle cx="17.5" cy="17.5" r="2.5" />
      </svg>
    ),
  },
  {
    labelKey: 'nav.inspect',
    href: '/inspection',
    icon: (
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d="M9 11l3 3L22 4" /><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" />
      </svg>
    ),
  },
  {
    labelKey: 'nav.report',
    href: '/report',
    icon: (
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
        <polyline points="14 2 14 8 20 8" /><line x1="16" y1="13" x2="8" y2="13" /><line x1="16" y1="17" x2="8" y2="17" /><line x1="10" y1="9" x2="8" y2="9" />
      </svg>
    ),
  },
  {
    labelKey: 'nav.premium',
    href: '/premium',
    icon: (
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
      </svg>
    ),
  },
  {
    labelKey: 'nav.community',
    href: '/community',
    icon: (
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" />
        <path d="M23 21v-2a4 4 0 0 0-3-3.87" /><path d="M16 3.13a4 4 0 0 1 0 7.75" />
      </svg>
    ),
  },
  {
    labelKey: 'nav.messages',
    href: '/messages',
    icon: (
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
      </svg>
    ),
  },
  {
    labelKey: 'nav.profile',
    href: '/profile',
    icon: (
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" /><circle cx="12" cy="7" r="4" />
      </svg>
    ),
  },
]

export function Sidebar() {
  const pathname = usePathname()
  const { t } = useTranslation()

  return (
    <div
      style={{
        width: 220,
        minWidth: 220,
        height: '100vh',
        background: '#070b12',
        borderRight: '1px solid rgba(255,255,255,0.05)',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
      }}
    >
      {/* Brand */}
      <div style={{ padding: '20px 16px 16px', borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
        <Link href="/" style={{ textDecoration: 'none' }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: '#fff', letterSpacing: '-0.2px', lineHeight: 1.3 }}>
            <span style={{ color: '#22d3ee' }}>Used Car</span>
            <br />
            <span style={{ color: 'rgba(255,255,255,0.5)', fontWeight: 400 }}>Inspector AI</span>
          </div>
        </Link>
      </div>

      {/* Nav */}
      <nav style={{ padding: '10px 10px 0', display: 'flex', flexDirection: 'column', gap: 2 }}>
        {NAV.map((item) => {
          const active = pathname === item.href || pathname.startsWith(item.href + '/')
          return (
            <Link key={item.href} href={item.href} style={{ textDecoration: 'none' }}>
              <div
                style={{
                  padding: '8px 12px',
                  borderRadius: 9,
                  fontSize: 13,
                  fontWeight: active ? 600 : 450,
                  color: active ? '#22d3ee' : 'rgba(255,255,255,0.68)',
                  background: active ? 'rgba(34,211,238,0.07)' : 'transparent',
                  border: active ? '1px solid rgba(34,211,238,0.14)' : '1px solid transparent',
                  transition: 'all 0.15s ease',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 9,
                }}
              >
                <span style={{ opacity: active ? 1 : 0.78, flexShrink: 0 }}>{item.icon}</span>
                {t(item.labelKey)}
              </div>
            </Link>
          )
        })}
      </nav>

      {/* Spacer */}
      <div style={{ flex: 1 }} />

      {/* Footer */}
      <div style={{ padding: '12px 10px', borderTop: '1px solid rgba(255,255,255,0.04)', display: 'flex', flexDirection: 'column', gap: 8 }}>
        {/* Language switcher */}
        <div style={{ padding: '0 2px' }}>
          <LanguageSwitcher />
        </div>

        {/* Back to landing */}
        <Link href="/" style={{ textDecoration: 'none' }}>
          <div
            style={{
              padding: '7px 12px',
              fontSize: 11,
              color: 'rgba(255,255,255,0.42)',
              borderRadius: 8,
              letterSpacing: '0.01em',
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              transition: 'color 0.15s',
            }}
          >
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="15 18 9 12 15 6" />
            </svg>
            {t('nav.backToLanding')}
          </div>
        </Link>
      </div>
    </div>
  )
}
