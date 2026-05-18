'use client'

import Link from 'next/link'
import React, { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { usePathname } from 'next/navigation'
import '@/i18n/config'
import { useUserStore } from '@/store/useUserStore'
import { LanguageSwitcher } from '@/components/layout/LanguageSwitcher'
import { isFeatureEnabled, type FeatureFlagName } from '@/config/features'

type LandingLink = {
  label: string
  href: string
  feature?: FeatureFlagName
}

export function LandingNav() {
  const [scrolled, setScrolled]   = useState(false)
  const [hydrated, setHydrated]   = useState(false)
  const [menuOpen, setMenuOpen]   = useState(false)
  const menuRef                   = useRef<HTMLDivElement>(null)
  const { user, isAuthenticated, logout } = useUserStore()
  const { t } = useTranslation()
  const pathname = usePathname()

  useEffect(() => {
    const h = () => setScrolled(window.scrollY > 20)
    window.addEventListener('scroll', h, { passive: true })
    return () => window.removeEventListener('scroll', h)
  }, [])

  useEffect(() => { setHydrated(true) }, [])

  useEffect(() => {
    if (!menuOpen) return
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [menuOpen])

  const initials = user?.name
    ? user.name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase()
    : '?'

  const navLinks = ([
    { label: t('nav.inspect'),      href: '/inspection' },
    { label: t('nav.beforeYouBuy'), href: '/before-you-buy' },
    { label: t('nav.community'),    href: '/community', feature: 'community' },
  ] satisfies LandingLink[]).filter(item => isFeatureEnabled(item.feature))

  return (
    <nav style={{
      position: 'fixed', top: 0, left: 0, right: 0, zIndex: 50,
      background: scrolled ? 'rgba(8,12,20,0.92)' : 'rgba(8,12,20,0.6)',
      borderBottom: scrolled ? '1px solid rgba(255,255,255,0.07)' : '1px solid transparent',
      backdropFilter: 'blur(24px)',
      WebkitBackdropFilter: 'blur(24px)',
      transition: 'background 0.3s ease, border-color 0.3s ease',
    }}>
      <div style={{ maxWidth: 1200, margin: '0 auto', padding: '0 20px', height: 60, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16 }}>
        <Link href="/" style={{ textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0 }}>
          <div style={{
            width: 34, height: 34, borderRadius: 10,
            background: 'linear-gradient(135deg, #22d3ee 0%, #818cf8 100%)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            boxShadow: '0 0 16px rgba(34,211,238,0.32)',
          }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#050810" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
            </svg>
          </div>
          <div>
            <div style={{ fontSize: 14, fontWeight: 800, color: '#fff', letterSpacing: '-0.3px', lineHeight: 1.1 }}>Car Inspector</div>
            <div style={{ fontSize: 10, fontWeight: 500, color: 'rgba(255,255,255,0.35)', letterSpacing: '0.04em' }}>{t('landing.aiPowered')}</div>
          </div>
        </Link>

        {/* Desktop nav links */}
        <div style={{ display: 'flex', gap: 2, alignItems: 'center' }} className="desktop-only">
          {navLinks.map(item => {
            const isActive = pathname === item.href || (item.href !== '/' && pathname.startsWith(item.href))
            return (
              <Link key={item.href} href={item.href} style={{
                padding: '7px 14px', borderRadius: 8, fontSize: 13, fontWeight: isActive ? 600 : 500,
                color: isActive ? 'rgba(255,255,255,0.92)' : 'rgba(255,255,255,0.5)',
                textDecoration: 'none', transition: 'all 0.15s',
                background: isActive ? 'rgba(255,255,255,0.07)' : 'transparent',
              }}>
                {item.label}
              </Link>
            )
          })}
        </div>

        {/* Auth row */}
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', justifyContent: 'flex-end',
          opacity: hydrated ? 1 : 0, transition: 'opacity 0.15s ease', flexShrink: 0 }}>

          <LanguageSwitcher />

          {hydrated && isAuthenticated && user ? (
            <div ref={menuRef} style={{ position: 'relative', display: 'flex', gap: 8, alignItems: 'center' }}>
              <Link href="/dashboard" className="desktop-only" style={{
                padding: '9px 16px', borderRadius: 10, fontSize: 13, fontWeight: 600,
                color: 'rgba(255,255,255,0.7)', border: '1px solid rgba(255,255,255,0.12)',
                background: 'rgba(255,255,255,0.05)', textDecoration: 'none',
                backdropFilter: 'blur(12px)', transition: 'all 0.15s', whiteSpace: 'nowrap',
              }}
                onMouseEnter={e => { const el = e.currentTarget as HTMLElement; el.style.color = 'rgba(255,255,255,0.92)'; el.style.border = '1px solid rgba(255,255,255,0.24)'; el.style.background = 'rgba(255,255,255,0.1)'; }}
                onMouseLeave={e => { const el = e.currentTarget as HTMLElement; el.style.color = 'rgba(255,255,255,0.7)'; el.style.border = '1px solid rgba(255,255,255,0.12)'; el.style.background = 'rgba(255,255,255,0.05)'; }}
              >{t('landing.dashboard')}</Link>

              <button
                onClick={() => setMenuOpen(v => !v)}
                style={{
                  width: 34, height: 34, borderRadius: 10, border: 'none', cursor: 'pointer',
                  background: menuOpen
                    ? 'linear-gradient(135deg, #22d3ee 0%, #818cf8 100%)'
                    : 'rgba(255,255,255,0.08)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  transition: 'all 0.15s', flexShrink: 0,
                  boxShadow: menuOpen ? '0 0 14px rgba(34,211,238,0.3)' : 'none',
                }}
              >
                {user.avatarUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={user.avatarUrl} alt={user.name} style={{ width: 34, height: 34, borderRadius: 10, objectFit: 'cover' }} />
                ) : (
                  <span style={{ fontSize: 11, fontWeight: 800, color: menuOpen ? '#03131A' : 'rgba(255,255,255,0.7)', letterSpacing: '0.02em' }}>{initials}</span>
                )}
              </button>

              {menuOpen && (
                <div style={{
                  position: 'absolute', top: 'calc(100% + 8px)', right: 0, minWidth: 180,
                  background: 'rgba(10,14,28,0.96)', border: '1px solid rgba(255,255,255,0.1)',
                  borderRadius: 12, backdropFilter: 'blur(24px)', WebkitBackdropFilter: 'blur(24px)',
                  boxShadow: '0 16px 48px rgba(0,0,0,0.5)', overflow: 'hidden', zIndex: 100,
                }}>
                  <div style={{ padding: '12px 14px 10px', borderBottom: '1px solid rgba(255,255,255,0.07)' }}>
                    <div style={{ fontSize: 13, fontWeight: 600, color: '#fff', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{user.name}</div>
                    <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.35)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{user.email}</div>
                  </div>
                  {[
                    { label: t('landing.dashboard'),      href: '/dashboard' },
                    { label: t('landing.myInspections'), href: '/inspection' },
                    { label: t('nav.profile'),           href: '/profile' },
                  ].map(item => (
                    <Link key={item.label} href={item.href}
                      onClick={() => setMenuOpen(false)}
                      style={{ display: 'block', padding: '10px 14px', fontSize: 13, fontWeight: 500,
                        color: 'rgba(255,255,255,0.65)', textDecoration: 'none', transition: 'all 0.1s' }}
                      onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = '#fff'; (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.05)'; }}
                      onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = 'rgba(255,255,255,0.65)'; (e.currentTarget as HTMLElement).style.background = 'transparent'; }}
                    >{item.label}</Link>
                  ))}
                  <div style={{ borderTop: '1px solid rgba(255,255,255,0.07)', margin: '4px 0 0' }} />
                  <button
                    onClick={() => { setMenuOpen(false); logout() }}
                    style={{ display: 'block', width: '100%', padding: '10px 14px', fontSize: 13, fontWeight: 500,
                      color: 'rgba(239,68,68,0.8)', background: 'transparent', border: 'none', textAlign: 'left',
                      cursor: 'pointer', transition: 'all 0.1s' }}
                    onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = 'rgb(239,68,68)'; (e.currentTarget as HTMLElement).style.background = 'rgba(239,68,68,0.07)'; }}
                    onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = 'rgba(239,68,68,0.8)'; (e.currentTarget as HTMLElement).style.background = 'transparent'; }}
                  >{t('landing.signOut')}</button>
                </div>
              )}
            </div>
          ) : (
            <>
              <Link href="/auth" style={{
                padding: '9px 16px', borderRadius: 10, fontSize: 13, fontWeight: 600,
                color: 'rgba(255,255,255,0.55)', border: '1px solid rgba(255,255,255,0.1)',
                background: 'transparent', textDecoration: 'none', transition: 'all 0.15s',
              }}
                onMouseEnter={e => { const el = e.currentTarget as HTMLElement; el.style.color = 'rgba(255,255,255,0.9)'; el.style.border = '1px solid rgba(255,255,255,0.25)'; el.style.background = 'rgba(255,255,255,0.07)'; }}
                onMouseLeave={e => { const el = e.currentTarget as HTMLElement; el.style.color = 'rgba(255,255,255,0.55)'; el.style.border = '1px solid rgba(255,255,255,0.1)'; el.style.background = 'transparent'; }}
              >{t('common.signIn')}</Link>
              <Link href="/inspection" className="desktop-only" style={{
                padding: '9px 18px', borderRadius: 10, fontSize: 13, fontWeight: 700,
                color: '#03131A', background: 'linear-gradient(135deg, #22d3ee, #06b6d4)',
                textDecoration: 'none', boxShadow: '0 4px 16px rgba(34,211,238,0.3)', transition: 'all 0.15s',
              }}
                onMouseEnter={e => { (e.currentTarget as HTMLElement).style.boxShadow = '0 6px 22px rgba(34,211,238,0.5)'; (e.currentTarget as HTMLElement).style.transform = 'translateY(-1px)'; }}
                onMouseLeave={e => { (e.currentTarget as HTMLElement).style.boxShadow = '0 4px 16px rgba(34,211,238,0.3)'; (e.currentTarget as HTMLElement).style.transform = ''; }}
              >{t('landing.startFree')}</Link>
            </>
          )}
        </div>
      </div>
    </nav>
  )
}
