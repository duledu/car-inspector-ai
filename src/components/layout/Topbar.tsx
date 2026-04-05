'use client'

import { usePathname, useRouter } from 'next/navigation'
import { useUserStore } from '@/store'

const PAGE_TITLES: Record<string, { title: string; sub: string }> = {
  '/dashboard':  { title: 'Dashboard',        sub: 'Overview & quick actions' },
  '/vehicle':    { title: 'Vehicles',          sub: 'Manage your inspection targets' },
  '/inspection': { title: 'Inspection',        sub: 'Guided AI checklist' },
  '/report':     { title: 'Confidence Report', sub: 'AI-powered risk analysis' },
  '/premium':    { title: 'Premium Reports',   sub: 'Vehicle history intelligence' },
  '/community':  { title: 'Community',         sub: 'Advice from fellow buyers' },
  '/messages':   { title: 'Messages',          sub: 'Private conversations' },
  '/profile':    { title: 'Profile',           sub: 'Account settings' },
}

export function Topbar() {
  const pathname = usePathname()
  const router   = useRouter()
  const { user, logout } = useUserStore()

  const page = PAGE_TITLES[pathname] ?? { title: 'Used Car Inspector AI', sub: '' }

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
            {page.title}
          </div>
          {page.sub && (
            <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.28)', lineHeight: 1.2 }}>
              {page.sub}
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
          Inspect
        </a>

        {/* Divider */}
        <div style={{ width: 1, height: 20, background: 'rgba(255,255,255,0.07)' }} />

        {/* User avatar + name */}
        {user && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 7, cursor: 'default' }}>
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
                {user.role === 'USER' ? 'Member' : user.role}
              </span>
            </div>
          </div>
        )}

        {/* Sign out */}
        <button
          onClick={handleLogout}
          aria-label="Sign out"
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
          Sign out
        </button>
      </div>
    </header>
  )
}
