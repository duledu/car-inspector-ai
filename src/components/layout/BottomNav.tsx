'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useTranslation } from 'react-i18next'

// ─── Nav item definitions (labels resolved via t() at render time) ────────────
const NAV_ITEM_DEFS = [
  {
    href: '/dashboard',
    labelKey: 'nav.home',
    icon: (active: boolean) => (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none"
        stroke={active ? '#22d3ee' : 'rgba(255,255,255,0.38)'}
        strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="3" width="7" height="7" rx="1.5"/>
        <rect x="14" y="3" width="7" height="7" rx="1.5"/>
        <rect x="3" y="14" width="7" height="7" rx="1.5"/>
        <rect x="14" y="14" width="7" height="7" rx="1.5"/>
      </svg>
    ),
  },
  {
    href: '/vehicle',
    labelKey: 'nav.vehicles',
    icon: (active: boolean) => (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none"
        stroke={active ? '#22d3ee' : 'rgba(255,255,255,0.38)'}
        strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d="M5 17H3a2 2 0 0 1-2-2V9a2 2 0 0 1 2-2h13l4 4v4a2 2 0 0 1-2 2h-2"/>
        <circle cx="7.5" cy="17.5" r="2.5"/>
        <circle cx="17.5" cy="17.5" r="2.5"/>
      </svg>
    ),
  },
  {
    href: '/inspection',
    labelKey: 'nav.inspect',
    isCTA: true,
    icon: (_active: boolean) => (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none"
        stroke="#050810" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="11" cy="11" r="8"/>
        <line x1="21" y1="21" x2="16.65" y2="16.65"/>
      </svg>
    ),
  },
  {
    href: '/report',
    labelKey: 'nav.report',
    icon: (active: boolean) => (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none"
        stroke={active ? '#22d3ee' : 'rgba(255,255,255,0.38)'}
        strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
        <polyline points="14 2 14 8 20 8"/>
        <line x1="16" y1="13" x2="8" y2="13"/>
        <line x1="16" y1="17" x2="8" y2="17"/>
      </svg>
    ),
  },
  {
    href: '/profile',
    labelKey: 'nav.profile',
    icon: (active: boolean) => (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none"
        stroke={active ? '#22d3ee' : 'rgba(255,255,255,0.38)'}
        strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>
        <circle cx="12" cy="7" r="4"/>
      </svg>
    ),
  },
]

export function BottomNav() {
  const pathname  = usePathname()
  const { t }     = useTranslation()

  return (
    <nav
      className="mobile-only no-select bottom-nav-container"
      style={{
        position: 'fixed',
        bottom: 0, left: 0, right: 0,
        zIndex: 50,
        background: 'rgba(6,9,16,0.98)',
        borderTop: '1px solid rgba(255,255,255,0.06)',
        backdropFilter: 'blur(32px)',
        WebkitBackdropFilter: 'blur(32px)',
        flexDirection: 'column',
        boxShadow: '0 -1px 0 rgba(255,255,255,0.04), 0 -8px 32px rgba(0,0,0,0.4)',
      }}
    >
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-around',
        height: 64,
        padding: '0 4px',
      }}>
        {NAV_ITEM_DEFS.map(item => {
          const active = pathname === item.href
          const label  = t(item.labelKey)

          /* ── CTA (Inspect) button ── */
          if (item.isCTA) {
            return (
              <Link
                key={item.href}
                href={item.href}
                aria-label={label}
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  gap: 4,
                  textDecoration: 'none',
                  position: 'relative',
                  top: -14,
                  flex: 1,
                }}
              >
                <div style={{
                  width: 54, height: 54,
                  borderRadius: '50%',
                  background: active
                    ? 'linear-gradient(135deg, #06b6d4 0%, #0891b2 100%)'
                    : 'linear-gradient(135deg, #22d3ee 0%, #06b6d4 100%)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  boxShadow: `0 4px 22px rgba(34,211,238,${active ? '0.6' : '0.4'}), 0 0 0 3px rgba(6,9,16,0.95), 0 0 0 5px rgba(34,211,238,0.12)`,
                  border: '1.5px solid rgba(255,255,255,0.2)',
                  transition: 'all 0.2s ease',
                }}>
                  {item.icon(active)}
                </div>
                <span style={{
                  fontSize: 10, fontWeight: 700, letterSpacing: '0.03em',
                  color: active ? '#22d3ee' : 'rgba(255,255,255,0.38)',
                  marginTop: 2,
                }}>
                  {label}
                </span>
              </Link>
            )
          }

          /* ── Regular nav item ── */
          return (
            <Link
              key={item.href}
              href={item.href}
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 4,
                padding: '8px 0',
                flex: 1,
                minHeight: 44,
                textDecoration: 'none',
                position: 'relative',
              }}
            >
              {/* Active top glow indicator */}
              {active && (
                <div style={{
                  position: 'absolute',
                  top: 0,
                  left: '50%',
                  transform: 'translateX(-50%)',
                  width: 24, height: 2,
                  borderRadius: '0 0 3px 3px',
                  background: '#22d3ee',
                  boxShadow: '0 0 10px rgba(34,211,238,0.7)',
                }} />
              )}

              {/* Icon */}
              <div style={{
                width: 40, height: 36,
                borderRadius: 11,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                background: active ? 'rgba(34,211,238,0.09)' : 'transparent',
                border: active ? '1px solid rgba(34,211,238,0.16)' : '1px solid transparent',
                boxShadow: active ? '0 0 14px rgba(34,211,238,0.1)' : 'none',
                transition: 'all 0.18s ease',
              }}>
                {item.icon(active)}
              </div>

              <span style={{
                fontSize: 10,
                fontWeight: active ? 700 : 500,
                color: active ? '#22d3ee' : 'rgba(255,255,255,0.32)',
                letterSpacing: '0.02em',
                lineHeight: 1,
                transition: 'color 0.15s ease',
              }}>
                {label}
              </span>
            </Link>
          )
        })}
      </div>
    </nav>
  )
}
