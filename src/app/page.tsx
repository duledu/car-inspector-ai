'use client'

import Link from 'next/link'
import React, { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import '@/i18n/config'
import { useUserStore } from '@/store/useUserStore'
import { LanguageSwitcher } from '@/components/layout/LanguageSwitcher'

// ══════════════════════════════════════════════════════════════
// HOOKS
// ══════════════════════════════════════════════════════════════

/** Trigger a CSS class when element enters viewport */
function useReveal(threshold = 0.15) {
  const ref = useRef<HTMLDivElement>(null)
  const [visible, setVisible] = useState(false)
  useEffect(() => {
    const el = ref.current
    if (!el) return
    const obs = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) { setVisible(true); obs.disconnect() } },
      { threshold }
    )
    obs.observe(el)
    return () => obs.disconnect()
  }, [threshold])
  return { ref, visible }
}

/** Animate a number from 0 → target when triggered */
function useCountUp(target: number, duration = 1800, triggered = false) {
  const [value, setValue] = useState(0)
  useEffect(() => {
    if (!triggered) return
    let start: number | null = null
    const step = (ts: number) => {
      if (!start) start = ts
      const p = Math.min((ts - start) / duration, 1)
      // ease-out cubic
      const eased = 1 - (1 - p) ** 3
      setValue(Math.round(eased * target))
      if (p < 1) requestAnimationFrame(step)
    }
    requestAnimationFrame(step)
  }, [triggered, target, duration])
  return value
}

// ══════════════════════════════════════════════════════════════
// SHARED STYLES
// ══════════════════════════════════════════════════════════════

const glass: React.CSSProperties = {
  background: 'rgba(255,255,255,0.03)',
  border: '1px solid rgba(255,255,255,0.08)',
  backdropFilter: 'blur(20px)',
  WebkitBackdropFilter: 'blur(20px)',
}

// ══════════════════════════════════════════════════════════════
// NAV
// ══════════════════════════════════════════════════════════════

function LandingNav() {
  const [scrolled, setScrolled]   = useState(false)
  const [hydrated, setHydrated]   = useState(false)
  const [menuOpen, setMenuOpen]   = useState(false)
  const menuRef                   = useRef<HTMLDivElement>(null)
  const { user, isAuthenticated, logout } = useUserStore()
  const { t } = useTranslation()

  useEffect(() => {
    const h = () => setScrolled(window.scrollY > 20)
    window.addEventListener('scroll', h, { passive: true })
    return () => window.removeEventListener('scroll', h)
  }, [])

  // Prevent hydration mismatch — match AppShell pattern
  useEffect(() => { setHydrated(true) }, [])

  // Close dropdown on outside click
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

        <div style={{ display: 'flex', gap: 2, alignItems: 'center' }} className="desktop-only">
          {[
            { label: t('nav.inspect'), href: '/inspection' },
            { label: t('nav.premium'), href: '/premium' },
            { label: t('nav.community'), href: '/community' },
          ].map(item => (
            <Link key={item.href} href={item.href} style={{
              padding: '7px 14px', borderRadius: 8, fontSize: 13, fontWeight: 500,
              color: 'rgba(255,255,255,0.5)', textDecoration: 'none', transition: 'all 0.15s',
            }}>
              {item.label}
            </Link>
          ))}
        </div>

        {/* Auth buttons — opacity transition prevents hydration flash */}
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', justifyContent: 'flex-end',
          opacity: hydrated ? 1 : 0, transition: 'opacity 0.15s ease', flexShrink: 0 }}>

          {/* Language switcher — always visible on both mobile and desktop */}
          <LanguageSwitcher />

          {hydrated && isAuthenticated && user ? (
            /* ── Logged-in state ── */
            <div ref={menuRef} style={{ position: 'relative', display: 'flex', gap: 8, alignItems: 'center' }}>
              {/* Dashboard link — desktop only; mobile uses BottomNav / AppShell */}
              <Link href="/dashboard" className="desktop-only" style={{
                padding: '9px 16px', borderRadius: 10, fontSize: 13, fontWeight: 600,
                color: 'rgba(255,255,255,0.7)', border: '1px solid rgba(255,255,255,0.12)',
                background: 'rgba(255,255,255,0.05)', textDecoration: 'none',
                backdropFilter: 'blur(12px)', transition: 'all 0.15s', whiteSpace: 'nowrap',
              }}
                onMouseEnter={e => { const el = e.currentTarget as HTMLElement; el.style.color = 'rgba(255,255,255,0.92)'; el.style.border = '1px solid rgba(255,255,255,0.24)'; el.style.background = 'rgba(255,255,255,0.1)'; }}
                onMouseLeave={e => { const el = e.currentTarget as HTMLElement; el.style.color = 'rgba(255,255,255,0.7)'; el.style.border = '1px solid rgba(255,255,255,0.12)'; el.style.background = 'rgba(255,255,255,0.05)'; }}
              >{t('landing.dashboard')}</Link>

              {/* Avatar button */}
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

              {/* Dropdown */}
              {menuOpen && (
                <div style={{
                  position: 'absolute', top: 'calc(100% + 8px)', right: 0, minWidth: 180,
                  background: 'rgba(10,14,28,0.96)', border: '1px solid rgba(255,255,255,0.1)',
                  borderRadius: 12, backdropFilter: 'blur(24px)', WebkitBackdropFilter: 'blur(24px)',
                  boxShadow: '0 16px 48px rgba(0,0,0,0.5)', overflow: 'hidden', zIndex: 100,
                }}>
                  {/* User info */}
                  <div style={{ padding: '12px 14px 10px', borderBottom: '1px solid rgba(255,255,255,0.07)' }}>
                    <div style={{ fontSize: 13, fontWeight: 600, color: '#fff', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{user.name}</div>
                    <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.35)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{user.email}</div>
                  </div>
                  {/* Menu items */}
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
            /* ── Logged-out state ── */
            <>
              <Link href="/auth" style={{
                padding: '9px 16px', borderRadius: 10, fontSize: 13, fontWeight: 600,
                color: 'rgba(255,255,255,0.55)', border: '1px solid rgba(255,255,255,0.1)',
                background: 'transparent', textDecoration: 'none', transition: 'all 0.15s',
              }}
                onMouseEnter={e => { const el = e.currentTarget as HTMLElement; el.style.color = 'rgba(255,255,255,0.9)'; el.style.border = '1px solid rgba(255,255,255,0.25)'; el.style.background = 'rgba(255,255,255,0.07)'; }}
                onMouseLeave={e => { const el = e.currentTarget as HTMLElement; el.style.color = 'rgba(255,255,255,0.55)'; el.style.border = '1px solid rgba(255,255,255,0.1)'; el.style.background = 'transparent'; }}
              >{t('common.signIn')}</Link>
              {/* Start Free — desktop only; mobile hero already has a large CTA */}
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

// ══════════════════════════════════════════════════════════════
// HERO
// ══════════════════════════════════════════════════════════════

// ══════════════════════════════════════════════════════════════
// HERO CARD — premium 3D glass inspection preview
// ══════════════════════════════════════════════════════════════

function HeroCard() {
  const [hovered, setHovered] = useState(false)
  const { t } = useTranslation()

  return (
    <div className="animate-fade-up delay-2" style={{ display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
      {/* Float wrapper — animation only, no hover transform here */}
      <div style={{ animation: 'float 7s ease-in-out infinite', width: '100%', maxWidth: 380 }}>

        {/* Hover wrapper — lift transform only */}
        <div
          onMouseEnter={() => setHovered(true)}
          onMouseLeave={() => setHovered(false)}
          style={{
            position: 'relative',
            paddingBottom: 36,
            transform: hovered ? 'translateY(-8px)' : 'translateY(0)',
            transition: 'transform 0.4s cubic-bezier(0.23, 1, 0.32, 1)',
          }}
        >

          {/* ── Wide ambient glow — sits behind everything ── */}
          <div style={{
            position: 'absolute', inset: -60, pointerEvents: 'none', zIndex: 0,
            background: 'radial-gradient(ellipse 80% 70% at 50% 48%, rgba(34,211,238,0.18) 0%, rgba(129,140,248,0.08) 50%, transparent 75%)',
            opacity: hovered ? 1 : 0.7,
            transition: 'opacity 0.4s ease',
          }} />

          {/* ── Drop shadow card (depth illusion) ── */}
          <div style={{
            position: 'absolute', inset: 8, top: 12, zIndex: 1,
            borderRadius: 28,
            background: 'rgba(4,8,20,0.7)',
            filter: 'blur(20px)',
          }} />

          {/* ══ Main glass card ══ */}
          <div style={{
            position: 'relative', zIndex: 2,
            borderRadius: 24,
            overflow: 'hidden',
            background: 'rgba(6,10,24,0.32)',
            backdropFilter: 'blur(24px)',
            WebkitBackdropFilter: 'blur(24px)',
            border: '1px solid rgba(255,255,255,0.05)',
            boxShadow: [
              'inset 0 1px 0 rgba(255,255,255,0.1)',         // top glass edge
              'inset 0 -1px 0 rgba(0,0,0,0.2)',              // bottom inner shadow
              'inset 1px 0 0 rgba(255,255,255,0.03)',         // left inner edge
              '0 4px 6px rgba(0,0,0,0.25)',                  // contact shadow
              '0 20px 60px rgba(0,0,0,0.6)',                 // mid shadow
              '0 48px 100px rgba(0,0,0,0.45)',               // deep ambient
              `0 0 48px rgba(34,211,238,${hovered ? '0.13' : '0.055'})`, // soft cyan halo
            ].join(', '),
            transition: 'box-shadow 0.4s ease',
          }}>

            {/* ── Glass surface light — top-left radial ── */}
            <div style={{
              position: 'absolute', top: 0, left: 0, right: 0, height: '55%', pointerEvents: 'none',
              background: 'radial-gradient(ellipse 90% 60% at 15% -10%, rgba(34,211,238,0.13) 0%, rgba(129,140,248,0.05) 40%, transparent 70%)',
            }} />
            {/* ── Subtle noise/grain texture via repeating gradient ── */}
            <div style={{
              position: 'absolute', inset: 0, pointerEvents: 'none', opacity: 0.025,
              backgroundImage: 'url("data:image/svg+xml,%3Csvg viewBox=\'0 0 256 256\' xmlns=\'http://www.w3.org/2000/svg\'%3E%3Cfilter id=\'noise\'%3E%3CfeTurbulence type=\'fractalNoise\' baseFrequency=\'0.9\' numOctaves=\'4\' stitchTiles=\'stitch\'/%3E%3C/filter%3E%3Crect width=\'100%25\' height=\'100%25\' filter=\'url(%23noise)\'/%3E%3C/svg%3E")',
              backgroundSize: '128px 128px',
            }} />

            {/* ══ CARD HEADER ══ */}
            <div style={{ padding: '22px 22px 0' }}>
              <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>

                {/* Left: vehicle info */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  {/* Live badge */}
                  <div style={{
                    display: 'inline-flex', alignItems: 'center', gap: 5,
                    padding: '3px 8px 3px 6px', borderRadius: 6, marginBottom: 10,
                    background: 'rgba(34,211,238,0.08)',
                    border: '1px solid rgba(34,211,238,0.2)',
                  }}>
                    <span style={{ width: 5, height: 5, borderRadius: '50%', background: '#22d3ee', boxShadow: '0 0 6px #22d3ee', animation: 'pulse-dot 2s infinite', flexShrink: 0 }} />
                    <span style={{ fontSize: 10, fontWeight: 700, color: '#22d3ee', letterSpacing: '0.08em', textTransform: 'uppercase' }}>{t('landing.heroCard.liveInspection')}</span>
                  </div>
                  <div style={{ fontSize: 18, fontWeight: 900, color: '#fff', letterSpacing: '-0.6px', lineHeight: 1.15, marginBottom: 5, textShadow: '0 1px 12px rgba(0,0,0,0.6)' }}>2019 BMW 3 Series</div>
                  <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.58)', letterSpacing: '-0.1px' }}>87 000 km &nbsp;·&nbsp; 14 500 EUR</div>
                </div>

                {/* Right: score ring */}
                <div style={{ position: 'relative', flexShrink: 0 }}>
                  {/* Pulse ring glow */}
                  <div style={{
                    position: 'absolute', inset: -8, borderRadius: '50%', pointerEvents: 'none',
                    background: 'radial-gradient(circle, rgba(34,211,238,0.25) 0%, transparent 65%)',
                    animation: 'glow-pulse 2.8s ease-in-out infinite',
                  }} />
                  <svg width="72" height="72" viewBox="0 0 72 72" style={{ display: 'block' }}>
                    {/* Track */}
                    <circle cx="36" cy="36" r="29" fill="none" stroke="rgba(255,255,255,0.05)" strokeWidth="5"/>
                    {/* Filled arc */}
                    <circle cx="36" cy="36" r="29" fill="none"
                      stroke="url(#sg)" strokeWidth="5"
                      strokeLinecap="round"
                      strokeDasharray={`${2 * Math.PI * 29}`}
                      strokeDashoffset={`${2 * Math.PI * 29 * (1 - 0.87)}`}
                      transform="rotate(-90 36 36)"
                      style={{ filter: 'drop-shadow(0 0 7px rgba(34,211,238,0.9))' }}
                    />
                    <defs>
                      <linearGradient id="sg" x1="0" y1="0" x2="1" y2="1">
                        <stop offset="0%" stopColor="#22d3ee"/>
                        <stop offset="100%" stopColor="#818cf8"/>
                      </linearGradient>
                    </defs>
                    <text x="36" y="40" textAnchor="middle" fontSize="17" fontWeight="900" fill="#fff" letterSpacing="-1">87</text>
                  </svg>
                </div>
              </div>

              {/* Divider */}
              <div style={{ height: 1, background: 'linear-gradient(90deg, rgba(255,255,255,0.08) 0%, rgba(34,211,238,0.12) 50%, rgba(255,255,255,0.02) 100%)', margin: '18px 0 16px' }} />
            </div>

            {/* ══ PROGRESS ══ */}
            <div style={{ padding: '0 22px 18px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 8 }}>
                <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', fontWeight: 500, letterSpacing: '0.02em' }}>{t('landing.heroCard.progress')}</span>
                <span style={{ fontSize: 12, color: '#22d3ee', fontWeight: 800, letterSpacing: '-0.3px' }}>73%</span>
              </div>
              {/* Track */}
              <div style={{ height: 6, background: 'rgba(255,255,255,0.05)', borderRadius: 99, overflow: 'visible', position: 'relative' }}>
                {/* Fill */}
                <div style={{
                  position: 'absolute', left: 0, top: 0, bottom: 0, width: '73%',
                  background: 'linear-gradient(90deg, #22d3ee 0%, #818cf8 100%)',
                  borderRadius: 99,
                  boxShadow: '0 0 12px rgba(34,211,238,0.6), 0 0 24px rgba(34,211,238,0.25)',
                }} />
                {/* Thumb dot */}
                <div style={{
                  position: 'absolute', top: '50%', left: '73%',
                  transform: 'translate(-50%, -50%)',
                  width: 12, height: 12, borderRadius: '50%',
                  background: '#fff',
                  boxShadow: '0 0 8px rgba(34,211,238,0.9), 0 0 20px rgba(34,211,238,0.4)',
                  border: '2px solid rgba(34,211,238,0.6)',
                }} />
              </div>
            </div>

            {/* ══ PHASE CHIPS ══ */}
            <div style={{ padding: '0 22px 18px', display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              {[
                { l: t('phase.EXTERIOR'),   done: true  },
                { l: t('phase.INTERIOR'),   done: true  },
                { l: t('phase.MECHANICAL'), done: false },
                { l: t('phase.TEST_DRIVE'), done: false },
              ].map(p => (
                <span key={p.l} style={{
                  padding: '5px 12px', borderRadius: 99, fontSize: 11, fontWeight: 600,
                  background: p.done ? 'rgba(34,197,94,0.12)' : 'rgba(255,255,255,0.04)',
                  border: `1px solid ${p.done ? 'rgba(34,197,94,0.3)' : 'rgba(255,255,255,0.08)'}`,
                  color: p.done ? '#4ade80' : 'rgba(255,255,255,0.3)',
                  display: 'inline-flex', alignItems: 'center', gap: 5,
                  boxShadow: p.done ? '0 0 10px rgba(34,197,94,0.18), inset 0 1px 0 rgba(34,197,94,0.1)' : 'none',
                }}>
                  {p.done
                    ? <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
                    : <div style={{ width: 5, height: 5, borderRadius: '50%', background: 'rgba(255,255,255,0.2)' }} />
                  }
                  {p.l}
                </span>
              ))}
            </div>

            {/* ══ AI FINDINGS ══ */}
            <div style={{
              margin: '0 12px 12px',
              borderRadius: 16,
              background: 'rgba(4,10,24,0.6)',
              border: '1px solid rgba(34,211,238,0.12)',
              overflow: 'hidden',
            }}>
              {/* Panel header */}
              <div style={{
                padding: '10px 14px',
                borderBottom: '1px solid rgba(255,255,255,0.05)',
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                background: 'linear-gradient(90deg, rgba(34,211,238,0.06) 0%, transparent 100%)',
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="#22d3ee" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
                  </svg>
                  <span style={{ fontSize: 10, fontWeight: 700, color: '#22d3ee', textTransform: 'uppercase', letterSpacing: '0.1em' }}>{t('report.aiFindings')}</span>
                </div>
                <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.3)', fontWeight: 600 }}>{t('landing.heroCard.detected', { count: 3 })}</span>
              </div>
              {/* Findings rows */}
              {[
                { l: t('landing.heroCard.finding.panelGap'),  s: 'warn', label: t('inspection.statusWarning') },
                { l: t('landing.heroCard.finding.repaint'),   s: 'warn', label: t('inspection.statusWarning') },
                { l: t('landing.heroCard.finding.engineBay'), s: 'ok',   label: t('landing.heroCard.clear')   },
              ].map((f, i, arr) => (
                <div key={f.l} style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  padding: '9px 14px',
                  borderBottom: i < arr.length - 1 ? '1px solid rgba(255,255,255,0.04)' : 'none',
                  gap: 10,
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
                    <div style={{
                      width: 7, height: 7, borderRadius: '50%', flexShrink: 0,
                      background: f.s === 'ok' ? '#22c55e' : '#f59e0b',
                      boxShadow: `0 0 8px ${f.s === 'ok' ? 'rgba(34,197,94,0.9)' : 'rgba(245,158,11,0.9)'}`,
                    }} />
                    <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.82)', letterSpacing: '-0.1px', textShadow: '0 1px 8px rgba(0,0,0,0.5)' }}>{f.l}</span>
                  </div>
                  <span style={{
                    fontSize: 10, fontWeight: 700, letterSpacing: '0.04em',
                    color: f.s === 'ok' ? 'rgba(34,197,94,0.8)' : 'rgba(245,158,11,0.8)',
                    flexShrink: 0,
                  }}>{f.label}</span>
                </div>
              ))}
            </div>
          </div>

          {/* ── AI pill — floats below card ── */}
          <div style={{
            position: 'absolute', bottom: 4, left: '50%', transform: 'translateX(-50%)',
            zIndex: 3,
            display: 'inline-flex', alignItems: 'center', gap: 8,
            padding: '9px 20px', borderRadius: 99, whiteSpace: 'nowrap',
            background: 'rgba(6,12,28,0.92)',
            border: '1px solid rgba(34,211,238,0.28)',
            backdropFilter: 'blur(20px)',
            WebkitBackdropFilter: 'blur(20px)',
            fontSize: 12, fontWeight: 700, color: '#22d3ee',
            boxShadow: '0 8px 32px rgba(0,0,0,0.6), 0 0 20px rgba(34,211,238,0.15), inset 0 1px 0 rgba(255,255,255,0.08)',
          }}>
            <span style={{ width: 7, height: 7, borderRadius: '50%', background: '#22d3ee', boxShadow: '0 0 10px #22d3ee, 0 0 20px rgba(34,211,238,0.5)', animation: 'pulse-dot 2s infinite', flexShrink: 0 }} />
            {t('landing.heroCard.analysingPhotos')}
          </div>
        </div>
      </div>
    </div>
  )
}

function Hero() {
  const { t } = useTranslation()

  return (
    <section style={{ position: 'relative', minHeight: '100svh', display: 'flex', alignItems: 'center', overflow: 'hidden', padding: '100px 20px 80px' }}>

      {/* ── Deep atmosphere ── */}
      <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}>
        {/* Base gradient */}
        <div style={{ position: 'absolute', inset: 0, background: 'radial-gradient(ellipse 120% 80% at 50% 0%, rgba(34,211,238,0.06) 0%, transparent 55%)' }} />
        {/* Left glow orb */}
        <div style={{ position: 'absolute', top: '5%', left: '-8%', width: 700, height: 700, borderRadius: '50%', background: 'radial-gradient(circle, rgba(34,211,238,0.07) 0%, transparent 65%)', animation: 'orb-drift 22s ease-in-out infinite' }} />
        {/* Right glow orb */}
        <div style={{ position: 'absolute', top: '35%', right: '-12%', width: 600, height: 600, borderRadius: '50%', background: 'radial-gradient(circle, rgba(129,140,248,0.07) 0%, transparent 65%)', animation: 'orb-drift 28s ease-in-out infinite reverse' }} />
        {/* Bottom orb */}
        <div style={{ position: 'absolute', bottom: '-10%', left: '25%', width: 800, height: 400, borderRadius: '50%', background: 'radial-gradient(circle, rgba(168,85,247,0.04) 0%, transparent 70%)' }} />
        {/* Diagonal light beam */}
        <div style={{ position: 'absolute', top: '-20%', left: '-10%', width: '60%', height: '140%', background: 'linear-gradient(110deg, transparent 40%, rgba(34,211,238,0.025) 50%, transparent 60%)', transform: 'skewX(-15deg)' }} />
        {/* Dot grid */}
        <div style={{
          position: 'absolute', inset: 0,
          backgroundImage: 'radial-gradient(rgba(255,255,255,0.06) 1px, transparent 1px)',
          backgroundSize: '40px 40px',
          maskImage: 'radial-gradient(ellipse 80% 60% at 50% 40%, black 30%, transparent 80%)',
        }} />
        {/* ── Cinematic car — full-bleed, mask-faded, zero hard edges ── */}
        <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}>

          {/* Hero visual — 30% larger, shifted right, left overflow for dynamism */}
          <img
            src="/icons/cardoctorImg.jpg"
            alt=""
            aria-hidden="true"
            style={{
              position: 'absolute',
              top: '50%',
              right: '-8%',          /* shift right so car dominates the frame */
              transform: 'translateY(-50%)',
              height: '182%',        /* was ~140%, +30% ≈ 182% */
              width: 'auto',
              maxWidth: '90%',       /* allow more left overflow */
              objectFit: 'contain',
              objectPosition: 'right center',
              opacity: 0.96,
              filter: 'brightness(0.9) saturate(0.82) contrast(1.05)',
              /* Softer left fade — starts later so car bleeds left naturally */
              WebkitMaskImage: 'linear-gradient(to right, transparent 0%, rgba(0,0,0,0.15) 10%, rgba(0,0,0,0.6) 26%, black 46%)',
              maskImage:       'linear-gradient(to right, transparent 0%, rgba(0,0,0,0.15) 10%, rgba(0,0,0,0.6) 26%, black 46%)',
            }}
          />

          {/* Dark base — reduced from 0.38 → 0.30 (-20% opacity) */}
          <div style={{
            position: 'absolute', inset: 0,
            background: 'rgba(8,12,20,0.30)',
          }} />

          {/* Bottom vignette — image sinks into page */}
          <div style={{
            position: 'absolute', bottom: 0, left: 0, right: 0, height: '58%',
            background: 'linear-gradient(to top, #080c14 0%, #080c14 12%, rgba(8,12,20,0.72) 38%, transparent 100%)',
          }} />

          {/* Top vignette */}
          <div style={{
            position: 'absolute', top: 0, left: 0, right: 0, height: '32%',
            background: 'linear-gradient(to bottom, #080c14 0%, rgba(8,12,20,0.55) 45%, transparent 100%)',
          }} />

          {/* Left anchor — text-side darkness, reduced from 0.92 → 0.74 for -20% opacity feel */}
          <div style={{
            position: 'absolute', top: 0, bottom: 0, left: 0, width: '42%',
            background: 'linear-gradient(to right, #080c14 0%, rgba(8,12,20,0.74) 40%, transparent 100%)',
          }} />

          {/* Blur transition band — feathered zone between text and car */}
          <div style={{
            position: 'absolute', top: 0, bottom: 0, left: '28%', width: '22%',
            backdropFilter: 'blur(6px)',
            WebkitBackdropFilter: 'blur(6px)',
            maskImage: 'linear-gradient(to right, rgba(0,0,0,0.6) 0%, rgba(0,0,0,0.3) 50%, transparent 100%)',
            WebkitMaskImage: 'linear-gradient(to right, rgba(0,0,0,0.6) 0%, rgba(0,0,0,0.3) 50%, transparent 100%)',
          }} />

          {/* Right edge vignette */}
          <div style={{
            position: 'absolute', top: 0, bottom: 0, right: 0, width: '14%',
            background: 'linear-gradient(to left, #080c14 0%, transparent 100%)',
          }} />

          {/* Premium soft vignette — radial darkening at all four corners */}
          <div style={{
            position: 'absolute', inset: 0,
            background: 'radial-gradient(ellipse 110% 90% at 52% 48%, transparent 42%, rgba(4,8,18,0.55) 75%, rgba(4,8,18,0.82) 100%)',
          }} />

          {/* Atmosphere bloom — subtle indigo haze behind the car */}
          <div style={{
            position: 'absolute', top: '10%', right: '2%', width: '60%', height: '80%',
            background: 'radial-gradient(ellipse at 65% 45%, rgba(129,140,248,0.06) 0%, transparent 68%)',
          }} />

          {/* Cinematic car highlight glow */}
          <div style={{
            position: 'absolute', top: '20%', right: '10%', width: '50%', height: '55%',
            background: 'radial-gradient(ellipse at 60% 40%, rgba(255,255,255,0.03) 0%, transparent 65%)',
          }} />

        </div>
      </div>

      <div style={{ maxWidth: 1200, margin: '0 auto', width: '100%', position: 'relative' }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 56, alignItems: 'center' }}>

          {/* Text */}
          <div className="animate-fade-up">
            <div style={{ marginBottom: 24 }}>
              <span style={{
                display: 'inline-flex', alignItems: 'center', gap: 7,
                padding: '6px 14px', borderRadius: 100,
                background: 'rgba(34,211,238,0.07)', border: '1px solid rgba(34,211,238,0.2)',
                fontSize: 12, fontWeight: 600, color: '#22d3ee',
              }}>
                <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#22d3ee', boxShadow: '0 0 8px #22d3ee', animation: 'pulse-dot 2s infinite' }} />
                {t('landing.hero.badge')}
              </span>
            </div>

            <h1 style={{ margin: '0 0 20px', fontSize: 'clamp(36px, 6vw, 60px)', fontWeight: 900, letterSpacing: '-2.5px', lineHeight: 1.03, color: '#fff' }}>
              {t('landing.hero.title')}<br />
              <span style={{ background: 'linear-gradient(95deg, #22d3ee 0%, #818cf8 60%, #a78bfa 100%)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text' }}>
                {t('landing.hero.titleAccent')}
              </span>
            </h1>

            <p style={{ margin: '0 0 32px', fontSize: 17, color: 'rgba(255,255,255,0.48)', lineHeight: 1.7, maxWidth: 440 }}>
              {t('landing.hero.subtitle')}
            </p>

            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, marginBottom: 24 }}>
              <Link href="/inspection" style={{
                padding: '15px 30px', borderRadius: 14,
                background: 'linear-gradient(135deg, #22d3ee, #06b6d4)',
                color: '#03131A', fontSize: 14, fontWeight: 700,
                textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: 8,
                boxShadow: '0 8px 36px rgba(34,211,238,0.38)',
                transition: 'transform 0.2s, box-shadow 0.2s',
              }}
                onMouseEnter={e => { (e.currentTarget as HTMLElement).style.transform = 'translateY(-2px)'; (e.currentTarget as HTMLElement).style.boxShadow = '0 14px 44px rgba(34,211,238,0.55)'; }}
                onMouseLeave={e => { (e.currentTarget as HTMLElement).style.transform = ''; (e.currentTarget as HTMLElement).style.boxShadow = '0 8px 36px rgba(34,211,238,0.38)'; }}
              >
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <polygon points="5 3 19 12 5 21 5 3"/>
                </svg>
                {t('landing.hero.startInspection')}
              </Link>
              <Link href="/dashboard" style={{
                padding: '15px 24px', borderRadius: 14,
                background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.12)',
                color: 'rgba(255,255,255,0.7)', fontSize: 14, fontWeight: 600,
                textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: 8,
                backdropFilter: 'blur(12px)', transition: 'all 0.2s',
              }}
                onMouseEnter={e => { const el = e.currentTarget as HTMLElement; el.style.background = 'rgba(255,255,255,0.1)'; el.style.border = '1px solid rgba(255,255,255,0.24)'; el.style.color = 'rgba(255,255,255,0.92)'; el.style.transform = 'translateY(-1px)'; }}
                onMouseLeave={e => { const el = e.currentTarget as HTMLElement; el.style.background = 'rgba(255,255,255,0.05)'; el.style.border = '1px solid rgba(255,255,255,0.12)'; el.style.color = 'rgba(255,255,255,0.7)'; el.style.transform = ''; }}
              >
                {t('landing.hero.viewDashboard')}
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 18 15 12 9 6"/></svg>
              </Link>
            </div>

            {/* Trust strip */}
            <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'nowrap', gap: 0 }}>
              {[
                { v: '124K+', l: t('landing.hero.trust.inspections') },
                { v: '96%', l: t('landing.hero.trust.accuracy') },
                { v: '31K', l: t('landing.hero.trust.reports') },
              ].map((trust, i) => (
                <div key={trust.l} style={{ display: 'flex', alignItems: 'center', gap: 0, flexShrink: 0 }}>
                  {i > 0 && <div style={{ width: 1, height: 18, background: 'rgba(255,255,255,0.1)', margin: '0 10px' }} />}
                  <div style={{ display: 'flex', alignItems: 'baseline', gap: 4 }}>
                    <span style={{ fontSize: 'clamp(14px, 3.8vw, 18px)', fontWeight: 800, color: '#fff', letterSpacing: '-0.5px' }}>{trust.v}</span>
                    <span style={{ fontSize: 'clamp(9px, 2.4vw, 11px)', color: 'rgba(255,255,255,0.35)', fontWeight: 500 }}>{trust.l}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Preview card */}
          <HeroCard />
        </div>
      </div>
    </section>
  )
}

// ══════════════════════════════════════════════════════════════
// STATS — animated counters, premium 2×2 grid
// ══════════════════════════════════════════════════════════════

function StatsSection() {
  const { ref, visible } = useReveal(0.2)
  const { t } = useTranslation()

  const stats = [
    {
      target: 124, suffix: 'K+', label: t('landing.stats.inspections.label'), sub: t('landing.stats.inspections.sub'), color: '#22d3ee', delay: 0,
      icon: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M9 5H7a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-2"/><rect x="9" y="3" width="6" height="4" rx="1"/><path d="m9 12 2 2 4-4"/></svg>,
    },
    {
      target: 89, suffix: 'K', label: t('landing.stats.risks.label'), sub: t('landing.stats.risks.sub'), color: '#818cf8', delay: 150,
      icon: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"/><path d="M12 9v4"/><circle cx="12" cy="17" r="1" fill="currentColor"/></svg>,
    },
    {
      target: 31, suffix: 'K', label: t('landing.stats.reports.label'), sub: t('landing.stats.reports.sub'), color: '#a855f7', delay: 300,
      icon: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>,
    },
    {
      target: 96, suffix: '%', label: t('landing.stats.confidence.label'), sub: t('landing.stats.confidence.sub'), color: '#22c55e', delay: 450,
      icon: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/><path d="m9 12 2 2 4-4"/></svg>,
    },
  ]

  return (
    <section style={{ position: 'relative', overflow: 'hidden', padding: '0 20px' }}>
      {/* Section atmosphere — layered depth */}
      <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}>
        <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(180deg, transparent 0%, rgba(8,12,20,0.7) 20%, rgba(8,12,20,0.7) 80%, transparent 100%)' }} />
        <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%,-50%)', width: 1000, height: 500, borderRadius: '50%', background: 'radial-gradient(ellipse, rgba(34,211,238,0.05) 0%, transparent 60%)' }} />
        <div style={{ position: 'absolute', top: '50%', right: '-10%', transform: 'translateY(-50%)', width: 500, height: 500, borderRadius: '50%', background: 'radial-gradient(circle, rgba(129,140,248,0.04) 0%, transparent 65%)' }} />
        <div style={{ position: 'absolute', top: '50%', left: '-10%', transform: 'translateY(-50%)', width: 400, height: 400, borderRadius: '50%', background: 'radial-gradient(circle, rgba(168,85,247,0.04) 0%, transparent 65%)' }} />
        <div style={{ position: 'absolute', inset: 0, borderTop: '1px solid rgba(255,255,255,0.06)', borderBottom: '1px solid rgba(255,255,255,0.06)' }} />
        {/* Diagonal shimmer */}
        <div style={{ position: 'absolute', top: '-30%', left: '20%', width: '40%', height: '160%', background: 'linear-gradient(110deg, transparent 40%, rgba(34,211,238,0.018) 50%, transparent 60%)', transform: 'skewX(-20deg)', pointerEvents: 'none' }} />
      </div>

      <div ref={ref} style={{ maxWidth: 1200, margin: '0 auto', padding: 'clamp(56px, 8vw, 96px) 0', position: 'relative' }}>

        {/* Header */}
        <div style={{ textAlign: 'center', marginBottom: 'clamp(32px, 5vw, 56px)' as any }}>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 7, padding: '5px 14px', borderRadius: 100, background: 'rgba(34,211,238,0.07)', border: '1px solid rgba(34,211,238,0.18)', fontSize: 11, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: '#22d3ee', marginBottom: 20 }}>
            <span style={{ width: 5, height: 5, borderRadius: '50%', background: '#22d3ee', boxShadow: '0 0 6px #22d3ee' }} />
            {t('landing.stats.badge')}
          </div>
          <h2 style={{ margin: '0 0 14px', fontSize: 'clamp(26px, 4vw, 40px)', fontWeight: 900, letterSpacing: '-1.5px', color: '#fff', lineHeight: 1.1 }}>
            {t('landing.stats.title')}
          </h2>
          <p style={{ margin: '0 auto', fontSize: 15, color: 'rgba(255,255,255,0.38)', maxWidth: 420, lineHeight: 1.65 }}>
            {t('landing.stats.subtitle')}
          </p>
        </div>

        {/* 2×2 stat grid — minmax(150px) enables 2-col on mobile */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 12 }}>
          {stats.map((s) => (
            <AnimatedStatCard key={s.label} {...s} triggered={visible} />
          ))}
        </div>
      </div>
    </section>
  )
}

function AnimatedStatCard({ target, suffix, label, sub, color, delay, triggered, icon }: Readonly<{
  target: number; suffix: string; label: string; sub: string; color: string; delay: number; triggered: boolean; icon: React.ReactNode;
}>) {
  const [active, setActive] = useState(false)
  useEffect(() => {
    if (!triggered) return
    const t = setTimeout(() => setActive(true), delay)
    return () => clearTimeout(t)
  }, [triggered, delay])

  const count = useCountUp(target, 1600, active)

  return (
    <div
      style={{
        position: 'relative', borderRadius: 20,
        background: 'rgba(255,255,255,0.025)',
        border: '1px solid rgba(255,255,255,0.07)',
        padding: 'clamp(20px, 3vw, 28px) clamp(16px, 2.5vw, 24px)',
        overflow: 'hidden',
        opacity: active ? 1 : 0,
        transform: active ? 'translateY(0)' : 'translateY(20px)',
        transition: `opacity 0.6s ease, transform 0.6s ease`,
      }}
      onMouseEnter={e => {
        const el = e.currentTarget as HTMLElement
        el.style.background = `${color}08`
        el.style.borderColor = `${color}25`
        el.style.transform = 'translateY(-4px)'
        el.style.boxShadow = `0 24px 48px rgba(0,0,0,0.35), 0 0 0 1px ${color}18, inset 0 1px 0 ${color}12`
      }}
      onMouseLeave={e => {
        const el = e.currentTarget as HTMLElement
        el.style.background = 'rgba(255,255,255,0.025)'
        el.style.borderColor = 'rgba(255,255,255,0.07)'
        el.style.transform = active ? 'translateY(0)' : 'translateY(20px)'
        el.style.boxShadow = ''
      }}
    >
      {/* Top accent line */}
      <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 2, borderRadius: '0 0 2px 2px', background: `linear-gradient(90deg, transparent 10%, ${color}70 50%, transparent 90%)` }} />
      {/* Corner glow */}
      <div style={{ position: 'absolute', top: -30, right: -30, width: 130, height: 130, borderRadius: '50%', background: `radial-gradient(circle, ${color}12 0%, transparent 65%)`, pointerEvents: 'none' }} />
      {/* Bottom left glow */}
      <div style={{ position: 'absolute', bottom: -20, left: -20, width: 80, height: 80, borderRadius: '50%', background: `radial-gradient(circle, ${color}08 0%, transparent 70%)`, pointerEvents: 'none' }} />

      {/* Icon */}
      <div style={{ width: 44, height: 44, borderRadius: 13, background: `${color}10`, border: `1px solid ${color}22`, display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 20, color }}>
        {icon}
      </div>

      {/* Number */}
      <div style={{ marginBottom: 8, display: 'flex', alignItems: 'baseline', gap: 2, flexWrap: 'nowrap', minWidth: 0 }}>
        <span style={{ fontSize: 'clamp(36px, 4.5vw, 52px)', fontWeight: 900, letterSpacing: '-2px', lineHeight: 1, color: '#fff', flexShrink: 1 }}>
          {count.toLocaleString()}
        </span>
        <span style={{ fontSize: 'clamp(22px, 3vw, 28px)', fontWeight: 800, letterSpacing: '-0.5px', color, flexShrink: 0 }}>{suffix}</span>
      </div>

      <div style={{ fontSize: 15, fontWeight: 700, color: 'rgba(255,255,255,0.85)', marginBottom: 6, letterSpacing: '-0.2px' }}>{label}</div>
      <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.35)', lineHeight: 1.55 }}>{sub}</div>
    </div>
  )
}

// ══════════════════════════════════════════════════════════════
// FEATURES
// ══════════════════════════════════════════════════════════════

function Features() {
  const { ref, visible } = useReveal(0.1)
  const { t } = useTranslation()

  const features = [
    { title: t('landing.features.risk.title'), desc: t('landing.features.risk.desc'), href: '/inspection', cta: t('landing.features.risk.cta'), color: '#22d3ee', icon: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg> },
    { title: t('landing.features.research.title'), desc: t('landing.features.research.desc'), href: '/inspection', cta: t('landing.features.research.cta'), color: '#818cf8', icon: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg> },
    { title: t('landing.features.photo.title'), desc: t('landing.features.photo.desc'), href: '/inspection', cta: t('landing.features.photo.cta'), color: '#22d3ee', icon: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/></svg> },
    { title: t('landing.features.guided.title'), desc: t('landing.features.guided.desc'), href: '/inspection', cta: t('landing.features.guided.cta'), color: '#818cf8', icon: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M9 11l3 3L22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/></svg> },
    { title: t('landing.features.premium.title'), desc: t('landing.features.premium.desc'), href: '/premium', cta: t('landing.features.premium.cta'), color: '#a855f7', icon: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg> },
    { title: t('landing.features.report.title'), desc: t('landing.features.report.desc'), href: '/report', cta: t('landing.features.report.cta'), color: '#22c55e', icon: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg> },
  ]

  return (
    <section style={{ maxWidth: 1200, margin: '0 auto', padding: 'clamp(56px, 8vw, 96px) 20px' }}>
      <div style={{ textAlign: 'center', marginBottom: 'clamp(32px, 5vw, 56px)' as any }}>
        <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 11, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: '#22d3ee', marginBottom: 16 }}>{t('landing.features.badge')}</div>
        <h2 style={{ margin: '0 0 14px', fontSize: 'clamp(26px, 4vw, 40px)', fontWeight: 900, letterSpacing: '-1.5px', color: '#fff' }}>{t('landing.features.title')}</h2>
        <p style={{ fontSize: 15, color: 'rgba(255,255,255,0.4)', maxWidth: 460, margin: '0 auto', lineHeight: 1.65 }}>{t('landing.features.subtitle')}</p>
      </div>

      <div ref={ref} style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(290px, 1fr))', gap: 10 }}>
        {features.map((f, i) => (
          <Link key={f.title} href={f.href} style={{ textDecoration: 'none' }}>
            <div style={{
              ...glass, borderRadius: 20, padding: 24, height: '100%',
              display: 'flex', flexDirection: 'column', gap: 14, cursor: 'pointer',
              opacity: visible ? 1 : 0, transform: visible ? 'translateY(0)' : 'translateY(24px)',
              transition: `opacity 0.5s ease ${i * 60}ms, transform 0.5s ease ${i * 60}ms, background 0.2s, border-color 0.2s, box-shadow 0.2s`,
            }}
              onMouseEnter={e => {
                const el = e.currentTarget as HTMLElement
                el.style.background = `${f.color}06`
                el.style.borderColor = `${f.color}20`
                el.style.boxShadow = `0 16px 40px rgba(0,0,0,0.25), 0 0 0 1px ${f.color}10`
                el.style.transform = 'translateY(-3px)'
              }}
              onMouseLeave={e => {
                const el = e.currentTarget as HTMLElement
                el.style.background = 'rgba(255,255,255,0.03)'
                el.style.borderColor = 'rgba(255,255,255,0.08)'
                el.style.boxShadow = ''
                el.style.transform = visible ? 'translateY(0)' : 'translateY(24px)'
              }}
            >
              <div style={{ width: 44, height: 44, borderRadius: 13, background: `${f.color}12`, border: `1px solid ${f.color}25`, display: 'flex', alignItems: 'center', justifyContent: 'center', color: f.color }}>
                {f.icon}
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 15, fontWeight: 700, color: '#fff', marginBottom: 8, letterSpacing: '-0.2px' }}>{f.title}</div>
                <p style={{ margin: 0, fontSize: 13, color: 'rgba(255,255,255,0.42)', lineHeight: 1.65 }}>{f.desc}</p>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 12, fontWeight: 600, color: f.color }}>
                {f.cta}
                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 18 15 12 9 6"/></svg>
              </div>
            </div>
          </Link>
        ))}
      </div>
    </section>
  )
}

// ══════════════════════════════════════════════════════════════
// HOW IT WORKS — premium cinematic step cards
// ══════════════════════════════════════════════════════════════

const STEP_ICONS = [
  <svg key="car" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><path d="M5 17H3a2 2 0 0 1-2-2V9a2 2 0 0 1 2-2h13l4 4v4a2 2 0 0 1-2 2h-2"/><circle cx="7.5" cy="17.5" r="2.5"/><circle cx="17.5" cy="17.5" r="2.5"/></svg>,
  <svg key="search" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/><path d="M11 8v6M8 11h6"/></svg>,
  <svg key="camera" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/></svg>,
  <svg key="shield" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>,
]

const STEP_COLORS = ['#22d3ee', '#818cf8', '#a855f7', '#22c55e'] as const

function HowItWorks() {
  const { ref, visible } = useReveal(0.1)
  const { t } = useTranslation()

  const steps = [
    { n: '01', title: t('landing.workflow.step1.title'), desc: t('landing.workflow.step1.desc'), href: '/vehicle' },
    { n: '02', title: t('landing.workflow.step2.title'), desc: t('landing.workflow.step2.desc'), href: '/inspection' },
    { n: '03', title: t('landing.workflow.step3.title'), desc: t('landing.workflow.step3.desc'), href: '/inspection' },
    { n: '04', title: t('landing.workflow.step4.title'), desc: t('landing.workflow.step4.desc'), href: '/report' },
  ]

  return (
    <section style={{ position: 'relative', overflow: 'hidden' }}>
      {/* Premium section background — layered depth */}
      <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}>
        <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(180deg, transparent 0%, rgba(10,15,26,0.65) 20%, rgba(10,15,26,0.65) 80%, transparent 100%)' }} />
        {/* Center indigo orb */}
        <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%,-50%)', width: 1000, height: 600, borderRadius: '50%', background: 'radial-gradient(ellipse, rgba(129,140,248,0.07) 0%, transparent 60%)' }} />
        {/* Left cyan accent */}
        <div style={{ position: 'absolute', top: '30%', left: '-5%', width: 400, height: 400, borderRadius: '50%', background: 'radial-gradient(circle, rgba(34,211,238,0.04) 0%, transparent 65%)', animation: 'orb-drift 26s ease-in-out infinite' }} />
        {/* Right purple accent */}
        <div style={{ position: 'absolute', bottom: '20%', right: '-5%', width: 350, height: 350, borderRadius: '50%', background: 'radial-gradient(circle, rgba(168,85,247,0.05) 0%, transparent 65%)' }} />
        {/* Diagonal light */}
        <div style={{ position: 'absolute', top: '-20%', right: '5%', width: '40%', height: '140%', background: 'linear-gradient(110deg, transparent 40%, rgba(129,140,248,0.022) 50%, transparent 60%)', transform: 'skewX(-10deg)' }} />
        {/* Dot grid — subtle */}
        <div style={{
          position: 'absolute', inset: 0,
          backgroundImage: 'radial-gradient(rgba(255,255,255,0.04) 1px, transparent 1px)',
          backgroundSize: '48px 48px',
          maskImage: 'radial-gradient(ellipse 70% 50% at 50% 50%, black 20%, transparent 75%)',
        }} />
      </div>

      <div style={{ maxWidth: 1200, margin: '0 auto', padding: 'clamp(56px, 8vw, 96px) 20px', position: 'relative' }}>
        {/* Header */}
        <div style={{ textAlign: 'center', marginBottom: 'clamp(36px, 5vw, 64px)' as any }}>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 7, padding: '5px 14px', borderRadius: 100, background: 'rgba(129,140,248,0.07)', border: '1px solid rgba(129,140,248,0.18)', fontSize: 11, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: '#818cf8', marginBottom: 20 }}>
            <span style={{ width: 5, height: 5, borderRadius: '50%', background: '#818cf8', boxShadow: '0 0 6px #818cf8' }} />
            {t('landing.workflow.badge')}
          </div>
          <h2 style={{ margin: '0 0 14px', fontSize: 'clamp(26px, 4vw, 40px)', fontWeight: 900, letterSpacing: '-1.5px', color: '#fff', lineHeight: 1.1 }}>
            {t('landing.workflow.title')}
          </h2>
          <p style={{ fontSize: 15, color: 'rgba(255,255,255,0.38)', maxWidth: 420, margin: '0 auto', lineHeight: 1.65 }}>
            {t('landing.workflow.subtitle')}
          </p>
        </div>

        {/* Step cards — minmax(160px) enables 2-col on mobile */}
        <div ref={ref} style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 14 }}>
          {steps.map((step, i) => (
            <Link key={step.n} href={step.href} style={{ textDecoration: 'none' }}>
              <div style={{
                position: 'relative', borderRadius: 22, padding: 'clamp(18px, 3vw, 28px) clamp(16px, 2.5vw, 24px)',
                background: 'rgba(255,255,255,0.025)',
                border: `1px solid rgba(255,255,255,0.07)`,
                overflow: 'hidden', cursor: 'pointer', height: '100%',
                opacity: visible ? 1 : 0,
                transform: visible ? 'translateY(0)' : 'translateY(32px)',
                transition: `opacity 0.6s ease ${i * 100}ms, transform 0.6s ease ${i * 100}ms, background 0.25s, border-color 0.25s, box-shadow 0.25s`,
                display: 'flex', flexDirection: 'column', gap: 0,
              }}
                onMouseEnter={e => {
                  const el = e.currentTarget as HTMLElement
                  el.style.background = `${STEP_COLORS[i]}07`
                  el.style.borderColor = `${STEP_COLORS[i]}28`
                  el.style.boxShadow = `0 24px 48px rgba(0,0,0,0.35), inset 0 1px 0 ${STEP_COLORS[i]}15`
                  el.style.transform = 'translateY(-4px)'
                }}
                onMouseLeave={e => {
                  const el = e.currentTarget as HTMLElement
                  el.style.background = 'rgba(255,255,255,0.025)'
                  el.style.borderColor = 'rgba(255,255,255,0.07)'
                  el.style.boxShadow = ''
                  el.style.transform = visible ? 'translateY(0)' : 'translateY(32px)'
                }}
              >
                {/* Top accent glow */}
                <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 1, background: `linear-gradient(90deg, transparent 10%, ${STEP_COLORS[i]}60 50%, transparent 90%)` }} />
                {/* Corner atmosphere */}
                <div style={{ position: 'absolute', top: -40, right: -40, width: 160, height: 160, borderRadius: '50%', background: `radial-gradient(circle, ${STEP_COLORS[i]}10 0%, transparent 70%)`, pointerEvents: 'none' }} />

                {/* Step badge + icon row */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 'clamp(16px, 2.5vw, 24px)' as any, gap: 8 }}>
                  {/* Step number — elegant pill */}
                  <div style={{
                    height: 26, minWidth: 0, paddingInline: 10,
                    borderRadius: 100, display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                    background: `${STEP_COLORS[i]}10`, border: `1px solid ${STEP_COLORS[i]}25`,
                    fontSize: 10, fontWeight: 800, letterSpacing: '0.06em', whiteSpace: 'nowrap',
                    color: STEP_COLORS[i], flexShrink: 1,
                  }}>
                    {t('landing.workflow.stepLabel')} {step.n}
                  </div>

                  {/* Icon in glowing circle */}
                  <div style={{
                    width: 42, height: 42, borderRadius: 13, flexShrink: 0,
                    background: `${STEP_COLORS[i]}12`,
                    border: `1px solid ${STEP_COLORS[i]}25`,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    color: STEP_COLORS[i],
                    boxShadow: `0 0 16px ${STEP_COLORS[i]}20`,
                  }}>
                    {STEP_ICONS[i]}
                  </div>
                </div>

                {/* Content */}
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 'clamp(14px, 2vw, 17px)', fontWeight: 800, color: '#fff', marginBottom: 8, letterSpacing: '-0.3px', lineHeight: 1.25 }}>
                    {step.title}
                  </div>
                  <p style={{ margin: 0, fontSize: 12, color: 'rgba(255,255,255,0.42)', lineHeight: 1.65 }}>
                    {step.desc}
                  </p>
                </div>

                {/* Bottom CTA arrow */}
                <div style={{ marginTop: 20, display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, fontWeight: 700, color: STEP_COLORS[i] }}>
                  {t('landing.workflow.cta')}
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14M12 5l7 7-7 7"/></svg>
                </div>
              </div>
            </Link>
          ))}
        </div>

        {/* Step sequence connector — desktop only, sits below cards */}
        <div className="desktop-only" style={{ marginTop: 32, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 12, opacity: 0.5 }}>
          {(['#22d3ee', '#818cf8', '#a855f7', '#22c55e'] as const).map((c, i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <div style={{ width: 8, height: 8, borderRadius: '50%', background: c, boxShadow: `0 0 8px ${c}` }} />
              {i < 3 && <div style={{ width: 60, height: 1, background: `linear-gradient(90deg, ${c}40, ${['#818cf8','#a855f7','#22c55e'][i]}40)` }} />}
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

// ══════════════════════════════════════════════════════════════
// PREMIUM SECTION
// ══════════════════════════════════════════════════════════════

function PremiumSection() {
  const { ref, visible } = useReveal(0.15)
  const { t } = useTranslation()
  const included = [
    'landing.premium.includes.ownership',
    'landing.premium.includes.accident',
    'landing.premium.includes.service',
    'landing.premium.includes.odometer',
    'landing.premium.includes.theft',
    'landing.premium.includes.market',
  ]

  return (
    <section style={{ maxWidth: 1200, margin: '0 auto', padding: '0 20px clamp(56px, 8vw, 96px)' }}>
      <div ref={ref} style={{
        borderRadius: 24, overflow: 'hidden', position: 'relative',
        background: 'linear-gradient(135deg, rgba(34,211,238,0.05) 0%, rgba(168,85,247,0.04) 100%)',
        border: '1px solid rgba(34,211,238,0.14)',
        opacity: visible ? 1 : 0, transform: visible ? 'translateY(0)' : 'translateY(32px)',
        transition: 'opacity 0.7s ease, transform 0.7s ease',
      }}>
        <div style={{ position: 'absolute', top: -60, right: -60, width: 300, height: 300, borderRadius: '50%', background: 'radial-gradient(circle, rgba(34,211,238,0.07), transparent)', pointerEvents: 'none' }} />

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 0 }}>
          <div style={{ padding: 'clamp(28px, 5vw, 48px) clamp(20px, 4vw, 40px)' }}>
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: 7, padding: '5px 12px', borderRadius: 100, background: 'rgba(168,85,247,0.1)', border: '1px solid rgba(168,85,247,0.2)', fontSize: 11, fontWeight: 700, color: '#a855f7', letterSpacing: '0.06em', marginBottom: 20 }}>
              {t('landing.premium.badge')}
            </div>
            <h2 style={{ margin: '0 0 16px', fontSize: 'clamp(22px, 3.5vw, 34px)', fontWeight: 900, letterSpacing: '-1.5px', color: '#fff', lineHeight: 1.1 }}>
              {t('landing.premium.title')}<br />
              <span style={{ background: 'linear-gradient(95deg, #22d3ee, #818cf8)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text' }}>
                {t('landing.premium.titleAccent')}
              </span>
            </h2>
            <p style={{ margin: '0 0 28px', fontSize: 14, color: 'rgba(255,255,255,0.45)', lineHeight: 1.7 }}>
              {t('landing.premium.subtitle')}
            </p>
            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
              <Link href="/premium" style={{ padding: '12px 22px', borderRadius: 12, background: 'rgba(34,211,238,0.1)', border: '1px solid rgba(34,211,238,0.25)', color: '#22d3ee', fontSize: 13, fontWeight: 700, textDecoration: 'none' }}>
                {t('landing.premium.learn')}
              </Link>
              <Link href="/vehicle" style={{ padding: '12px 20px', borderRadius: 12, background: 'transparent', border: '1px solid rgba(255,255,255,0.1)', color: 'rgba(255,255,255,0.55)', fontSize: 13, fontWeight: 600, textDecoration: 'none' }}>
                {t('landing.premium.vehicles')}
              </Link>
            </div>
          </div>

          <div style={{ padding: 'clamp(28px, 5vw, 48px) clamp(20px, 4vw, 40px)', borderLeft: '1px solid rgba(255,255,255,0.06)' }}>
            <div style={{ fontSize: 10, fontWeight: 700, color: 'rgba(255,255,255,0.28)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 20 }}>{t('landing.premium.includesTitle')}</div>
            {included.map(itemKey => (
              <div key={itemKey} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '11px 0', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                <div style={{ width: 20, height: 20, borderRadius: 6, background: 'rgba(34,197,94,0.1)', border: '1px solid rgba(34,197,94,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#22c55e" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
                </div>
                <span style={{ fontSize: 13, color: 'rgba(255,255,255,0.6)' }}>{t(itemKey)}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  )
}

// ══════════════════════════════════════════════════════════════
// TESTIMONIALS
// ══════════════════════════════════════════════════════════════

function Testimonials() {
  const { ref, visible } = useReveal(0.15)
  const { t } = useTranslation()

  const posts = [
    { initials: 'MK', name: 'M. Kovač', text: t('landing.testimonials.post1.text'), time: t('landing.testimonials.post1.time') },
    { initials: 'RA', name: 'R. Andric', text: t('landing.testimonials.post2.text'), time: t('landing.testimonials.post2.time') },
    { initials: 'JB', name: 'J. Berisha', text: t('landing.testimonials.post3.text'), time: t('landing.testimonials.post3.time') },
  ]

  return (
    <section style={{ borderTop: '1px solid rgba(255,255,255,0.05)', background: 'rgba(255,255,255,0.005)' }}>
      <div style={{ maxWidth: 1200, margin: '0 auto', padding: 'clamp(56px, 8vw, 96px) 20px' }}>
        <div style={{ textAlign: 'center', marginBottom: 'clamp(28px, 4vw, 48px)' as any }}>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 11, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: '#22d3ee', marginBottom: 16 }}>{t('landing.testimonials.badge')}</div>
          <h2 style={{ margin: 0, fontSize: 'clamp(24px, 3.5vw, 38px)', fontWeight: 900, letterSpacing: '-1.5px', color: '#fff' }}>
            {t('landing.testimonials.title')}
          </h2>
        </div>

        <div ref={ref} style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 12 }}>
          {posts.map((p, i) => (
            <div key={p.initials} style={{
              ...glass, borderRadius: 20, padding: 24,
              display: 'flex', flexDirection: 'column', gap: 16,
              opacity: visible ? 1 : 0, transform: visible ? 'translateY(0)' : 'translateY(24px)',
              transition: `opacity 0.6s ease ${i * 120}ms, transform 0.6s ease ${i * 120}ms`,
            }}>
              <div style={{ display: 'flex', gap: 2 }}>
                {Array.from({ length: 5 }).map((_, j) => (
                  <svg key={j} width="12" height="12" viewBox="0 0 24 24" fill="#f59e0b" stroke="none"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>
                ))}
              </div>
              <p style={{ margin: 0, fontSize: 14, color: 'rgba(255,255,255,0.58)', lineHeight: 1.7, flex: 1 }}>"{p.text}"</p>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <div style={{ width: 32, height: 32, borderRadius: '50%', background: 'linear-gradient(135deg, rgba(34,211,238,0.2), rgba(129,140,248,0.2))', border: '1px solid rgba(255,255,255,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 800, color: '#22d3ee' }}>{p.initials}</div>
                  <span style={{ fontSize: 13, fontWeight: 600, color: 'rgba(255,255,255,0.55)' }}>{p.name}</span>
                </div>
                <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.2)' }}>{p.time}</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

// ══════════════════════════════════════════════════════════════
// CLOSING CTA
// ══════════════════════════════════════════════════════════════

function ClosingCTA() {
  const { ref, visible } = useReveal(0.2)
  const { t } = useTranslation()

  return (
    <section style={{ maxWidth: 1200, margin: '0 auto', padding: '0 20px clamp(56px, 8vw, 96px)' }}>
      <div ref={ref} style={{
        borderRadius: 24, overflow: 'hidden', position: 'relative',
        background: 'linear-gradient(135deg, rgba(34,211,238,0.05), rgba(129,140,248,0.04))',
        border: '1px solid rgba(34,211,238,0.12)',
        padding: 'clamp(44px, 8vw, 80px) clamp(20px, 4vw, 32px)', textAlign: 'center',
        opacity: visible ? 1 : 0, transform: visible ? 'translateY(0)' : 'translateY(32px)',
        transition: 'opacity 0.7s ease, transform 0.7s ease',
      }}>
        <div style={{ position: 'absolute', top: -40, right: -40, width: 280, height: 280, borderRadius: '50%', background: 'radial-gradient(circle, rgba(34,211,238,0.08), transparent)', pointerEvents: 'none' }} />
        <div style={{ position: 'absolute', bottom: -60, left: -40, width: 320, height: 320, borderRadius: '50%', background: 'radial-gradient(circle, rgba(129,140,248,0.06), transparent)', pointerEvents: 'none' }} />

        <div style={{ position: 'relative' }}>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 11, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: '#22d3ee', marginBottom: 20 }}>{t('landing.closing.badge')}</div>
          <h2 style={{ margin: '0 0 16px', fontSize: 'clamp(26px, 4vw, 46px)', fontWeight: 900, letterSpacing: '-2px', color: '#fff', lineHeight: 1.05, maxWidth: 520, marginLeft: 'auto', marginRight: 'auto' }}>
            {t('landing.closing.title')}<br />
            <span style={{ background: 'linear-gradient(95deg, #22d3ee, #818cf8)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text' }}>
              {t('landing.closing.titleAccent')}
            </span>
          </h2>
          <p style={{ margin: '0 auto 36px', fontSize: 15, color: 'rgba(255,255,255,0.42)', maxWidth: 420, lineHeight: 1.65 }}>
            {t('landing.closing.subtitle')}
          </p>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, justifyContent: 'center' }}>
            <Link href="/inspection" style={{
              padding: '15px 28px', borderRadius: 14,
              background: 'linear-gradient(135deg, #22d3ee, #06b6d4)',
              color: '#03131A', fontSize: 14, fontWeight: 700,
              textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: 8, whiteSpace: 'nowrap',
              boxShadow: '0 8px 32px rgba(34,211,238,0.35)', transition: 'transform 0.2s, box-shadow 0.2s',
            }}
              onMouseEnter={e => { (e.currentTarget as HTMLElement).style.transform = 'translateY(-2px)'; (e.currentTarget as HTMLElement).style.boxShadow = '0 14px 44px rgba(34,211,238,0.55)'; }}
              onMouseLeave={e => { (e.currentTarget as HTMLElement).style.transform = ''; (e.currentTarget as HTMLElement).style.boxShadow = '0 8px 32px rgba(34,211,238,0.35)'; }}
            >
              {t('landing.hero.startInspection')}
            </Link>
            <Link href="/premium" style={{ padding: '15px 24px', borderRadius: 14, background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.12)', color: 'rgba(255,255,255,0.65)', fontSize: 14, fontWeight: 600, textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: 8, backdropFilter: 'blur(12px)', whiteSpace: 'nowrap', transition: 'all 0.2s' }}
              onMouseEnter={e => { const el = e.currentTarget as HTMLElement; el.style.background = 'rgba(255,255,255,0.1)'; el.style.border = '1px solid rgba(255,255,255,0.24)'; el.style.color = 'rgba(255,255,255,0.92)'; el.style.transform = 'translateY(-1px)'; }}
              onMouseLeave={e => { const el = e.currentTarget as HTMLElement; el.style.background = 'rgba(255,255,255,0.05)'; el.style.border = '1px solid rgba(255,255,255,0.12)'; el.style.color = 'rgba(255,255,255,0.65)'; el.style.transform = ''; }}
            >
              {t('landing.closing.explorePremium')}
            </Link>
          </div>
        </div>
      </div>
    </section>
  )
}

// ══════════════════════════════════════════════════════════════
// FOOTER
// ══════════════════════════════════════════════════════════════

function FooterLink({ href, children }: Readonly<{ href: string; children: React.ReactNode }>) {
  const [hovered, setHovered] = useState(false)
  return (
    <Link
      href={href}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        fontSize: 13,
        color: hovered ? 'rgba(255,255,255,0.9)' : 'rgba(255,255,255,0.52)',
        textDecoration: 'none',
        transition: 'color 0.18s ease',
        letterSpacing: '-0.1px',
      }}
    >
      {children}
    </Link>
  )
}

function Footer() {
  const [signinHovered, setSigninHovered] = useState(false)
  const [startHovered,  setStartHovered]  = useState(false)
  const { t } = useTranslation()

  return (
    <footer style={{
      borderTop: '1px solid rgba(255,255,255,0.08)',
      background: 'linear-gradient(180deg, transparent 0%, rgba(255,255,255,0.012) 100%)',
    }}>
      <div style={{ maxWidth: 1200, margin: '0 auto', padding: '72px 32px 48px' }}>

        {/* ── Top grid ── */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: '2fr 1fr 1fr',
          gap: '48px 64px',
          marginBottom: 56,
        }}>

          {/* Brand column */}
          <div style={{ maxWidth: 320 }}>
            <div style={{ fontSize: 15, fontWeight: 800, color: '#fff', letterSpacing: '-0.4px', marginBottom: 14 }}>
              <span style={{ color: '#22d3ee' }}>Car Inspector</span> AI
            </div>
            <p style={{ margin: 0, fontSize: 13, color: 'rgba(255,255,255,0.5)', lineHeight: 1.75 }}>
              {t('landing.footer.description')}
            </p>
          </div>

          {/* Nav columns */}
          {[
            { title: t('landing.footer.inspect'), links: [
              { label: t('dashboard.startInspection'), href: '/inspection' },
              { label: t('nav.vehicles'),             href: '/vehicle' },
              { label: t('dashboard.viewReport'),     href: '/report' },
              { label: t('landing.footer.premiumHistory'), href: '/premium' },
            ]},
            { title: t('landing.footer.platform'), links: [
              { label: t('nav.dashboard'), href: '/dashboard' },
              { label: t('nav.community'), href: '/community' },
              { label: t('nav.messages'),  href: '/messages' },
              { label: t('nav.profile'),   href: '/profile' },
            ]},
          ].map(col => (
            <div key={col.title}>
              <div style={{
                fontSize: 10, fontWeight: 700,
                color: 'rgba(255,255,255,0.38)',
                textTransform: 'uppercase', letterSpacing: '0.1em',
                marginBottom: 18,
              }}>
                {col.title}
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 13 }}>
                {col.links.map(l => (
                  <FooterLink key={l.href} href={l.href}>{l.label}</FooterLink>
                ))}
              </div>
            </div>
          ))}
        </div>

        {/* ── Bottom row ── */}
        <div style={{
          borderTop: '1px solid rgba(255,255,255,0.07)',
          paddingTop: 28,
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 16,
        }}>
          <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.3)', letterSpacing: '-0.1px' }}>
            {t('landing.footer.tagline')}
          </span>
          <div style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
            <Link
              href="/auth"
              onMouseEnter={() => setSigninHovered(true)}
              onMouseLeave={() => setSigninHovered(false)}
              style={{
                fontSize: 12, fontWeight: 500,
                color: signinHovered ? 'rgba(255,255,255,0.72)' : 'rgba(255,255,255,0.38)',
                textDecoration: 'none',
                transition: 'color 0.18s ease',
                letterSpacing: '-0.1px',
              }}
            >
              {t('common.signIn')}
            </Link>
            <Link
              href="/inspection"
              onMouseEnter={() => setStartHovered(true)}
              onMouseLeave={() => setStartHovered(false)}
              style={{
                fontSize: 12, fontWeight: 700,
                color: startHovered ? '#fff' : '#22d3ee',
                textDecoration: 'none',
                letterSpacing: '-0.1px',
                padding: '5px 13px',
                borderRadius: 7,
                border: `1px solid ${startHovered ? 'rgba(34,211,238,0.55)' : 'rgba(34,211,238,0.28)'}`,
                background: startHovered ? 'rgba(34,211,238,0.12)' : 'rgba(34,211,238,0.06)',
                transition: 'all 0.18s ease',
              }}
            >
              {t('landing.startFree')}
            </Link>
          </div>
        </div>
      </div>
    </footer>
  )
}

// ══════════════════════════════════════════════════════════════
// PAGE
// ══════════════════════════════════════════════════════════════

export default function Home() {
  return (
    <div style={{ minHeight: '100svh', background: '#080c14', color: '#fff', overflowX: 'hidden' }}>
      <LandingNav />
      <Hero />
      <StatsSection />
      <Features />
      <HowItWorks />
      <PremiumSection />
      <Testimonials />
      <ClosingCTA />
      <Footer />
    </div>
  )
}
