'use client'

import Link from 'next/link'
import React, { useEffect, useRef, useState } from 'react'

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
  const [scrolled, setScrolled] = useState(false)
  useEffect(() => {
    const h = () => setScrolled(window.scrollY > 20)
    window.addEventListener('scroll', h, { passive: true })
    return () => window.removeEventListener('scroll', h)
  }, [])

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
            <div style={{ fontSize: 10, fontWeight: 500, color: 'rgba(255,255,255,0.35)', letterSpacing: '0.04em' }}>AI-Powered</div>
          </div>
        </Link>

        <div style={{ display: 'flex', gap: 2, alignItems: 'center' }} className="desktop-only">
          {(['Inspection', 'Premium', 'Community'] as const).map(label => (
            <Link key={label} href={`/${label.toLowerCase()}`} style={{
              padding: '7px 14px', borderRadius: 8, fontSize: 13, fontWeight: 500,
              color: 'rgba(255,255,255,0.5)', textDecoration: 'none', transition: 'all 0.15s',
            }}>
              {label}
            </Link>
          ))}
        </div>

        <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
          <Link href="/auth" style={{
            padding: '9px 16px', borderRadius: 10, fontSize: 13, fontWeight: 600,
            color: 'rgba(255,255,255,0.55)', border: '1px solid rgba(255,255,255,0.1)',
            background: 'transparent', textDecoration: 'none', transition: 'all 0.15s',
          }}>Sign In</Link>
          <Link href="/inspection" style={{
            padding: '9px 18px', borderRadius: 10, fontSize: 13, fontWeight: 700,
            color: '#050810', background: 'linear-gradient(135deg, #22d3ee, #06b6d4)',
            textDecoration: 'none', boxShadow: '0 4px 16px rgba(34,211,238,0.3)', transition: 'all 0.15s',
          }}>Start Free</Link>
        </div>
      </div>
    </nav>
  )
}

// ══════════════════════════════════════════════════════════════
// HERO
// ══════════════════════════════════════════════════════════════

function Hero() {
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
                AI-Powered Inspection Platform
              </span>
            </div>

            <h1 style={{ margin: '0 0 20px', fontSize: 'clamp(36px, 6vw, 60px)', fontWeight: 900, letterSpacing: '-2.5px', lineHeight: 1.03, color: '#fff' }}>
              Buy used cars<br />
              <span style={{ background: 'linear-gradient(95deg, #22d3ee 0%, #818cf8 60%, #a78bfa 100%)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text' }}>
                with confidence.
              </span>
            </h1>

            <p style={{ margin: '0 0 32px', fontSize: 17, color: 'rgba(255,255,255,0.48)', lineHeight: 1.7, maxWidth: 440 }}>
              AI-guided inspection, smart risk scoring, and premium vehicle history — everything a serious buyer needs before signing anything.
            </p>

            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, marginBottom: 40 }}>
              <Link href="/inspection" style={{
                padding: '15px 30px', borderRadius: 14,
                background: 'linear-gradient(135deg, #22d3ee, #06b6d4)',
                color: '#050810', fontSize: 14, fontWeight: 800,
                textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: 8,
                boxShadow: '0 8px 36px rgba(34,211,238,0.38)',
                transition: 'transform 0.2s, box-shadow 0.2s',
              }}
                onMouseEnter={e => { (e.currentTarget as HTMLElement).style.transform = 'translateY(-2px)'; (e.currentTarget as HTMLElement).style.boxShadow = '0 14px 44px rgba(34,211,238,0.48)'; }}
                onMouseLeave={e => { (e.currentTarget as HTMLElement).style.transform = ''; (e.currentTarget as HTMLElement).style.boxShadow = '0 8px 36px rgba(34,211,238,0.38)'; }}
              >
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <polygon points="5 3 19 12 5 21 5 3"/>
                </svg>
                Start Free Inspection
              </Link>
              <Link href="/dashboard" style={{
                padding: '15px 24px', borderRadius: 14,
                background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.12)',
                color: 'rgba(255,255,255,0.7)', fontSize: 14, fontWeight: 600,
                textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: 8,
                backdropFilter: 'blur(12px)', transition: 'all 0.2s',
              }}>
                View Dashboard
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 18 15 12 9 6"/></svg>
              </Link>
            </div>

            {/* Trust strip */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 24, flexWrap: 'wrap' }}>
              <div style={{ height: 1, width: 32, background: 'rgba(255,255,255,0.12)' }} />
              {[{ v: '124K+', l: 'Inspections' }, { v: '96%', l: 'Accuracy' }, { v: '31K', l: 'Reports' }].map((t, i) => (
                <div key={t.l} style={{ display: 'flex', alignItems: 'baseline', gap: 5 }}>
                  {i > 0 && <div style={{ width: 1, height: 16, background: 'rgba(255,255,255,0.1)', marginRight: 18 }} />}
                  <span style={{ fontSize: 17, fontWeight: 800, color: '#fff', letterSpacing: '-0.5px' }}>{t.v}</span>
                  <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.32)', fontWeight: 500 }}>{t.l}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Preview card */}
          <div className="animate-fade-up delay-2" style={{ display: 'flex', justifyContent: 'center' }}>
            <div style={{ width: '100%', maxWidth: 360, position: 'relative' }}>
              <div style={{ position: 'absolute', inset: -24, background: 'radial-gradient(ellipse, rgba(34,211,238,0.12) 0%, transparent 70%)', pointerEvents: 'none' }} />

              <div style={{ ...glass, borderRadius: 24, padding: 24, position: 'relative', boxShadow: '0 32px 64px rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,255,255,0.07)' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
                  <div>
                    <div style={{ fontSize: 10, fontWeight: 700, color: '#22d3ee', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 3 }}>Inspecting</div>
                    <div style={{ fontSize: 16, fontWeight: 800, color: '#fff', letterSpacing: '-0.4px' }}>2019 BMW 3 Series</div>
                    <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.32)', marginTop: 1 }}>87 000 km · 14 500 EUR</div>
                  </div>
                  <svg width="62" height="62" viewBox="0 0 62 62">
                    <circle cx="31" cy="31" r="25" fill="none" stroke="rgba(34,211,238,0.1)" strokeWidth="4"/>
                    <circle cx="31" cy="31" r="25" fill="none" stroke="url(#hg)" strokeWidth="4"
                      strokeLinecap="round" strokeDasharray="157" strokeDashoffset="20"
                      transform="rotate(-90 31 31)"/>
                    <defs>
                      <linearGradient id="hg" x1="0" y1="0" x2="1" y2="0">
                        <stop offset="0%" stopColor="#22d3ee"/>
                        <stop offset="100%" stopColor="#818cf8"/>
                      </linearGradient>
                    </defs>
                    <text x="31" y="36" textAnchor="middle" fontSize="14" fontWeight="900" fill="#fff">87</text>
                  </svg>
                </div>

                <div style={{ marginBottom: 18 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: 'rgba(255,255,255,0.32)', marginBottom: 6 }}>
                    <span>Inspection progress</span>
                    <span style={{ color: '#22d3ee', fontWeight: 700 }}>73%</span>
                  </div>
                  <div style={{ height: 4, background: 'rgba(255,255,255,0.06)', borderRadius: 4 }}>
                    <div style={{ height: '100%', width: '73%', background: 'linear-gradient(90deg, #22d3ee, #818cf8)', borderRadius: 4 }}/>
                  </div>
                </div>

                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5, marginBottom: 18 }}>
                  {[{ l: 'Exterior', d: true }, { l: 'Interior', d: true }, { l: 'Mechanical', d: false }, { l: 'Test Drive', d: false }].map(p => (
                    <span key={p.l} style={{
                      padding: '4px 10px', borderRadius: 100, fontSize: 11, fontWeight: 600,
                      background: p.d ? 'rgba(34,197,94,0.08)' : 'rgba(255,255,255,0.04)',
                      border: `1px solid ${p.d ? 'rgba(34,197,94,0.2)' : 'rgba(255,255,255,0.08)'}`,
                      color: p.d ? '#22c55e' : 'rgba(255,255,255,0.32)',
                      display: 'inline-flex', alignItems: 'center', gap: 4,
                    }}>
                      {p.d && <svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>}
                      {p.l}
                    </span>
                  ))}
                </div>

                <div style={{ background: 'rgba(34,211,238,0.04)', border: '1px solid rgba(34,211,238,0.12)', borderRadius: 14, padding: '12px 14px' }}>
                  <div style={{ fontSize: 10, fontWeight: 700, color: '#22d3ee', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 8 }}>AI Findings</div>
                  {[{ l: 'Left door panel gap', s: 'warn' }, { l: 'Rear bumper repaint', s: 'warn' }, { l: 'Engine bay clean', s: 'ok' }].map(f => (
                    <div key={f.l} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '5px 0', borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                      <div style={{ width: 6, height: 6, borderRadius: '50%', flexShrink: 0, background: f.s === 'ok' ? '#22c55e' : '#f59e0b', boxShadow: `0 0 6px ${f.s === 'ok' ? '#22c55e' : '#f59e0b'}60` }} />
                      <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.52)' }}>{f.l}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div style={{
                position: 'absolute', bottom: -18, left: '50%', transform: 'translateX(-50%)',
                padding: '8px 16px', borderRadius: 100, whiteSpace: 'nowrap',
                background: 'rgba(34,211,238,0.1)', border: '1px solid rgba(34,211,238,0.25)',
                backdropFilter: 'blur(12px)', fontSize: 12, fontWeight: 700, color: '#22d3ee',
                display: 'flex', alignItems: 'center', gap: 6,
              }}>
                <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#22d3ee', boxShadow: '0 0 8px #22d3ee', animation: 'pulse-dot 2s infinite' }} />
                AI analysing photos…
              </div>
            </div>
          </div>
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

  const stats = [
    {
      target: 124, suffix: 'K+', label: 'Inspections Analyzed', sub: 'Across all vehicle types and markets', color: '#22d3ee', delay: 0,
      icon: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M9 5H7a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-2"/><rect x="9" y="3" width="6" height="4" rx="1"/><path d="m9 12 2 2 4-4"/></svg>,
    },
    {
      target: 89, suffix: 'K', label: 'Risk Signals Identified', sub: 'Hidden issues surfaced before purchase', color: '#818cf8', delay: 150,
      icon: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"/><path d="M12 9v4"/><circle cx="12" cy="17" r="1" fill="currentColor"/></svg>,
    },
    {
      target: 31, suffix: 'K', label: 'Premium Reports Unlocked', sub: 'Deep vehicle history accessed', color: '#a855f7', delay: 300,
      icon: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>,
    },
    {
      target: 96, suffix: '%', label: 'Buyer Confidence Rate', sub: 'Decisions backed by AI intelligence', color: '#22c55e', delay: 450,
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

      <div ref={ref} style={{ maxWidth: 1200, margin: '0 auto', padding: '96px 0', position: 'relative' }}>

        {/* Header */}
        <div style={{ textAlign: 'center', marginBottom: 56 }}>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 7, padding: '5px 14px', borderRadius: 100, background: 'rgba(34,211,238,0.07)', border: '1px solid rgba(34,211,238,0.18)', fontSize: 11, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: '#22d3ee', marginBottom: 20 }}>
            <span style={{ width: 5, height: 5, borderRadius: '50%', background: '#22d3ee', boxShadow: '0 0 6px #22d3ee' }} />
            Platform Scale
          </div>
          <h2 style={{ margin: '0 0 14px', fontSize: 'clamp(26px, 4vw, 40px)', fontWeight: 900, letterSpacing: '-1.5px', color: '#fff', lineHeight: 1.1 }}>
            Trusted by serious car buyers
          </h2>
          <p style={{ margin: '0 auto', fontSize: 15, color: 'rgba(255,255,255,0.38)', maxWidth: 420, lineHeight: 1.65 }}>
            Real data from real inspections — every number represents a buyer who made a smarter decision.
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
        padding: '28px 24px',
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
      <div style={{ marginBottom: 8 }}>
        <span style={{ fontSize: 'clamp(42px, 5vw, 52px)', fontWeight: 900, letterSpacing: '-3px', lineHeight: 1, color: '#fff' }}>
          {count.toLocaleString()}
        </span>
        <span style={{ fontSize: 28, fontWeight: 800, letterSpacing: '-1px', color, marginLeft: 2 }}>{suffix}</span>
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

  const features = [
    { title: 'AI Risk Scoring', desc: 'Multi-vector analysis across inspection inputs — a calibrated risk score with category breakdowns.', href: '/inspection', cta: 'Run inspection', color: '#22d3ee', icon: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg> },
    { title: 'AI Model Research', desc: 'Before inspection begins, AI surfaces known issues and failure patterns specific to this exact model.', href: '/inspection', cta: 'See it in action', color: '#818cf8', icon: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg> },
    { title: 'Photo AI Analysis', desc: 'Take photos. AI detects repaints, panel gaps, structural deformations, and colour inconsistencies.', href: '/inspection', cta: 'Start capturing', color: '#22d3ee', icon: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/></svg> },
    { title: 'Guided Inspection', desc: 'Step-by-step flow across Exterior, Interior, Mechanical, Test Drive, and Documents. Nothing missed.', href: '/inspection', cta: 'View flow', color: '#818cf8', icon: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M9 11l3 3L22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/></svg> },
    { title: 'Premium History', desc: 'Optional deep-dive: ownership chain, accident records, service history, odometer verification.', href: '/premium', cta: 'Learn more', color: '#a855f7', icon: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg> },
    { title: 'Confidence Report', desc: 'AI risk score, full inspection breakdown, and a clear buy / pass verdict in one compiled report.', href: '/report', cta: 'View format', color: '#22c55e', icon: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg> },
  ]

  return (
    <section style={{ maxWidth: 1200, margin: '0 auto', padding: '96px 20px' }}>
      <div style={{ textAlign: 'center', marginBottom: 56 }}>
        <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 11, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: '#22d3ee', marginBottom: 16 }}>Platform Capabilities</div>
        <h2 style={{ margin: '0 0 14px', fontSize: 'clamp(26px, 4vw, 40px)', fontWeight: 900, letterSpacing: '-1.5px', color: '#fff' }}>Built for serious buyers</h2>
        <p style={{ fontSize: 15, color: 'rgba(255,255,255,0.4)', maxWidth: 460, margin: '0 auto', lineHeight: 1.65 }}>Every layer is purpose-built to give you a cleaner, more confident view of any used vehicle.</p>
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

  const steps = [
    { n: '01', title: 'Add your vehicle', desc: 'Enter make, model, year. The platform anchors all AI data, inspection records, and reports to this exact car.', href: '/vehicle' },
    { n: '02', title: 'AI researches it', desc: 'Instantly surfaces known issues, common failure points, and what to look for — before you touch a panel.', href: '/inspection' },
    { n: '03', title: 'Run the inspection', desc: 'Step-by-step guided flow. Take photos. AI analyses each one in real time for visual anomalies.', href: '/inspection' },
    { n: '04', title: 'Get your verdict', desc: 'AI risk score, full breakdown, and a clear buy/pass recommendation compiled into one report.', href: '/report' },
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

      <div style={{ maxWidth: 1200, margin: '0 auto', padding: '96px 20px', position: 'relative' }}>
        {/* Header */}
        <div style={{ textAlign: 'center', marginBottom: 64 }}>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 7, padding: '5px 14px', borderRadius: 100, background: 'rgba(129,140,248,0.07)', border: '1px solid rgba(129,140,248,0.18)', fontSize: 11, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: '#818cf8', marginBottom: 20 }}>
            <span style={{ width: 5, height: 5, borderRadius: '50%', background: '#818cf8', boxShadow: '0 0 6px #818cf8' }} />
            Workflow
          </div>
          <h2 style={{ margin: '0 0 14px', fontSize: 'clamp(26px, 4vw, 40px)', fontWeight: 900, letterSpacing: '-1.5px', color: '#fff', lineHeight: 1.1 }}>
            Four steps to a confident decision
          </h2>
          <p style={{ fontSize: 15, color: 'rgba(255,255,255,0.38)', maxWidth: 420, margin: '0 auto', lineHeight: 1.65 }}>
            A structured, intelligent buying workflow — from first look to final verdict.
          </p>
        </div>

        {/* Step cards — minmax(160px) enables 2-col on mobile */}
        <div ref={ref} style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 14 }}>
          {steps.map((step, i) => (
            <Link key={step.n} href={step.href} style={{ textDecoration: 'none' }}>
              <div style={{
                position: 'relative', borderRadius: 22, padding: '28px 24px',
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
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
                  {/* Step number — elegant, small */}
                  <div style={{
                    height: 26, minWidth: 44, paddingInline: 10,
                    borderRadius: 100, display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                    background: `${STEP_COLORS[i]}10`, border: `1px solid ${STEP_COLORS[i]}25`,
                    fontSize: 11, fontWeight: 800, letterSpacing: '0.08em',
                    color: STEP_COLORS[i],
                  }}>
                    STEP {step.n}
                  </div>

                  {/* Icon in glowing circle */}
                  <div style={{
                    width: 48, height: 48, borderRadius: 15, flexShrink: 0,
                    background: `${STEP_COLORS[i]}12`,
                    border: `1px solid ${STEP_COLORS[i]}25`,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    color: STEP_COLORS[i],
                    boxShadow: `0 0 20px ${STEP_COLORS[i]}20`,
                  }}>
                    {STEP_ICONS[i]}
                  </div>
                </div>

                {/* Content */}
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 17, fontWeight: 800, color: '#fff', marginBottom: 10, letterSpacing: '-0.4px', lineHeight: 1.2 }}>
                    {step.title}
                  </div>
                  <p style={{ margin: 0, fontSize: 13, color: 'rgba(255,255,255,0.42)', lineHeight: 1.7 }}>
                    {step.desc}
                  </p>
                </div>

                {/* Bottom CTA arrow */}
                <div style={{ marginTop: 20, display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, fontWeight: 700, color: STEP_COLORS[i] }}>
                  Get started
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

  return (
    <section style={{ maxWidth: 1200, margin: '0 auto', padding: '0 20px 96px' }}>
      <div ref={ref} style={{
        borderRadius: 24, overflow: 'hidden', position: 'relative',
        background: 'linear-gradient(135deg, rgba(34,211,238,0.05) 0%, rgba(168,85,247,0.04) 100%)',
        border: '1px solid rgba(34,211,238,0.14)',
        opacity: visible ? 1 : 0, transform: visible ? 'translateY(0)' : 'translateY(32px)',
        transition: 'opacity 0.7s ease, transform 0.7s ease',
      }}>
        <div style={{ position: 'absolute', top: -60, right: -60, width: 300, height: 300, borderRadius: '50%', background: 'radial-gradient(circle, rgba(34,211,238,0.07), transparent)', pointerEvents: 'none' }} />

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 0 }}>
          <div style={{ padding: '48px 40px' }}>
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: 7, padding: '5px 12px', borderRadius: 100, background: 'rgba(168,85,247,0.1)', border: '1px solid rgba(168,85,247,0.2)', fontSize: 11, fontWeight: 700, color: '#a855f7', letterSpacing: '0.06em', marginBottom: 20 }}>
              OPTIONAL PREMIUM ADD-ON
            </div>
            <h2 style={{ margin: '0 0 16px', fontSize: 'clamp(22px, 3.5vw, 34px)', fontWeight: 900, letterSpacing: '-1.5px', color: '#fff', lineHeight: 1.1 }}>
              Go deeper with<br />
              <span style={{ background: 'linear-gradient(95deg, #22d3ee, #818cf8)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text' }}>
                premium history intelligence
              </span>
            </h2>
            <p style={{ margin: '0 0 28px', fontSize: 14, color: 'rgba(255,255,255,0.45)', lineHeight: 1.7 }}>
              Free inspection gives you a strong foundation. Premium unlocks ownership chains, accident records, service logs, and title verification.
            </p>
            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
              <Link href="/premium" style={{ padding: '12px 22px', borderRadius: 12, background: 'rgba(34,211,238,0.1)', border: '1px solid rgba(34,211,238,0.25)', color: '#22d3ee', fontSize: 13, fontWeight: 700, textDecoration: 'none' }}>
                Learn about Premium
              </Link>
              <Link href="/vehicle" style={{ padding: '12px 20px', borderRadius: 12, background: 'transparent', border: '1px solid rgba(255,255,255,0.1)', color: 'rgba(255,255,255,0.55)', fontSize: 13, fontWeight: 600, textDecoration: 'none' }}>
                View Vehicles
              </Link>
            </div>
          </div>

          <div style={{ padding: '48px 40px', borderLeft: '1px solid rgba(255,255,255,0.06)' }}>
            <div style={{ fontSize: 10, fontWeight: 700, color: 'rgba(255,255,255,0.28)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 20 }}>Report Includes</div>
            {['Ownership & Title History', 'Accident & Damage Records', 'Service & Maintenance Log', 'Odometer Verification', 'Theft & Recall Alerts', 'Market Value Comparison'].map(item => (
              <div key={item} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '11px 0', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                <div style={{ width: 20, height: 20, borderRadius: 6, background: 'rgba(34,197,94,0.1)', border: '1px solid rgba(34,197,94,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#22c55e" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
                </div>
                <span style={{ fontSize: 13, color: 'rgba(255,255,255,0.6)' }}>{item}</span>
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

  const posts = [
    { initials: 'MK', name: 'M. Kovač', text: 'Found hidden frame damage on a 2018 Civic using the checklist. The AI flagged the panel gap before I even looked closely. Saved me thousands.', time: '2h ago' },
    { initials: 'RA', name: 'R. Andric', text: 'The AI risk score flagged a cooling issue before the mechanic opened the hood. Bought the car at a €1,200 discount because I had the data to negotiate.', time: '5h ago' },
    { initials: 'JB', name: 'J. Berisha', text: "Premium report showed 3 previous owners the seller never mentioned. That's the kind of information that changes a buying decision completely.", time: '1d ago' },
  ]

  return (
    <section style={{ borderTop: '1px solid rgba(255,255,255,0.05)', background: 'rgba(255,255,255,0.005)' }}>
      <div style={{ maxWidth: 1200, margin: '0 auto', padding: '96px 20px' }}>
        <div style={{ textAlign: 'center', marginBottom: 48 }}>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 11, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: '#22d3ee', marginBottom: 16 }}>Community</div>
          <h2 style={{ margin: 0, fontSize: 'clamp(24px, 3.5vw, 38px)', fontWeight: 900, letterSpacing: '-1.5px', color: '#fff' }}>
            Real buyers. Real results.
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

  return (
    <section style={{ maxWidth: 1200, margin: '0 auto', padding: '0 20px 96px' }}>
      <div ref={ref} style={{
        borderRadius: 24, overflow: 'hidden', position: 'relative',
        background: 'linear-gradient(135deg, rgba(34,211,238,0.05), rgba(129,140,248,0.04))',
        border: '1px solid rgba(34,211,238,0.12)',
        padding: '80px 32px', textAlign: 'center',
        opacity: visible ? 1 : 0, transform: visible ? 'translateY(0)' : 'translateY(32px)',
        transition: 'opacity 0.7s ease, transform 0.7s ease',
      }}>
        <div style={{ position: 'absolute', top: -40, right: -40, width: 280, height: 280, borderRadius: '50%', background: 'radial-gradient(circle, rgba(34,211,238,0.08), transparent)', pointerEvents: 'none' }} />
        <div style={{ position: 'absolute', bottom: -60, left: -40, width: 320, height: 320, borderRadius: '50%', background: 'radial-gradient(circle, rgba(129,140,248,0.06), transparent)', pointerEvents: 'none' }} />

        <div style={{ position: 'relative' }}>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 11, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: '#22d3ee', marginBottom: 20 }}>Get Started Free</div>
          <h2 style={{ margin: '0 0 16px', fontSize: 'clamp(26px, 4vw, 46px)', fontWeight: 900, letterSpacing: '-2px', color: '#fff', lineHeight: 1.05, maxWidth: 520, marginLeft: 'auto', marginRight: 'auto' }}>
            Your next car decision<br />
            <span style={{ background: 'linear-gradient(95deg, #22d3ee, #818cf8)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text' }}>
              deserves better data.
            </span>
          </h2>
          <p style={{ margin: '0 auto 36px', fontSize: 15, color: 'rgba(255,255,255,0.42)', maxWidth: 420, lineHeight: 1.65 }}>
            Start with a free inspection. Add premium history when you need it. Know what you're buying before you sign anything.
          </p>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, justifyContent: 'center' }}>
            <Link href="/inspection" style={{
              padding: '16px 32px', borderRadius: 14,
              background: 'linear-gradient(135deg, #22d3ee, #06b6d4)',
              color: '#050810', fontSize: 15, fontWeight: 800,
              textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: 8,
              boxShadow: '0 8px 32px rgba(34,211,238,0.35)', transition: 'transform 0.2s, box-shadow 0.2s',
            }}
              onMouseEnter={e => { (e.currentTarget as HTMLElement).style.transform = 'translateY(-2px)'; (e.currentTarget as HTMLElement).style.boxShadow = '0 14px 44px rgba(34,211,238,0.5)'; }}
              onMouseLeave={e => { (e.currentTarget as HTMLElement).style.transform = ''; (e.currentTarget as HTMLElement).style.boxShadow = '0 8px 32px rgba(34,211,238,0.35)'; }}
            >
              Start Free Inspection
            </Link>
            <Link href="/premium" style={{ padding: '16px 28px', borderRadius: 14, background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.12)', color: 'rgba(255,255,255,0.65)', fontSize: 15, fontWeight: 600, textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: 8, backdropFilter: 'blur(12px)' }}>
              Explore Premium
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

function Footer() {
  return (
    <footer style={{ borderTop: '1px solid rgba(255,255,255,0.05)' }}>
      <div style={{ maxWidth: 1200, margin: '0 auto', padding: '48px 20px' }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 32, marginBottom: 40 }}>
          <div>
            <div style={{ fontSize: 14, fontWeight: 800, color: '#fff', letterSpacing: '-0.3px', marginBottom: 12 }}>
              <span style={{ color: '#22d3ee' }}>Car Inspector</span> AI
            </div>
            <p style={{ margin: 0, fontSize: 12, color: 'rgba(255,255,255,0.25)', lineHeight: 1.65, maxWidth: 200 }}>
              AI-powered inspection intelligence for smarter used car buying decisions.
            </p>
          </div>
          {[
            { title: 'Inspect', links: [{ label: 'Start Inspection', href: '/inspection' }, { label: 'My Vehicles', href: '/vehicle' }, { label: 'View Reports', href: '/report' }, { label: 'Premium History', href: '/premium' }] },
            { title: 'Platform', links: [{ label: 'Dashboard', href: '/dashboard' }, { label: 'Community', href: '/community' }, { label: 'Messages', href: '/messages' }, { label: 'Profile', href: '/profile' }] },
          ].map(col => (
            <div key={col.title}>
              <div style={{ fontSize: 11, fontWeight: 700, color: 'rgba(255,255,255,0.25)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 14 }}>{col.title}</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {col.links.map(l => (
                  <Link key={l.href} href={l.href} style={{ fontSize: 13, color: 'rgba(255,255,255,0.35)', textDecoration: 'none' }}>{l.label}</Link>
                ))}
              </div>
            </div>
          ))}
        </div>
        <div style={{ borderTop: '1px solid rgba(255,255,255,0.05)', paddingTop: 20, display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
          <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.18)' }}>Car Inspector AI — AI-guided automotive intelligence.</span>
          <div style={{ display: 'flex', gap: 16 }}>
            <Link href="/auth" style={{ fontSize: 12, color: 'rgba(255,255,255,0.25)', textDecoration: 'none' }}>Sign In</Link>
            <Link href="/inspection" style={{ fontSize: 12, color: 'rgba(255,255,255,0.25)', textDecoration: 'none' }}>Start Free</Link>
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
