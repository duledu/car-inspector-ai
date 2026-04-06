'use client'

import Link from 'next/link'

// ─── Shared inline style atoms ────────────────────────────────
const S = {
  // Glass card
  glass: {
    background: 'rgba(255,255,255,0.035)',
    border: '1px solid rgba(255,255,255,0.08)',
    backdropFilter: 'blur(20px)',
    WebkitBackdropFilter: 'blur(20px)',
  } as React.CSSProperties,

  // Accent glass card
  glassAccent: {
    background: 'rgba(34,211,238,0.04)',
    border: '1px solid rgba(34,211,238,0.15)',
    backdropFilter: 'blur(20px)',
    WebkitBackdropFilter: 'blur(20px)',
  } as React.CSSProperties,

  // Section label
  eyebrow: {
    display: 'inline-flex', alignItems: 'center', gap: 6,
    fontSize: 11, fontWeight: 700, letterSpacing: '0.1em',
    textTransform: 'uppercase' as const, color: '#22d3ee',
  } as React.CSSProperties,
}

// ─── Nav ──────────────────────────────────────────────────────
function LandingNav() {
  return (
    <nav style={{
      position: 'sticky', top: 0, zIndex: 50,
      background: 'rgba(8,12,20,0.85)',
      borderBottom: '1px solid rgba(255,255,255,0.06)',
      backdropFilter: 'blur(24px)',
      WebkitBackdropFilter: 'blur(24px)',
    }}>
      <div style={{ maxWidth: 1200, margin: '0 auto', padding: '0 20px', height: 60, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16 }}>

        {/* Brand */}
        <Link href="/" style={{ textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0 }}>
          <div style={{
            width: 34, height: 34, borderRadius: 10,
            background: 'linear-gradient(135deg, #22d3ee 0%, #818cf8 100%)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            boxShadow: '0 0 16px rgba(34,211,238,0.3)',
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

        {/* Desktop nav links */}
        <div style={{ display: 'flex', gap: 2, alignItems: 'center' }} className="desktop-only">
          {[
            { label: 'Dashboard', href: '/dashboard' },
            { label: 'Inspection', href: '/inspection' },
            { label: 'Premium', href: '/premium' },
            { label: 'Community', href: '/community' },
          ].map(item => (
            <Link key={item.href} href={item.href} style={{
              padding: '7px 14px', borderRadius: 8,
              fontSize: 13, fontWeight: 500, color: 'rgba(255,255,255,0.5)',
              textDecoration: 'none', transition: 'all 0.15s',
            }}
              onMouseEnter={e => { (e.target as HTMLElement).style.color = '#fff'; (e.target as HTMLElement).style.background = 'rgba(255,255,255,0.05)'; }}
              onMouseLeave={e => { (e.target as HTMLElement).style.color = 'rgba(255,255,255,0.5)'; (e.target as HTMLElement).style.background = 'transparent'; }}
            >
              {item.label}
            </Link>
          ))}
        </div>

        {/* CTA buttons */}
        <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
          <Link href="/auth" style={{
            padding: '9px 16px', borderRadius: 10,
            fontSize: 13, fontWeight: 600, color: 'rgba(255,255,255,0.6)',
            border: '1px solid rgba(255,255,255,0.1)', background: 'transparent',
            textDecoration: 'none', display: 'flex', alignItems: 'center',
            transition: 'all 0.15s',
          }}>
            Sign In
          </Link>
          <Link href="/inspection" style={{
            padding: '9px 18px', borderRadius: 10,
            fontSize: 13, fontWeight: 700, color: '#050810',
            background: 'linear-gradient(135deg, #22d3ee, #06b6d4)',
            textDecoration: 'none', display: 'flex', alignItems: 'center',
            boxShadow: '0 4px 16px rgba(34,211,238,0.3)',
            transition: 'all 0.15s',
          }}>
            Start Free
          </Link>
        </div>
      </div>
    </nav>
  )
}

// ─── Hero ─────────────────────────────────────────────────────
function Hero() {
  return (
    <section style={{ position: 'relative', minHeight: '100svh', display: 'flex', alignItems: 'center', overflow: 'hidden', padding: '80px 20px' }}>

      {/* Background orbs */}
      <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none', overflow: 'hidden' }}>
        <div style={{ position: 'absolute', top: '-10%', left: '-5%', width: 600, height: 600, borderRadius: '50%', background: 'radial-gradient(circle, rgba(34,211,238,0.06) 0%, transparent 70%)', animation: 'orb-drift 18s ease-in-out infinite' }} />
        <div style={{ position: 'absolute', top: '40%', right: '-10%', width: 500, height: 500, borderRadius: '50%', background: 'radial-gradient(circle, rgba(129,140,248,0.06) 0%, transparent 70%)', animation: 'orb-drift 24s ease-in-out infinite reverse' }} />
        <div style={{ position: 'absolute', bottom: '-5%', left: '30%', width: 700, height: 400, borderRadius: '50%', background: 'radial-gradient(circle, rgba(168,85,247,0.04) 0%, transparent 70%)' }} />
        {/* Grid overlay */}
        <div style={{ position: 'absolute', inset: 0, backgroundImage: 'linear-gradient(rgba(255,255,255,0.015) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.015) 1px, transparent 1px)', backgroundSize: '64px 64px', maskImage: 'radial-gradient(ellipse 80% 60% at 50% 50%, black, transparent)' }} />
      </div>

      <div style={{ maxWidth: 1200, margin: '0 auto', width: '100%', position: 'relative' }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 48, alignItems: 'center' }}>

          {/* Left: text */}
          <div className="animate-fade-up">
            {/* Badge */}
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

            {/* Headline */}
            <h1 style={{ margin: '0 0 20px', fontSize: 'clamp(36px, 6vw, 58px)', fontWeight: 900, letterSpacing: '-2px', lineHeight: 1.05, color: '#fff' }}>
              Buy used cars<br />
              <span className="gradient-text-cyan">with confidence.</span>
            </h1>

            {/* Sub */}
            <p style={{ margin: '0 0 32px', fontSize: 17, color: 'rgba(255,255,255,0.5)', lineHeight: 1.65, maxWidth: 440 }}>
              AI-guided inspection, smart risk scoring, and premium vehicle history intelligence — everything a serious buyer needs.
            </p>

            {/* CTAs */}
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, marginBottom: 36 }}>
              <Link href="/inspection" style={{
                padding: '14px 28px', borderRadius: 14,
                background: 'linear-gradient(135deg, #22d3ee, #06b6d4)',
                color: '#050810', fontSize: 14, fontWeight: 800,
                textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: 8,
                boxShadow: '0 8px 32px rgba(34,211,238,0.35)',
                transition: 'all 0.2s',
              }}>
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <polygon points="5 3 19 12 5 21 5 3"/>
                </svg>
                Start Free Inspection
              </Link>
              <Link href="/dashboard" style={{
                padding: '14px 24px', borderRadius: 14,
                background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)',
                color: 'rgba(255,255,255,0.7)', fontSize: 14, fontWeight: 600,
                textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: 8,
                backdropFilter: 'blur(12px)',
                transition: 'all 0.2s',
              }}>
                View Dashboard
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="9 18 15 12 9 6"/>
                </svg>
              </Link>
            </div>

            {/* Trust row */}
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 20, alignItems: 'center' }}>
              {[
                { value: '124K+', label: 'Inspections' },
                { value: '96%', label: 'Accuracy' },
                { value: '31K', label: 'Reports' },
              ].map(t => (
                <div key={t.label} style={{ display: 'flex', alignItems: 'baseline', gap: 5 }}>
                  <span style={{ fontSize: 18, fontWeight: 800, color: '#fff', letterSpacing: '-0.5px' }}>{t.value}</span>
                  <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.35)' }}>{t.label}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Right: app preview card */}
          <div className="animate-fade-up delay-2" style={{ display: 'flex', justifyContent: 'center' }}>
            <div style={{ width: '100%', maxWidth: 360, position: 'relative' }}>
              {/* Glow behind card */}
              <div style={{ position: 'absolute', inset: -20, background: 'radial-gradient(ellipse, rgba(34,211,238,0.1) 0%, transparent 70%)', pointerEvents: 'none' }} />

              {/* Main card */}
              <div style={{ ...S.glass, borderRadius: 24, padding: 24, position: 'relative' }}>
                {/* Top: vehicle header */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
                  <div>
                    <div style={{ fontSize: 10, fontWeight: 700, color: '#22d3ee', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 3 }}>Inspecting</div>
                    <div style={{ fontSize: 16, fontWeight: 800, color: '#fff', letterSpacing: '-0.4px' }}>2019 BMW 3 Series</div>
                    <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.35)', marginTop: 1 }}>87 000 km · 14 500 EUR</div>
                  </div>
                  {/* Score ring */}
                  <svg width="60" height="60" viewBox="0 0 60 60">
                    <circle cx="30" cy="30" r="23" fill="none" stroke="rgba(34,211,238,0.1)" strokeWidth="4"/>
                    <circle cx="30" cy="30" r="23" fill="none" stroke="url(#scoreGrad)" strokeWidth="4"
                      strokeLinecap="round" strokeDasharray="144.5" strokeDashoffset="18.8"
                      transform="rotate(-90 30 30)"
                    />
                    <defs>
                      <linearGradient id="scoreGrad" x1="0" y1="0" x2="1" y2="0">
                        <stop offset="0%" stopColor="#22d3ee"/>
                        <stop offset="100%" stopColor="#818cf8"/>
                      </linearGradient>
                    </defs>
                    <text x="30" y="34" textAnchor="middle" fontSize="14" fontWeight="900" fill="#fff">87</text>
                  </svg>
                </div>

                {/* Progress bar */}
                <div style={{ marginBottom: 20 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: 'rgba(255,255,255,0.35)', marginBottom: 6 }}>
                    <span>Inspection progress</span>
                    <span style={{ color: '#22d3ee', fontWeight: 700 }}>73%</span>
                  </div>
                  <div style={{ height: 4, background: 'rgba(255,255,255,0.06)', borderRadius: 4 }}>
                    <div style={{ height: '100%', width: '73%', background: 'linear-gradient(90deg, #22d3ee, #818cf8)', borderRadius: 4 }}/>
                  </div>
                </div>

                {/* Phase chips */}
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 20 }}>
                  {[
                    { label: 'Exterior', done: true },
                    { label: 'Interior', done: true },
                    { label: 'Mechanical', done: false },
                    { label: 'Test Drive', done: false },
                  ].map(p => (
                    <span key={p.label} style={{
                      padding: '4px 10px', borderRadius: 100,
                      fontSize: 11, fontWeight: 600,
                      background: p.done ? 'rgba(34,197,94,0.08)' : 'rgba(255,255,255,0.04)',
                      border: `1px solid ${p.done ? 'rgba(34,197,94,0.2)' : 'rgba(255,255,255,0.08)'}`,
                      color: p.done ? '#22c55e' : 'rgba(255,255,255,0.35)',
                      display: 'inline-flex', alignItems: 'center', gap: 4,
                    }}>
                      {p.done && <svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>}
                      {p.label}
                    </span>
                  ))}
                </div>

                {/* AI findings preview */}
                <div style={{ ...S.glassAccent, borderRadius: 14, padding: '12px 14px' }}>
                  <div style={{ fontSize: 10, fontWeight: 700, color: '#22d3ee', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 10 }}>AI Findings</div>
                  {[
                    { label: 'Left door panel gap', severity: 'warn' },
                    { label: 'Rear bumper repaint', severity: 'warn' },
                    { label: 'Engine bay clean', severity: 'ok' },
                  ].map(f => (
                    <div key={f.label} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '5px 0', borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                      <div style={{ width: 6, height: 6, borderRadius: '50%', flexShrink: 0, background: f.severity === 'ok' ? '#22c55e' : '#f59e0b', boxShadow: `0 0 6px ${f.severity === 'ok' ? '#22c55e' : '#f59e0b'}60` }} />
                      <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.55)' }}>{f.label}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Floating pill */}
              <div style={{
                position: 'absolute', bottom: -16, left: '50%', transform: 'translateX(-50%)',
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

// ─── Stats bar ─────────────────────────────────────────────────
function StatsBar() {
  const stats = [
    { value: '124K+', label: 'Inspections Analyzed', icon: '🔍' },
    { value: '89K',   label: 'Risk Signals Identified', icon: '⚠' },
    { value: '31K',   label: 'Premium Reports', icon: '★' },
    { value: '96%',   label: 'Buyer Confidence', icon: '✓' },
  ]
  return (
    <section style={{ borderTop: '1px solid rgba(255,255,255,0.06)', borderBottom: '1px solid rgba(255,255,255,0.06)', background: 'rgba(255,255,255,0.01)', overflow: 'hidden' }}>
      <div style={{ maxWidth: 1200, margin: '0 auto', padding: '0 20px' }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 1 }} className="stats-grid">
          {stats.map((s) => (
            <div key={s.label} style={{ padding: '28px 24px', borderRight: '1px solid rgba(255,255,255,0.05)', textAlign: 'center' }}>
              <div style={{ fontSize: 32, fontWeight: 900, letterSpacing: '-1.5px', color: '#fff', lineHeight: 1 }}>{s.value}</div>
              <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.38)', marginTop: 6, fontWeight: 500 }}>{s.label}</div>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

// ─── Features ──────────────────────────────────────────────────
function Features() {
  const features = [
    {
      title: 'AI Risk Scoring',
      desc: 'Multi-vector analysis across dozens of inspection inputs delivers a calibrated risk score with full category breakdowns.',
      href: '/inspection',
      cta: 'Run inspection',
      color: '#22d3ee',
      icon: (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>
        </svg>
      ),
    },
    {
      title: 'AI Model Research',
      desc: 'Before you inspect, AI surfaces known issues and common failure points specific to that exact make, model, and year.',
      href: '/inspection',
      cta: 'See it in action',
      color: '#818cf8',
      icon: (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
        </svg>
      ),
    },
    {
      title: 'Photo AI Analysis',
      desc: 'Take photos of any panel, and the AI detects repaints, panel gaps, structural deformations, and colour inconsistencies.',
      href: '/inspection',
      cta: 'Start capturing',
      color: '#22d3ee',
      icon: (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/>
          <circle cx="12" cy="13" r="4"/>
        </svg>
      ),
    },
    {
      title: 'Guided Inspection',
      desc: 'A structured step-by-step flow across Exterior, Interior, Mechanical, Test Drive and Documents — nothing missed.',
      href: '/inspection',
      cta: 'View flow',
      color: '#818cf8',
      icon: (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <path d="M9 11l3 3L22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/>
        </svg>
      ),
    },
    {
      title: 'Premium History Reports',
      desc: 'Optional deep-dive: ownership chain, accident records, service history, odometer verification, theft and recall alerts.',
      href: '/premium',
      cta: 'Learn about premium',
      color: '#a855f7',
      icon: (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
          <polyline points="14 2 14 8 20 8"/>
        </svg>
      ),
    },
    {
      title: 'Confidence Report',
      desc: 'A final compiled report combining your inspection, AI analysis and premium history into one clear buy/pass verdict.',
      href: '/report',
      cta: 'View report format',
      color: '#22c55e',
      icon: (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
        </svg>
      ),
    },
  ]

  return (
    <section style={{ maxWidth: 1200, margin: '0 auto', padding: '96px 20px' }}>
      <div style={{ textAlign: 'center', marginBottom: 56 }}>
        <div style={{ ...S.eyebrow, justifyContent: 'center', marginBottom: 16 }}>Platform Capabilities</div>
        <h2 style={{ margin: '0 0 16px', fontSize: 'clamp(28px, 4vw, 42px)', fontWeight: 900, letterSpacing: '-1.5px', color: '#fff' }}>
          Built for serious buyers
        </h2>
        <p style={{ fontSize: 16, color: 'rgba(255,255,255,0.42)', maxWidth: 480, margin: '0 auto', lineHeight: 1.65 }}>
          Every layer of the platform is purpose-built to give you a cleaner, more confident view of any used vehicle.
        </p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 12 }}>
        {features.map(f => (
          <Link key={f.title} href={f.href} style={{ textDecoration: 'none' }}>
            <div style={{
              ...S.glass, borderRadius: 20, padding: 24,
              height: '100%', display: 'flex', flexDirection: 'column', gap: 12,
              cursor: 'pointer', transition: 'all 0.2s',
            }}
              className="card-hover-accent"
            >
              {/* Icon */}
              <div style={{
                width: 44, height: 44, borderRadius: 13,
                background: `${f.color}12`, border: `1px solid ${f.color}25`,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                color: f.color,
              }}>
                {f.icon}
              </div>

              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 15, fontWeight: 700, color: '#fff', marginBottom: 8, letterSpacing: '-0.2px' }}>{f.title}</div>
                <p style={{ margin: 0, fontSize: 13, color: 'rgba(255,255,255,0.42)', lineHeight: 1.65 }}>{f.desc}</p>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 12, fontWeight: 600, color: f.color }}>
                {f.cta}
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="9 18 15 12 9 6"/>
                </svg>
              </div>
            </div>
          </Link>
        ))}
      </div>
    </section>
  )
}

// ─── How it works ──────────────────────────────────────────────
function HowItWorks() {
  const steps = [
    { n: '01', title: 'Add your vehicle', desc: 'Enter make, model, year — the platform anchors all AI and inspection data to this exact car.', href: '/vehicle' },
    { n: '02', title: 'AI researches it', desc: 'Instantly surfaces known issues, common failure points, and inspection priorities for your exact model.', href: '/inspection' },
    { n: '03', title: 'Run the inspection', desc: 'Step-by-step guided flow. Take photos. The AI analyses each one in real time for visual anomalies.', href: '/inspection' },
    { n: '04', title: 'Get your verdict', desc: 'A final confidence report with an AI risk score, clear reasoning, and a buy / pass recommendation.', href: '/report' },
  ]

  return (
    <section style={{ borderTop: '1px solid rgba(255,255,255,0.06)', background: 'linear-gradient(180deg, transparent, rgba(255,255,255,0.01), transparent)' }}>
      <div style={{ maxWidth: 1200, margin: '0 auto', padding: '96px 20px' }}>
        <div style={{ textAlign: 'center', marginBottom: 56 }}>
          <div style={{ ...S.eyebrow, justifyContent: 'center', marginBottom: 16 }}>Workflow</div>
          <h2 style={{ margin: 0, fontSize: 'clamp(28px, 4vw, 42px)', fontWeight: 900, letterSpacing: '-1.5px', color: '#fff' }}>
            Four steps to a confident decision
          </h2>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 12 }}>
          {steps.map((step, i) => (
            <Link key={step.n} href={step.href} style={{ textDecoration: 'none' }}>
              <div style={{ ...S.glass, borderRadius: 20, padding: 24, height: '100%', cursor: 'pointer', transition: 'all 0.2s' }} className="card-hover">
                {/* Step number */}
                <div style={{ fontSize: 42, fontWeight: 900, letterSpacing: '-3px', color: 'rgba(255,255,255,0.06)', marginBottom: 16, lineHeight: 1 }}>
                  {step.n}
                </div>
                {/* Accent dot for current step */}
                <div style={{ width: 32, height: 3, borderRadius: 3, background: i % 2 === 0 ? '#22d3ee' : '#818cf8', marginBottom: 16 }} />
                <div style={{ fontSize: 15, fontWeight: 700, color: '#fff', marginBottom: 10, letterSpacing: '-0.2px' }}>{step.title}</div>
                <p style={{ margin: 0, fontSize: 13, color: 'rgba(255,255,255,0.4)', lineHeight: 1.65 }}>{step.desc}</p>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </section>
  )
}

// ─── Premium section ───────────────────────────────────────────
function PremiumSection() {
  return (
    <section style={{ maxWidth: 1200, margin: '0 auto', padding: '0 20px 96px' }}>
      <div style={{
        borderRadius: 24,
        background: 'linear-gradient(135deg, rgba(34,211,238,0.05) 0%, rgba(168,85,247,0.04) 100%)',
        border: '1px solid rgba(34,211,238,0.14)',
        overflow: 'hidden',
        position: 'relative',
      }}>
        {/* Glow */}
        <div style={{ position: 'absolute', top: -60, right: -60, width: 300, height: 300, borderRadius: '50%', background: 'radial-gradient(circle, rgba(34,211,238,0.06), transparent)', pointerEvents: 'none' }} />

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 0 }}>
          {/* Left content */}
          <div style={{ padding: '48px 40px' }}>
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: 7, padding: '5px 12px', borderRadius: 100, background: 'rgba(168,85,247,0.1)', border: '1px solid rgba(168,85,247,0.2)', fontSize: 11, fontWeight: 700, color: '#a855f7', letterSpacing: '0.06em', marginBottom: 20 }}>
              OPTIONAL PREMIUM ADD-ON
            </div>
            <h2 style={{ margin: '0 0 16px', fontSize: 'clamp(24px, 3.5vw, 36px)', fontWeight: 900, letterSpacing: '-1.5px', color: '#fff', lineHeight: 1.1 }}>
              Go deeper with<br />
              <span className="gradient-text-cyan">premium history intelligence</span>
            </h2>
            <p style={{ margin: '0 0 28px', fontSize: 14, color: 'rgba(255,255,255,0.45)', lineHeight: 1.7, maxWidth: 400 }}>
              Free inspection gives you a strong foundation. Premium unlocks ownership chains, accident records, service logs, and title verification — tied to your specific vehicle.
            </p>
            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
              <Link href="/premium" style={{
                padding: '12px 22px', borderRadius: 12,
                background: 'rgba(34,211,238,0.1)', border: '1px solid rgba(34,211,238,0.25)',
                color: '#22d3ee', fontSize: 13, fontWeight: 700, textDecoration: 'none',
              }}>
                Learn about Premium
              </Link>
              <Link href="/vehicle" style={{
                padding: '12px 20px', borderRadius: 12,
                background: 'transparent', border: '1px solid rgba(255,255,255,0.1)',
                color: 'rgba(255,255,255,0.55)', fontSize: 13, fontWeight: 600, textDecoration: 'none',
              }}>
                View Vehicles
              </Link>
            </div>
          </div>

          {/* Right: feature list */}
          <div style={{ padding: '48px 40px', borderLeft: '1px solid rgba(255,255,255,0.06)' }}>
            <div style={{ fontSize: 10, fontWeight: 700, color: 'rgba(255,255,255,0.28)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 20 }}>Report Includes</div>
            {[
              'Ownership & Title History',
              'Accident & Damage Records',
              'Service & Maintenance Log',
              'Odometer Verification',
              'Theft & Recall Alerts',
              'Market Value Comparison',
            ].map(item => (
              <div key={item} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 0', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                <div style={{ width: 20, height: 20, borderRadius: 6, background: 'rgba(34,197,94,0.1)', border: '1px solid rgba(34,197,94,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#22c55e" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="20 6 9 17 4 12"/>
                  </svg>
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

// ─── Testimonials ──────────────────────────────────────────────
function Testimonials() {
  const posts = [
    { initials: 'MK', name: 'M. Kovač', text: 'Found hidden frame damage on a 2018 Civic using the checklist. The AI flagged the panel gap before I even looked closely. Saved me thousands.', time: '2h ago', rating: 5 },
    { initials: 'RA', name: 'R. Andric', text: 'The AI risk score flagged a cooling issue before the mechanic even opened the hood. Bought the car at a €1,200 discount because I had the data to negotiate.', time: '5h ago', rating: 5 },
    { initials: 'JB', name: 'J. Berisha', text: 'Premium report showed 3 previous owners the seller never mentioned. That\'s the kind of information that changes a buying decision completely.', time: '1d ago', rating: 5 },
  ]

  return (
    <section style={{ borderTop: '1px solid rgba(255,255,255,0.06)', background: 'rgba(255,255,255,0.005)' }}>
      <div style={{ maxWidth: 1200, margin: '0 auto', padding: '96px 20px' }}>
        <div style={{ textAlign: 'center', marginBottom: 48 }}>
          <div style={{ ...S.eyebrow, justifyContent: 'center', marginBottom: 16 }}>Community</div>
          <h2 style={{ margin: 0, fontSize: 'clamp(26px, 3.5vw, 38px)', fontWeight: 900, letterSpacing: '-1.5px', color: '#fff' }}>
            Real buyers. Real results.
          </h2>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 12 }}>
          {posts.map(p => (
            <div key={p.initials} style={{ ...S.glass, borderRadius: 20, padding: 24, display: 'flex', flexDirection: 'column', gap: 16 }}>
              {/* Stars */}
              <div style={{ display: 'flex', gap: 2 }}>
                {Array.from({ length: p.rating }).map((_, i) => (
                  <svg key={i} width="13" height="13" viewBox="0 0 24 24" fill="#f59e0b" stroke="none">
                    <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>
                  </svg>
                ))}
              </div>

              <p style={{ margin: 0, fontSize: 14, color: 'rgba(255,255,255,0.6)', lineHeight: 1.7, flex: 1 }}>"{p.text}"</p>

              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <div style={{
                    width: 32, height: 32, borderRadius: '50%',
                    background: 'linear-gradient(135deg, rgba(34,211,238,0.2), rgba(129,140,248,0.2))',
                    border: '1px solid rgba(255,255,255,0.1)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 11, fontWeight: 800, color: '#22d3ee',
                  }}>
                    {p.initials}
                  </div>
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

// ─── Closing CTA ───────────────────────────────────────────────
function ClosingCTA() {
  return (
    <section style={{ maxWidth: 1200, margin: '0 auto', padding: '0 20px 96px' }}>
      <div style={{
        borderRadius: 24, overflow: 'hidden', position: 'relative',
        background: 'linear-gradient(135deg, rgba(34,211,238,0.05), rgba(129,140,248,0.04))',
        border: '1px solid rgba(34,211,238,0.12)',
        padding: '72px 32px', textAlign: 'center',
      }}>
        <div style={{ position: 'absolute', top: -40, right: -40, width: 240, height: 240, borderRadius: '50%', background: 'radial-gradient(circle, rgba(34,211,238,0.08), transparent)', pointerEvents: 'none' }} />
        <div style={{ position: 'absolute', bottom: -60, left: -40, width: 300, height: 300, borderRadius: '50%', background: 'radial-gradient(circle, rgba(129,140,248,0.06), transparent)', pointerEvents: 'none' }} />

        <div style={{ position: 'relative' }}>
          <div style={{ ...S.eyebrow, justifyContent: 'center', marginBottom: 20 }}>Get Started</div>
          <h2 style={{ margin: '0 0 16px', fontSize: 'clamp(28px, 4vw, 48px)', fontWeight: 900, letterSpacing: '-2px', color: '#fff', lineHeight: 1.05, maxWidth: 560, marginLeft: 'auto', marginRight: 'auto' }}>
            Your next car decision<br />
            <span className="gradient-text-cyan">deserves better data.</span>
          </h2>
          <p style={{ margin: '0 auto 36px', fontSize: 15, color: 'rgba(255,255,255,0.42)', maxWidth: 440, lineHeight: 1.65 }}>
            Start with a free inspection. Add premium history when you need it. Know what you're buying before you sign anything.
          </p>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, justifyContent: 'center' }}>
            <Link href="/inspection" style={{
              padding: '16px 32px', borderRadius: 14,
              background: 'linear-gradient(135deg, #22d3ee, #06b6d4)',
              color: '#050810', fontSize: 15, fontWeight: 800,
              textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: 8,
              boxShadow: '0 8px 32px rgba(34,211,238,0.35)',
            }}>
              Start Free Inspection
            </Link>
            <Link href="/premium" style={{
              padding: '16px 28px', borderRadius: 14,
              background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.12)',
              color: 'rgba(255,255,255,0.65)', fontSize: 15, fontWeight: 600,
              textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: 8,
              backdropFilter: 'blur(12px)',
            }}>
              Explore Premium
            </Link>
          </div>
        </div>
      </div>
    </section>
  )
}

// ─── Footer ────────────────────────────────────────────────────
function Footer() {
  return (
    <footer style={{ borderTop: '1px solid rgba(255,255,255,0.05)' }}>
      <div style={{ maxWidth: 1200, margin: '0 auto', padding: '48px 20px' }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 32, marginBottom: 40 }}>
          <div style={{ gridColumn: 'span 1' }}>
            <div style={{ fontSize: 14, fontWeight: 800, color: '#fff', letterSpacing: '-0.3px', marginBottom: 12 }}>
              <span style={{ color: '#22d3ee' }}>Car Inspector</span> AI
            </div>
            <p style={{ margin: 0, fontSize: 12, color: 'rgba(255,255,255,0.28)', lineHeight: 1.65, maxWidth: 200 }}>
              AI-powered inspection intelligence for smarter used car buying decisions.
            </p>
          </div>

          {[
            {
              title: 'Inspect',
              links: [
                { label: 'Start Inspection', href: '/inspection' },
                { label: 'My Vehicles', href: '/vehicle' },
                { label: 'View Reports', href: '/report' },
                { label: 'Premium History', href: '/premium' },
              ],
            },
            {
              title: 'Platform',
              links: [
                { label: 'Dashboard', href: '/dashboard' },
                { label: 'Community', href: '/community' },
                { label: 'Messages', href: '/messages' },
                { label: 'Profile', href: '/profile' },
              ],
            },
          ].map(col => (
            <div key={col.title}>
              <div style={{ fontSize: 11, fontWeight: 700, color: 'rgba(255,255,255,0.28)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 14 }}>{col.title}</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {col.links.map(l => (
                  <Link key={l.href} href={l.href} style={{ fontSize: 13, color: 'rgba(255,255,255,0.38)', textDecoration: 'none', transition: 'color 0.15s' }}>
                    {l.label}
                  </Link>
                ))}
              </div>
            </div>
          ))}
        </div>

        <div style={{ borderTop: '1px solid rgba(255,255,255,0.05)', paddingTop: 20, display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
          <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.2)' }}>Car Inspector AI — AI-guided automotive intelligence.</span>
          <div style={{ display: 'flex', gap: 16 }}>
            <Link href="/auth" style={{ fontSize: 12, color: 'rgba(255,255,255,0.28)', textDecoration: 'none' }}>Sign In</Link>
            <Link href="/inspection" style={{ fontSize: 12, color: 'rgba(255,255,255,0.28)', textDecoration: 'none' }}>Start Free</Link>
          </div>
        </div>
      </div>
    </footer>
  )
}

// ─── Page ─────────────────────────────────────────────────────
export default function Home() {
  return (
    <div style={{ minHeight: '100svh', background: '#080c14', color: '#fff', overflowX: 'hidden' }}>
      <LandingNav />
      <Hero />
      <StatsBar />
      <Features />
      <HowItWorks />
      <PremiumSection />
      <Testimonials />
      <ClosingCTA />
      <Footer />
    </div>
  )
}
