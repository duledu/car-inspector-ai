'use client'

// =============================================================================
// /before-you-buy — Premium Authority Page
// Used Cars Doctor · US Market · Trust, Guidance, Automotive Confidence
// =============================================================================

import Link from 'next/link'
import React, { useEffect, useRef, useState } from 'react'
import '@/i18n/config'
import { balanceHeadlineText } from '@/lib/typography'
import { LandingNav } from '@/components/layout/LandingNav'

// ─── Scroll-reveal hook ───────────────────────────────────────────────────────
function useReveal(threshold = 0.1) {
  const ref  = useRef<HTMLDivElement>(null)
  const [on, setOn] = useState(false)
  useEffect(() => {
    const el = ref.current
    if (!el) return
    const obs = new IntersectionObserver(
      ([e]) => { if (e.isIntersecting) { setOn(true); obs.disconnect() } },
      { threshold }
    )
    obs.observe(el)
    return () => obs.disconnect()
  }, [threshold])
  return { ref, on }
}

// ─── Shared design tokens ────────────────────────────────────────────────────

const W = 1140   // content max-width

const SEC: React.CSSProperties = {
  padding: 'clamp(68px, 5.5vw, 88px) clamp(20px, 4vw, 40px)',
}

// Unified premium eyebrow badge - matches homepage hero design language
function SectionEyebrow({ children }: Readonly<{ children: string }>) {
  return (
    <div style={{
      display: 'inline-flex',
      alignItems: 'center',
      gap: 7,
      padding: '6px 14px',
      borderRadius: 100,
      background: 'rgba(34,211,238,0.06)',
      border: '1px solid rgba(34,211,238,0.16)',
      marginBottom: 24,
    }}>
      <span style={{
        width: 6, height: 6, borderRadius: '50%',
        background: '#22d3ee',
        boxShadow: '0 0 8px rgba(34,211,238,0.7)',
        flexShrink: 0,
      }} />
      <span style={{
        fontSize: 12, fontWeight: 600,
        letterSpacing: '0.05em',
        color: 'rgba(255,255,255,0.58)',
        lineHeight: 1,
      }}>
        {children}
      </span>
    </div>
  )
}

// Premium card — flat, minimal, luxury dark
const CARD: React.CSSProperties = {
  background: 'rgba(255,255,255,0.022)',
  border: '1px solid rgba(255,255,255,0.07)',
  borderRadius: 6,
}

const reveal = (on: boolean, delay = 0): React.CSSProperties => ({
  opacity:    on ? 1 : 0,
  transform:  on ? 'none' : 'translateY(28px)',
  transition: `opacity 0.72s cubic-bezier(0.22,1,0.36,1) ${delay}ms, transform 0.72s cubic-bezier(0.22,1,0.36,1) ${delay}ms`,
})

// LandingNav (shared public nav) is imported from @/components/layout/LandingNav.

// ══════════════════════════════════════════════════════════════
// HERO — Full viewport, cinematic editorial
// ══════════════════════════════════════════════════════════════

function PageHero() {
  const [mounted, setMounted] = useState(false)
  useEffect(() => { const t = setTimeout(() => setMounted(true), 80); return () => clearTimeout(t) }, [])

  return (
    <section
      aria-label="Hero"
      style={{
        position: 'relative',
        minHeight: '100svh',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        overflow: 'hidden',
        padding: 'clamp(100px, 11vh, 136px) clamp(20px, 4vw, 40px) clamp(68px, 6vh, 96px)',
        background: '#070b11',
      }}
    >
      {/* ── Atmosphere ── */}
      <div aria-hidden style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}>
        {/* Subtle top glow */}
        <div style={{ position: 'absolute', top: 0, left: '50%', transform: 'translateX(-50%)', width: '70%', height: '60%', background: 'radial-gradient(ellipse at 50% 0%, rgba(34,211,238,0.04) 0%, transparent 60%)' }} />
        {/* Bottom depth gradient */}
        <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: '35%', background: 'linear-gradient(to top, #070b11 0%, transparent 100%)' }} />
        {/* Car — right-anchored, artful composition */}
        <img
          src="/icons/cardoctorImg.jpg"
          alt=""
          style={{
            position: 'absolute',
            top: '50%', right: '-2%',
            transform: 'translateY(-48%)',
            height: '160%', width: 'auto', maxWidth: '80%',
            objectFit: 'contain', objectPosition: 'right center',
            opacity: 0.55,
            filter: 'brightness(0.72) saturate(0.55) contrast(1.08)',
            WebkitMaskImage: 'linear-gradient(to right, transparent 0%, rgba(0,0,0,0.08) 6%, rgba(0,0,0,0.5) 28%, black 52%)',
            maskImage: 'linear-gradient(to right, transparent 0%, rgba(0,0,0,0.08) 6%, rgba(0,0,0,0.5) 28%, black 52%)',
          }}
        />
        {/* Left text protection */}
        <div style={{ position: 'absolute', top: 0, bottom: 0, left: 0, width: '52%', background: 'linear-gradient(to right, #070b11 0%, rgba(7,11,17,0.88) 48%, transparent 100%)' }} />
        {/* Corner vignettes */}
        <div style={{ position: 'absolute', inset: 0, background: 'radial-gradient(ellipse 100% 90% at 50% 50%, transparent 48%, rgba(4,7,16,0.62) 82%, rgba(4,7,16,0.9) 100%)' }} />
      </div>

      {/* ── Content ── */}
      <div style={{ maxWidth: W, margin: '0 auto', width: '100%', position: 'relative', zIndex: 2 }}>
        <div style={{ maxWidth: 640 }}>

          {/* Chapter label */}
          <div style={{ ...reveal(mounted), marginBottom: 4 }}>
            <SectionEyebrow>Before You Buy</SectionEyebrow>
          </div>

          {/* H1 */}
          <h1 style={{
            ...reveal(mounted, 60),
            margin: '0 0 28px',
            fontSize: 'clamp(44px, 6.5vw, 80px)',
            fontWeight: 900,
            letterSpacing: '-0.04em',
            lineHeight: 1.04,
            color: '#fff',
          }}>
            {balanceHeadlineText('The Used Car Market Rewards')}<br />
            <span style={{ color: 'rgba(255,255,255,0.45)' }}>
              {balanceHeadlineText('the Prepared.')}
            </span>
          </h1>

          {/* Rule */}
          <div style={{ ...reveal(mounted, 120), width: 32, height: 1, background: 'rgba(34,211,238,0.6)', marginBottom: 28 }} />

          {/* Subtext */}
          <p style={{
            ...reveal(mounted, 160),
            margin: '0 0 44px',
            fontSize: 'clamp(16px, 2vw, 19px)',
            color: 'rgba(255,255,255,0.48)',
            lineHeight: 1.72,
            maxWidth: 520,
          }}>
            A structured approach to used car inspection — before the commitment,
            before the paperwork, before the keys change hands.
          </p>

          {/* CTA row */}
          <div style={{ ...reveal(mounted, 220), display: 'flex', flexWrap: 'wrap', gap: 14, alignItems: 'center' }}>
            <Link href="/inspection" style={{
              display: 'inline-flex', alignItems: 'center', gap: 10,
              padding: '15px 32px', borderRadius: 6,
              background: 'linear-gradient(135deg, #22d3ee, #06b6d4)',
              color: '#030d12', fontSize: 14, fontWeight: 700,
              textDecoration: 'none',
              boxShadow: '0 8px 32px rgba(34,211,238,0.32)',
              transition: 'transform 0.2s, box-shadow 0.2s',
              letterSpacing: '-0.01em',
            }}
              onMouseEnter={e => { (e.currentTarget as HTMLElement).style.transform = 'translateY(-2px)'; (e.currentTarget as HTMLElement).style.boxShadow = '0 14px 48px rgba(34,211,238,0.52)'; }}
              onMouseLeave={e => { (e.currentTarget as HTMLElement).style.transform = ''; (e.currentTarget as HTMLElement).style.boxShadow = '0 8px 32px rgba(34,211,238,0.32)'; }}
            >
              Begin Your Inspection
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/></svg>
            </Link>
            <a
              href="#why"
              style={{
                display: 'inline-flex', alignItems: 'center', gap: 8,
                fontSize: 13, fontWeight: 500, color: 'rgba(255,255,255,0.42)',
                textDecoration: 'none', transition: 'color 0.2s',
                letterSpacing: '0.01em',
              }}
              onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = 'rgba(255,255,255,0.72)'; }}
              onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = 'rgba(255,255,255,0.42)'; }}
            >
              Explore the approach
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><polyline points="6 9 12 15 18 9"/></svg>
            </a>
          </div>
        </div>
      </div>

      {/* ── Scroll indicator ── */}
      <div aria-hidden style={{ position: 'absolute', bottom: 32, left: '50%', transform: 'translateX(-50%)', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, opacity: 0.3, animation: 'float 4s ease-in-out infinite' }}>
        <div style={{ width: 1, height: 32, background: 'linear-gradient(to bottom, transparent, rgba(255,255,255,0.5))' }} />
        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="6 9 12 15 18 9"/></svg>
      </div>
    </section>
  )
}

// ══════════════════════════════════════════════════════════════
// SECTION 01 — The reality of used car buying
// ══════════════════════════════════════════════════════════════

function RealitySection() {
  const { ref, on } = useReveal()

  return (
    <section
      id="why"
      aria-label="The Reality of Used Car Buying"
      style={{ ...SEC, background: '#080c14', borderTop: '1px solid rgba(255,255,255,0.06)' }}
    >
      <div style={{ maxWidth: W, margin: '0 auto' }}>
        {/* Section number — decorative */}
        <div aria-hidden style={{
          position: 'relative',
          marginBottom: -24,
          overflow: 'hidden',
        }}>
          <span style={{
            display: 'block',
            fontSize: 'clamp(100px, 16vw, 200px)',
            fontWeight: 900,
            letterSpacing: '-0.08em',
            lineHeight: 0.85,
            color: 'rgba(255,255,255,0.018)',
            userSelect: 'none',
            pointerEvents: 'none',
          }}>01</span>
        </div>

        <div
          ref={ref}
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
            gap: 'clamp(36px, 4.5vw, 58px)',
            alignItems: 'start',
          }}
        >
          {/* Left — editorial text */}
          <div style={reveal(on)}>
            <SectionEyebrow>The Buyer&apos;s Dilemma</SectionEyebrow>

            <h2 style={{
              margin: '0 0 24px',
              fontSize: 'clamp(28px, 3.8vw, 46px)',
              fontWeight: 800,
              letterSpacing: '-0.03em',
              lineHeight: 1.12,
              color: '#fff',
            }}>
              Every used vehicle tells a story. Most buyers never hear it.
            </h2>
            <p style={{ margin: '0 0 20px', fontSize: 16, color: 'rgba(255,255,255,0.5)', lineHeight: 1.8 }}>
              The pre-owned vehicle market is largely opaque. Sellers control the narrative. Emotions override analysis. And the financial stakes — often tens of thousands of dollars — are routinely decided on a 20-minute test drive.
            </p>
            <p style={{ margin: 0, fontSize: 16, color: 'rgba(255,255,255,0.5)', lineHeight: 1.8 }}>
              Used Cars Doctor was built to change that dynamic — giving every buyer access to a structured, evidence-based inspection process that was previously reserved for professionals.
            </p>
          </div>

          {/* Right — stat cards */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {[
              {
                stat: '1 in 3',
                label: 'used vehicles sold in the US has an undisclosed issue affecting safety or value.',
                delay: 100,
              },
              {
                stat: '$4,200',
                label: 'is the average unexpected repair cost buyers face within the first year of ownership.',
                delay: 200,
              },
              {
                stat: '78%',
                label: 'of buyers report they wished they had inspected more thoroughly before purchase.',
                delay: 300,
              },
            ].map(item => (
              <div
                key={item.stat}
                style={{
                  ...CARD,
                  ...reveal(on, item.delay),
                  padding: 'clamp(22px, 3vw, 30px)',
                  display: 'flex',
                  gap: 22,
                  alignItems: 'flex-start',
                }}
              >
                <div style={{ flexShrink: 0 }}>
                  <div style={{
                    fontSize: 'clamp(28px, 4vw, 36px)',
                    fontWeight: 900,
                    letterSpacing: '-0.04em',
                    lineHeight: 1,
                    color: '#22d3ee',
                  }}>
                    {item.stat}
                  </div>
                </div>
                <p style={{ margin: 0, fontSize: 13.5, color: 'rgba(255,255,255,0.48)', lineHeight: 1.65, paddingTop: 4 }}>
                  {item.label}
                </p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  )
}

// ══════════════════════════════════════════════════════════════
// SECTION 02 — What can be detected
// ══════════════════════════════════════════════════════════════

const DETECTIONS = [
  {
    n: 'I',
    title: 'Body & Structural Integrity',
    caption: 'Panel gaps · Repaint signals · Accident deformation',
    body: 'Systematic review of exterior panel alignment, surface consistency, and visible structural deformation. Inconsistencies in panel gaps or paint texture can indicate undisclosed collision repair.',
    color: 'rgba(34,211,238,0.7)',
    bg: 'rgba(34,211,238,0.04)',
    border: 'rgba(34,211,238,0.1)',
  },
  {
    n: 'II',
    title: 'Interior Condition & Electronics',
    caption: 'Wear indicators · Warning lights · Functional checks',
    body: 'Cabin wear assessment, dashboard warning light identification, and verification of electronic systems — areas routinely glossed over during a standard seller walkthrough.',
    color: 'rgba(129,140,248,0.8)',
    bg: 'rgba(129,140,248,0.04)',
    border: 'rgba(129,140,248,0.1)',
  },
  {
    n: 'III',
    title: 'Engine Bay & Mechanical Visuals',
    caption: 'Fluid leaks · Corrosion · Visible wear',
    body: 'Under-hood visual inspection for fluid contamination, corrosion patterns, irregular connections, and other visible indicators of deferred maintenance or prior mechanical issues.',
    color: 'rgba(245,158,11,0.7)',
    bg: 'rgba(245,158,11,0.04)',
    border: 'rgba(245,158,11,0.1)',
  },
  {
    n: 'IV',
    title: 'Comprehensive Risk Profile',
    caption: 'Checklist scoring · Risk flags · Overall assessment',
    body: 'Structured inspection checklist results are synthesized with visual findings into a single, clear risk score — giving you an objective basis for your buying decision.',
    color: 'rgba(34,197,94,0.7)',
    bg: 'rgba(34,197,94,0.04)',
    border: 'rgba(34,197,94,0.1)',
  },
]

function DetectionSection() {
  const { ref, on } = useReveal(0.08)

  return (
    <section
      aria-label="What Can Be Detected"
      style={{ ...SEC, background: 'rgba(255,255,255,0.01)', borderTop: '1px solid rgba(255,255,255,0.06)' }}
    >
      <div style={{ maxWidth: W, margin: '0 auto' }}>
        <div aria-hidden style={{ marginBottom: -20 }}>
          <span style={{ display: 'block', fontSize: 'clamp(100px, 16vw, 200px)', fontWeight: 900, letterSpacing: '-0.08em', lineHeight: 0.85, color: 'rgba(255,255,255,0.018)', userSelect: 'none', pointerEvents: 'none' }}>02</span>
        </div>

        {/* Header */}
        <div ref={ref} style={{ ...reveal(on), marginBottom: 'clamp(32px, 4vw, 48px)' }}>
          <SectionEyebrow>Inspection Intelligence</SectionEyebrow>

          <h2 style={{ margin: 0, fontSize: 'clamp(28px, 3.8vw, 46px)', fontWeight: 800, letterSpacing: '-0.03em', lineHeight: 1.12, color: '#fff', maxWidth: 640 }}>
            Four critical dimensions of visible vehicle condition.
          </h2>
        </div>

        {/* Detection cards */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(270px, 1fr))', gap: 12 }}>
          {DETECTIONS.map((item, i) => (
            <DetectionCard key={item.n} item={item} delay={i * 80} visible={on} />
          ))}
        </div>
      </div>
    </section>
  )
}

function DetectionCard({ item, delay, visible }: {
  item: typeof DETECTIONS[0]
  delay: number
  visible: boolean
}) {
  const [hovered, setHovered] = useState(false)
  return (
    <article
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        ...reveal(visible, delay),
        background: hovered ? item.bg : 'rgba(255,255,255,0.02)',
        border: `1px solid ${hovered ? item.border : 'rgba(255,255,255,0.07)'}`,
        borderTop: `2px solid ${hovered ? item.color : 'rgba(255,255,255,0.1)'}`,
        borderRadius: 6,
        padding: 'clamp(24px, 3vw, 32px)',
        transition: 'background 0.25s, border-color 0.25s',
        cursor: 'default',
      }}
    >
      {/* Roman numeral */}
      <div style={{
        fontSize: 11, fontWeight: 700, letterSpacing: '0.18em',
        color: hovered ? item.color : 'rgba(255,255,255,0.2)',
        marginBottom: 20, transition: 'color 0.25s',
        fontFeatureSettings: '"tnum"',
      }}>
        {item.n}
      </div>
      <h3 style={{ margin: '0 0 8px', fontSize: 17, fontWeight: 700, color: '#fff', letterSpacing: '-0.02em', lineHeight: 1.3 }}>
        {item.title}
      </h3>
      <p style={{ margin: '0 0 16px', fontSize: 11, fontWeight: 600, letterSpacing: '0.1em', textTransform: 'uppercase', color: hovered ? item.color : 'rgba(255,255,255,0.25)', transition: 'color 0.25s' }}>
        {item.caption}
      </p>
      <p style={{ margin: 0, fontSize: 14, color: 'rgba(255,255,255,0.48)', lineHeight: 1.72 }}>
        {item.body}
      </p>
    </article>
  )
}

// ══════════════════════════════════════════════════════════════
// SECTION 03 — The inspection process
// ══════════════════════════════════════════════════════════════

const STEPS = [
  {
    n: '01',
    title: 'Add Your Vehicle',
    body: 'Enter the vehicle details. Every inspection, photo, and finding is anchored to this specific car — creating a clean, organized record from first contact.',
  },
  {
    n: '02',
    title: 'Follow the Guided Checklist',
    body: 'Work through a structured inspection sequence covering exterior, interior, mechanical systems, and documentation. No automotive background required.',
  },
  {
    n: '03',
    title: 'Submit Photos for Analysis',
    body: 'Upload photos from key inspection angles. Our system analyzes visible surface conditions, panel consistency, and other indicators that inform the overall assessment.',
  },
  {
    n: '04',
    title: 'Receive Your Report',
    body: 'A comprehensive report delivers your risk score, flagged findings, and actionable recommendations — giving you the clarity to buy with confidence or walk away with certainty.',
  },
]

function ProcessSection() {
  const { ref, on } = useReveal(0.08)

  return (
    <section
      aria-label="The Inspection Process"
      style={{ ...SEC, background: '#070b11', borderTop: '1px solid rgba(255,255,255,0.06)' }}
    >
      <div style={{ maxWidth: W, margin: '0 auto' }}>
        <div aria-hidden style={{ marginBottom: -20 }}>
          <span style={{ display: 'block', fontSize: 'clamp(100px, 16vw, 200px)', fontWeight: 900, letterSpacing: '-0.08em', lineHeight: 0.85, color: 'rgba(255,255,255,0.018)', userSelect: 'none', pointerEvents: 'none' }}>03</span>
        </div>

        {/* Header */}
        <div ref={ref} style={{ ...reveal(on), display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 'clamp(36px, 4vw, 64px)', marginBottom: 'clamp(44px, 5vw, 72px)', alignItems: 'end' }}>
          <div>
            <SectionEyebrow>How It Works</SectionEyebrow>

            <h2 style={{ margin: 0, fontSize: 'clamp(28px, 3.8vw, 46px)', fontWeight: 800, letterSpacing: '-0.03em', lineHeight: 1.12, color: '#fff' }}>
              From first look to final decision — a structured path.
            </h2>
          </div>
          <p style={{ margin: 0, fontSize: 16, color: 'rgba(255,255,255,0.44)', lineHeight: 1.8, maxWidth: 440 }}>
            Our workflow is designed for the real-world condition of a vehicle lot or private driveway — fast to run, impossible to rush, and built around the way decisions are actually made.
          </p>
        </div>

        {/* Steps */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '1px', background: 'rgba(255,255,255,0.07)', borderRadius: 6, overflow: 'hidden' }}>
          {STEPS.map((step, i) => (
            <StepBlock key={step.n} step={step} delay={i * 80} visible={on} />
          ))}
        </div>

        {/* CTA row */}
        <div style={{ ...reveal(on, 400), marginTop: 44, display: 'flex', justifyContent: 'flex-start' }}>
          <Link href="/inspection" style={{
            display: 'inline-flex', alignItems: 'center', gap: 10,
            padding: '14px 28px', borderRadius: 6,
            background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.12)',
            color: 'rgba(255,255,255,0.72)', fontSize: 13, fontWeight: 600,
            textDecoration: 'none', transition: 'all 0.2s', letterSpacing: '-0.01em',
          }}
            onMouseEnter={e => { const el = e.currentTarget as HTMLElement; el.style.background = 'rgba(34,211,238,0.06)'; el.style.border = '1px solid rgba(34,211,238,0.28)'; el.style.color = '#22d3ee'; }}
            onMouseLeave={e => { const el = e.currentTarget as HTMLElement; el.style.background = 'rgba(255,255,255,0.04)'; el.style.border = '1px solid rgba(255,255,255,0.12)'; el.style.color = 'rgba(255,255,255,0.72)'; }}
          >
            Begin the process
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/></svg>
          </Link>
        </div>
      </div>
    </section>
  )
}

function StepBlock({ step, delay, visible }: { step: typeof STEPS[0]; delay: number; visible: boolean }) {
  const [hovered, setHovered] = useState(false)
  return (
    <div
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        ...reveal(visible, delay),
        padding: 'clamp(28px, 3.5vw, 40px)',
        background: hovered ? 'rgba(255,255,255,0.035)' : '#070b11',
        transition: 'background 0.25s',
        cursor: 'default',
      }}
    >
      <div style={{ fontSize: 'clamp(36px, 5vw, 52px)', fontWeight: 900, letterSpacing: '-0.06em', lineHeight: 1, color: hovered ? 'rgba(34,211,238,0.35)' : 'rgba(255,255,255,0.08)', marginBottom: 20, transition: 'color 0.25s', fontVariantNumeric: 'tabular-nums' }}>
        {step.n}
      </div>
      <h3 style={{ margin: '0 0 12px', fontSize: 17, fontWeight: 700, color: '#fff', letterSpacing: '-0.02em', lineHeight: 1.3 }}>
        {step.title}
      </h3>
      <p style={{ margin: 0, fontSize: 13.5, color: 'rgba(255,255,255,0.46)', lineHeight: 1.72 }}>
        {step.body}
      </p>
    </div>
  )
}

// ══════════════════════════════════════════════════════════════
// SECTION 04 — Visual inspection explained (split layout)
// ══════════════════════════════════════════════════════════════

function VisualInspectionSection() {
  const { ref, on } = useReveal(0.08)

  const VISUAL_POINTS = [
    {
      title: 'Surface condition indicators',
      body: 'Photos are reviewed for surface damage, corrosion, fluid residue, and condition signals that may not be visible under showroom lighting.',
    },
    {
      title: 'Repaint and alignment signals',
      body: 'Inconsistencies in panel gaps, uneven paint texture, overspray, and exterior irregularities suggest prior repair work — even when freshly detailed.',
    },
    {
      title: 'Documented visual evidence',
      body: 'Every uploaded photo becomes part of your inspection record — timestamped, organized, and available for reference or negotiation.',
    },
  ]

  return (
    <section
      aria-label="Visual Inspection Explained"
      style={{ ...SEC, background: 'rgba(255,255,255,0.01)', borderTop: '1px solid rgba(255,255,255,0.06)' }}
    >
      <div style={{ maxWidth: W, margin: '0 auto' }}>
        <div aria-hidden style={{ marginBottom: -20 }}>
          <span style={{ display: 'block', fontSize: 'clamp(100px, 16vw, 200px)', fontWeight: 900, letterSpacing: '-0.08em', lineHeight: 0.85, color: 'rgba(255,255,255,0.018)', userSelect: 'none', pointerEvents: 'none' }}>04</span>
        </div>

        <div
          ref={ref}
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
            gap: 'clamp(36px, 4.5vw, 58px)',
            alignItems: 'start',
          }}
        >
          {/* Left: Text */}
          <div style={reveal(on)}>
            <SectionEyebrow>Photo-Based Analysis</SectionEyebrow>

            <h2 style={{ margin: '0 0 24px', fontSize: 'clamp(28px, 3.8vw, 46px)', fontWeight: 800, letterSpacing: '-0.03em', lineHeight: 1.12, color: '#fff' }}>
              The camera sees what the eye can miss.
            </h2>
            <p style={{ margin: '0 0 36px', fontSize: 16, color: 'rgba(255,255,255,0.48)', lineHeight: 1.8 }}>
              Skilled automotive inspectors know what to look for — and more importantly, what to photograph. Our system replicates that discipline, guiding you to capture the angles that reveal a vehicle&apos;s true condition.
            </p>

            {/* Pull quote */}
            <div style={{ borderLeft: '2px solid rgba(34,211,238,0.35)', paddingLeft: 22, marginBottom: 8 }}>
              <p style={{ margin: 0, fontSize: 'clamp(15px, 2vw, 18px)', color: 'rgba(255,255,255,0.62)', lineHeight: 1.65, fontStyle: 'italic' }}>
                &ldquo;Buyers who document condition before purchase negotiate from strength — not speculation.&rdquo;
              </p>
            </div>
          </div>

          {/* Right: Feature list */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
            {VISUAL_POINTS.map((pt, i) => (
              <div
                key={pt.title}
                style={{
                  ...reveal(on, 100 + i * 100),
                  padding: 'clamp(20px, 2.5vw, 28px) 0',
                  borderBottom: i < VISUAL_POINTS.length - 1 ? '1px solid rgba(255,255,255,0.07)' : 'none',
                  display: 'flex', gap: 18, alignItems: 'flex-start',
                }}
              >
                <div style={{ width: 28, height: 28, borderRadius: 4, background: 'rgba(34,211,238,0.07)', border: '1px solid rgba(34,211,238,0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginTop: 2 }}>
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#22d3ee" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
                </div>
                <div>
                  <h3 style={{ margin: '0 0 6px', fontSize: 15, fontWeight: 700, color: '#fff', letterSpacing: '-0.01em', lineHeight: 1.3 }}>{pt.title}</h3>
                  <p style={{ margin: 0, fontSize: 13.5, color: 'rgba(255,255,255,0.46)', lineHeight: 1.7 }}>{pt.body}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  )
}

// ══════════════════════════════════════════════════════════════
// SECTION 05 — Risk reduction / confidence metrics
// ══════════════════════════════════════════════════════════════

function ConfidenceSection() {
  const { ref, on } = useReveal(0.08)

  const OUTCOMES = [
    {
      icon: (
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
          <path d="M22 12h-4l-3 9L9 3l-3 9H2"/>
        </svg>
      ),
      title: 'Clear Risk Score',
      body: 'A single, immediate read on overall vehicle risk — no decoding required. Know whether to proceed, negotiate, or walk away.',
    },
    {
      icon: (
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
          <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
          <line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>
        </svg>
      ),
      title: 'Specific Risk Flags',
      body: 'Pinpoint issues — not general impressions. Each flag identifies a specific area requiring closer attention or professional verification.',
    },
    {
      icon: (
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
          <line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/>
        </svg>
      ),
      title: 'Negotiation Leverage',
      body: 'Documented findings become negotiating facts. Use a verified risk profile to support a price reduction — or justify walking away.',
    },
    {
      icon: (
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="9 11 12 14 22 4"/>
          <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/>
        </svg>
      ),
      title: 'Decision Clarity',
      body: 'Buy, negotiate, or walk away — with the assurance that your decision is grounded in evidence, not emotion or seller presentation.',
    },
  ]

  return (
    <section
      aria-label="Confidence and Risk Reduction"
      style={{ ...SEC, background: '#080c14', borderTop: '1px solid rgba(255,255,255,0.06)' }}
    >
      <div style={{ maxWidth: W, margin: '0 auto' }}>
        <div aria-hidden style={{ marginBottom: -20 }}>
          <span style={{ display: 'block', fontSize: 'clamp(100px, 16vw, 200px)', fontWeight: 900, letterSpacing: '-0.08em', lineHeight: 0.85, color: 'rgba(255,255,255,0.018)', userSelect: 'none', pointerEvents: 'none' }}>05</span>
        </div>

        {/* Header */}
        <div ref={ref} style={{ ...reveal(on), marginBottom: 'clamp(32px, 4vw, 48px)' }}>
          <SectionEyebrow>Reduce Your Risk</SectionEyebrow>

          <h2 style={{ margin: '0 0 18px', fontSize: 'clamp(28px, 3.8vw, 46px)', fontWeight: 800, letterSpacing: '-0.03em', lineHeight: 1.12, color: '#fff', maxWidth: 640 }}>
            Transform uncertainty into a decisive advantage.
          </h2>
          <p style={{ margin: 0, fontSize: 16, color: 'rgba(255,255,255,0.44)', lineHeight: 1.8, maxWidth: 540 }}>
            Every used car purchase carries risk. The question is whether you enter that transaction informed — or hoping for the best.
          </p>
        </div>

        {/* Outcomes grid */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: 12 }}>
          {OUTCOMES.map((item, i) => (
            <div
              key={item.title}
              style={{
                ...CARD,
                ...reveal(on, 80 + i * 80),
                padding: 'clamp(24px, 3vw, 32px)',
                display: 'flex', flexDirection: 'column', gap: 14,
              }}
            >
              <div style={{ width: 44, height: 44, borderRadius: 6, background: 'rgba(34,211,238,0.07)', border: '1px solid rgba(34,211,238,0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#22d3ee' }}>
                {item.icon}
              </div>
              <div>
                <h3 style={{ margin: '0 0 9px', fontSize: 16, fontWeight: 700, color: '#fff', letterSpacing: '-0.02em', lineHeight: 1.3 }}>{item.title}</h3>
                <p style={{ margin: 0, fontSize: 13.5, color: 'rgba(255,255,255,0.46)', lineHeight: 1.7 }}>{item.body}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

// ══════════════════════════════════════════════════════════════
// SECTION 06 — Full transparency / scope
// ══════════════════════════════════════════════════════════════

function TransparencySection() {
  const { ref, on } = useReveal(0.08)

  const CAN_DO = [
    'Identify visible body damage, paint inconsistencies, and panel misalignment from photos.',
    'Guide you through a thorough checklist of exterior, interior, mechanical, and documentation items.',
    'Generate a report summarizing findings, risk score, and actionable recommendations.',
    'Document vehicle condition at time of inspection for negotiation and record-keeping.',
  ]

  const CANNOT_DO = [
    'Perform mechanical diagnostics or scan internal engine/transmission components.',
    'Guarantee hidden mechanical condition, long-term reliability, or future safety.',
    'Verify legal title status, outstanding finance obligations, or ownership history.',
    'Replace the evaluation of a qualified, hands-on pre-purchase inspection by a mechanic.',
  ]

  return (
    <section
      aria-label="Scope and Limitations"
      style={{ ...SEC, background: 'rgba(255,255,255,0.01)', borderTop: '1px solid rgba(255,255,255,0.06)' }}
    >
      <div style={{ maxWidth: W, margin: '0 auto' }}>
        <div aria-hidden style={{ marginBottom: -20 }}>
          <span style={{ display: 'block', fontSize: 'clamp(100px, 16vw, 200px)', fontWeight: 900, letterSpacing: '-0.08em', lineHeight: 0.85, color: 'rgba(255,255,255,0.018)', userSelect: 'none', pointerEvents: 'none' }}>06</span>
        </div>

        {/* Header */}
        <div ref={ref} style={{ ...reveal(on), marginBottom: 'clamp(32px, 4vw, 48px)' }}>
          <SectionEyebrow>Honest By Design</SectionEyebrow>

          <h2 style={{ margin: '0 0 18px', fontSize: 'clamp(28px, 3.8vw, 46px)', fontWeight: 800, letterSpacing: '-0.03em', lineHeight: 1.12, color: '#fff', maxWidth: 640 }}>
            What we do — and what we don&apos;t.
          </h2>
          <p style={{ margin: 0, fontSize: 16, color: 'rgba(255,255,255,0.44)', lineHeight: 1.8, maxWidth: 560 }}>
            Transparency about our capabilities is not a caveat — it&apos;s the foundation of trust. We built this platform knowing that honest limitations make it more valuable, not less.
          </p>
        </div>

        {/* Can / Cannot */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 16, marginBottom: 24 }}>
          {/* Can */}
          <div style={{ ...reveal(on, 80), ...CARD, padding: 'clamp(28px, 3.5vw, 36px)', borderTop: '2px solid rgba(34,197,94,0.4)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 24 }}>
              <div style={{ width: 34, height: 34, borderRadius: 5, background: 'rgba(34,197,94,0.08)', border: '1px solid rgba(34,197,94,0.18)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#22c55e" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
              </div>
              <h3 style={{ margin: 0, fontSize: 15, fontWeight: 700, color: '#22c55e', letterSpacing: '-0.01em' }}>What we provide</h3>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              {CAN_DO.map((item, i) => (
                <div key={i} style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
                  <div style={{ width: 16, height: 16, borderRadius: 3, background: 'rgba(34,197,94,0.08)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginTop: 2 }}>
                    <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="#22c55e" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
                  </div>
                  <p style={{ margin: 0, fontSize: 13.5, color: 'rgba(255,255,255,0.55)', lineHeight: 1.65 }}>{item}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Cannot */}
          <div style={{ ...reveal(on, 160), ...CARD, padding: 'clamp(28px, 3.5vw, 36px)', borderTop: '2px solid rgba(255,255,255,0.1)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 24 }}>
              <div style={{ width: 34, height: 34, borderRadius: 5, background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.38)" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
              </div>
              <h3 style={{ margin: 0, fontSize: 15, fontWeight: 700, color: 'rgba(255,255,255,0.5)', letterSpacing: '-0.01em' }}>What we cannot do</h3>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              {CANNOT_DO.map((item, i) => (
                <div key={i} style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
                  <div style={{ width: 16, height: 16, borderRadius: 3, background: 'rgba(255,255,255,0.04)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginTop: 2 }}>
                    <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.26)" strokeWidth="2.8" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                  </div>
                  <p style={{ margin: 0, fontSize: 13.5, color: 'rgba(255,255,255,0.38)', lineHeight: 1.65 }}>{item}</p>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Disclaimer */}
        <div style={{
          ...reveal(on, 280),
          padding: 'clamp(20px, 2.5vw, 28px) clamp(22px, 3vw, 32px)',
          background: 'rgba(245,158,11,0.03)',
          border: '1px solid rgba(245,158,11,0.14)',
          borderLeft: '3px solid rgba(245,158,11,0.4)',
          borderRadius: 6,
        }}>
          <div style={{ display: 'flex', gap: 14, alignItems: 'flex-start' }}>
            <svg style={{ flexShrink: 0, marginTop: 2 }} width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#f59e0b" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
              <line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>
            </svg>
            <p style={{ margin: 0, fontSize: 13.5, color: 'rgba(255,255,255,0.46)', lineHeight: 1.7 }}>
              <strong style={{ color: 'rgba(255,255,255,0.68)', fontWeight: 600 }}>Advisory Notice:</strong>{' '}
              Used Cars Doctor is an informational decision-support tool. It does not constitute a professional mechanical inspection, certified appraisal, or legal verification of title or ownership. Always verify critical findings with a qualified mechanic and appropriate legal channels before finalizing any vehicle purchase.
            </p>
          </div>
        </div>
      </div>
    </section>
  )
}

// ══════════════════════════════════════════════════════════════
// SECTION 07 — The decisive moment (editorial statement)
// ══════════════════════════════════════════════════════════════

function DecisiveSection() {
  const { ref, on } = useReveal(0.12)

  return (
    <section
      aria-label="Before You Buy"
      style={{
        ...SEC,
        background: '#070b11',
        borderTop: '1px solid rgba(255,255,255,0.06)',
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      {/* Background atmosphere */}
      <div aria-hidden style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}>
        <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', width: '70%', height: '70%', background: 'radial-gradient(ellipse at 50% 50%, rgba(34,211,238,0.03) 0%, transparent 65%)' }} />
      </div>

      <div style={{ maxWidth: W, margin: '0 auto', position: 'relative', zIndex: 1 }}>
        {/* Large decorative quotation mark */}
        <div aria-hidden style={{
          fontSize: 'clamp(120px, 20vw, 240px)',
          fontWeight: 900,
          lineHeight: 0.8,
          color: 'rgba(34,211,238,0.04)',
          marginBottom: -24,
          userSelect: 'none',
          pointerEvents: 'none',
          letterSpacing: '-0.05em',
        }}>&ldquo;</div>

        <div
          ref={ref}
          style={{ maxWidth: 800 }}
        >
          <blockquote style={{ margin: '0 0 36px', padding: 0, border: 'none' }}>
            <p style={{
              ...reveal(on),
              margin: 0,
              fontSize: 'clamp(24px, 3.8vw, 44px)',
              fontWeight: 700,
              letterSpacing: '-0.03em',
              lineHeight: 1.22,
              color: '#fff',
              fontStyle: 'normal',
            }}>
              The moment before you buy a used car is the most important moment in the entire transaction.
            </p>
          </blockquote>

          <div style={{ ...reveal(on, 120), width: 48, height: 1, background: 'rgba(34,211,238,0.4)', marginBottom: 32 }} />

          <p style={{
            ...reveal(on, 160),
            margin: '0 0 20px',
            fontSize: 'clamp(15px, 1.9vw, 17px)',
            color: 'rgba(255,255,255,0.5)',
            lineHeight: 1.8,
            maxWidth: 600,
          }}>
            It is the moment when information has the highest value — before money changes hands, before legal agreements are signed, before the keys are yours and the problems become yours too.
          </p>

          <p style={{
            ...reveal(on, 200),
            margin: '0 0 44px',
            fontSize: 'clamp(15px, 1.9vw, 17px)',
            color: 'rgba(255,255,255,0.5)',
            lineHeight: 1.8,
            maxWidth: 600,
          }}>
            Used Cars Doctor exists entirely within that window — giving you the structure, the analysis, and the confidence to make the right call when it matters most.
          </p>

          {/* CTA */}
          <div style={reveal(on, 260)}>
            <Link href="/inspection" style={{
              display: 'inline-flex', alignItems: 'center', gap: 10,
              padding: '15px 32px', borderRadius: 6,
              background: 'linear-gradient(135deg, #22d3ee, #06b6d4)',
              color: '#030d12', fontSize: 14, fontWeight: 700,
              textDecoration: 'none',
              boxShadow: '0 8px 32px rgba(34,211,238,0.28)',
              transition: 'transform 0.2s, box-shadow 0.2s',
              letterSpacing: '-0.01em',
            }}
              onMouseEnter={e => { (e.currentTarget as HTMLElement).style.transform = 'translateY(-2px)'; (e.currentTarget as HTMLElement).style.boxShadow = '0 14px 44px rgba(34,211,238,0.5)'; }}
              onMouseLeave={e => { (e.currentTarget as HTMLElement).style.transform = ''; (e.currentTarget as HTMLElement).style.boxShadow = '0 8px 32px rgba(34,211,238,0.28)'; }}
            >
              Inspect Before You Buy
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/></svg>
            </Link>
          </div>
        </div>
      </div>
    </section>
  )
}

// ══════════════════════════════════════════════════════════════
// SECTION 08 — FAQ
// ══════════════════════════════════════════════════════════════

const FAQ_DATA = [
  {
    q: 'What is a pre-purchase used car inspection?',
    a: 'A pre-purchase inspection is a systematic evaluation of a vehicle\'s condition before you finalize the transaction. It covers visible body condition, mechanical visuals, interior state, and documentation. Used Cars Doctor provides a structured digital workflow — guided checklist plus photo analysis — that replicates the approach used by professional automotive inspectors.',
  },
  {
    q: 'Does this replace a mechanic\'s inspection?',
    a: 'No — and we say that clearly because it matters. Used Cars Doctor is a comprehensive pre-screening and documentation tool. For critical mechanical components (engine, transmission, suspension, brakes), a qualified mechanic\'s hands-on inspection remains essential. Think of our platform as the first, structured layer of your due diligence — not the last.',
  },
  {
    q: 'How does the photo analysis work?',
    a: 'You upload photos taken from guided angles — exterior panels, engine bay, interior, undercarriage. Our system analyzes these photos for visible condition signals: paint inconsistencies, panel misalignment, surface damage, fluid contamination, and other indicators. Results are integrated with your checklist responses to generate a consolidated risk assessment.',
  },
  {
    q: 'Can Used Cars Doctor detect accident damage?',
    a: 'Yes — from visible evidence. Our photo analysis identifies paint texture inconsistencies, panel gap irregularities, and surface deformation that often indicate prior collision repair. For a complete accident history including incidents not visible to inspection, a third-party vehicle history report from a provider like CARFAX is recommended in addition to our assessment.',
  },
  {
    q: 'What information do I need before starting?',
    a: 'Basic vehicle information: make, model, year, and mileage. VIN is helpful but not required to begin. You\'ll also need access to the vehicle to photograph and inspect it — our process is designed to work in the conditions of a typical private sale or dealer lot visit.',
  },
  {
    q: 'How long does the inspection take?',
    a: 'A thorough inspection using our platform typically takes 30–45 minutes. This includes working through the guided checklist and capturing photos at the recommended angles. The analysis and report generation are completed immediately upon submission.',
  },
]

function FAQItem({ item, index }: { item: typeof FAQ_DATA[0]; index: number }) {
  const [open, setOpen] = useState(false)

  return (
    <div style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
      <button
        onClick={() => setOpen(v => !v)}
        aria-expanded={open}
        style={{
          width: '100%', display: 'flex', justifyContent: 'space-between',
          alignItems: 'flex-start', gap: 20,
          padding: 'clamp(20px, 2.5vw, 26px) 0',
          background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left',
        }}
      >
        <div style={{ display: 'flex', gap: 20, alignItems: 'flex-start', flex: 1 }}>
          <span style={{ fontSize: 11, fontWeight: 700, color: open ? 'rgba(34,211,238,0.7)' : 'rgba(255,255,255,0.2)', letterSpacing: '0.15em', minWidth: 24, paddingTop: 3, transition: 'color 0.2s', fontVariantNumeric: 'tabular-nums' }}>
            {String(index + 1).padStart(2, '0')}
          </span>
          <span style={{ fontSize: 'clamp(15px, 2vw, 17px)', fontWeight: 600, color: open ? '#fff' : 'rgba(255,255,255,0.72)', lineHeight: 1.4, letterSpacing: '-0.01em', transition: 'color 0.2s' }}>
            {item.q}
          </span>
        </div>
        <div style={{
          width: 30, height: 30, borderRadius: 5, flexShrink: 0,
          background: open ? 'rgba(34,211,238,0.08)' : 'rgba(255,255,255,0.04)',
          border: `1px solid ${open ? 'rgba(34,211,238,0.2)' : 'rgba(255,255,255,0.08)'}`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          color: open ? '#22d3ee' : 'rgba(255,255,255,0.32)',
          transition: 'all 0.2s', marginTop: 2,
        }}>
          <svg
            width="12" height="12" viewBox="0 0 24 24" fill="none"
            stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"
            style={{ transform: open ? 'rotate(180deg)' : 'none', transition: 'transform 0.25s ease' }}
          >
            <polyline points="6 9 12 15 18 9"/>
          </svg>
        </div>
      </button>

      {open && (
        <div style={{ paddingBottom: 'clamp(20px, 2.5vw, 26px)', paddingLeft: 44, maxWidth: 720 }}>
          <p style={{ margin: 0, fontSize: 14.5, color: 'rgba(255,255,255,0.48)', lineHeight: 1.78 }}>
            {item.a}
          </p>
        </div>
      )}
    </div>
  )
}

function FAQSection() {
  const { ref, on } = useReveal(0.08)

  return (
    <section
      aria-label="Frequently Asked Questions"
      style={{ ...SEC, background: 'rgba(255,255,255,0.01)', borderTop: '1px solid rgba(255,255,255,0.06)' }}
    >
      <div style={{ maxWidth: W, margin: '0 auto' }}>
        <div aria-hidden style={{ marginBottom: -20 }}>
          <span style={{ display: 'block', fontSize: 'clamp(100px, 16vw, 200px)', fontWeight: 900, letterSpacing: '-0.08em', lineHeight: 0.85, color: 'rgba(255,255,255,0.018)', userSelect: 'none', pointerEvents: 'none' }}>07</span>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 'clamp(36px, 4.5vw, 58px)', alignItems: 'start' }}>
          {/* Label column */}
          <div ref={ref} style={{ ...reveal(on) }}>
            <SectionEyebrow>Frequently Asked</SectionEyebrow>

            <h2 style={{ margin: '0 0 18px', fontSize: 'clamp(28px, 3.8vw, 44px)', fontWeight: 800, letterSpacing: '-0.03em', lineHeight: 1.12, color: '#fff' }}>
              Common questions about used car inspection.
            </h2>
            <p style={{ margin: '0 0 32px', fontSize: 15, color: 'rgba(255,255,255,0.42)', lineHeight: 1.78 }}>
              If you have a question not covered here, our team is available to help.
            </p>
            <Link href="/inspection" style={{
              display: 'inline-flex', alignItems: 'center', gap: 8,
              fontSize: 13, fontWeight: 600, color: 'rgba(255,255,255,0.45)',
              textDecoration: 'none', border: '1px solid rgba(255,255,255,0.1)',
              padding: '10px 18px', borderRadius: 5, transition: 'all 0.2s',
            }}
              onMouseEnter={e => { const el = e.currentTarget as HTMLElement; el.style.color = 'rgba(255,255,255,0.82)'; el.style.border = '1px solid rgba(255,255,255,0.22)'; el.style.background = 'rgba(255,255,255,0.04)'; }}
              onMouseLeave={e => { const el = e.currentTarget as HTMLElement; el.style.color = 'rgba(255,255,255,0.45)'; el.style.border = '1px solid rgba(255,255,255,0.1)'; el.style.background = 'transparent'; }}
            >
              Start an inspection instead
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/></svg>
            </Link>
          </div>

          {/* Questions */}
          <div style={{ ...reveal(on, 80) }}>
            {FAQ_DATA.map((item, i) => (
              <FAQItem key={item.q} item={item} index={i} />
            ))}
          </div>
        </div>
      </div>
    </section>
  )
}

// ══════════════════════════════════════════════════════════════
// FINAL CTA
// ══════════════════════════════════════════════════════════════

function FinalCTA() {
  const { ref, on } = useReveal(0.12)

  return (
    <section
      aria-label="Call to Action"
      style={{ ...SEC, background: '#070b11', borderTop: '1px solid rgba(255,255,255,0.06)', position: 'relative', overflow: 'hidden' }}
    >
      {/* Subtle atmospheric glow */}
      <div aria-hidden style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}>
        <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', width: '60%', height: '200%', background: 'radial-gradient(ellipse at 50% 50%, rgba(34,211,238,0.04) 0%, transparent 55%)' }} />
      </div>

      <div ref={ref} style={{ maxWidth: W, margin: '0 auto', textAlign: 'center', position: 'relative', zIndex: 1 }}>

        <div style={reveal(on)}>
          <SectionEyebrow>Get Started</SectionEyebrow>

        </div>

        <h2 style={{
          ...reveal(on, 60),
          margin: '0 auto 24px',
          fontSize: 'clamp(36px, 5.5vw, 68px)',
          fontWeight: 900,
          letterSpacing: '-0.04em',
          lineHeight: 1.06,
          color: '#fff',
          maxWidth: 700,
        }}>
          {balanceHeadlineText('Get Started Today.')}<br />
          <span style={{ color: 'rgba(255,255,255,0.42)' }}>
            {balanceHeadlineText('Drive with Confidence.')}
          </span>
        </h2>

        <p style={{
          ...reveal(on, 120),
          margin: '0 auto 44px',
          fontSize: 'clamp(15px, 1.9vw, 17px)',
          color: 'rgba(255,255,255,0.44)',
          lineHeight: 1.78,
          maxWidth: 500,
        }}>
          Your next vehicle purchase deserves the same rigor that every serious buyer should apply — but few do.
        </p>

        <div style={{ ...reveal(on, 180), display: 'flex', flexWrap: 'wrap', gap: 14, justifyContent: 'center', marginBottom: 44 }}>
          <Link href="/inspection" style={{
            display: 'inline-flex', alignItems: 'center', gap: 10,
            padding: '16px 36px', borderRadius: 6,
            background: 'linear-gradient(135deg, #22d3ee, #06b6d4)',
            color: '#030d12', fontSize: 15, fontWeight: 700,
            textDecoration: 'none',
            boxShadow: '0 8px 36px rgba(34,211,238,0.32)',
            transition: 'transform 0.2s, box-shadow 0.2s',
            letterSpacing: '-0.01em',
          }}
            onMouseEnter={e => { (e.currentTarget as HTMLElement).style.transform = 'translateY(-2px)'; (e.currentTarget as HTMLElement).style.boxShadow = '0 16px 52px rgba(34,211,238,0.54)'; }}
            onMouseLeave={e => { (e.currentTarget as HTMLElement).style.transform = ''; (e.currentTarget as HTMLElement).style.boxShadow = '0 8px 36px rgba(34,211,238,0.32)'; }}
          >
            Start Your Inspection Now
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/></svg>
          </Link>
          <Link href="/auth" style={{
            display: 'inline-flex', alignItems: 'center', gap: 8,
            padding: '16px 28px', borderRadius: 6,
            background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.1)',
            color: 'rgba(255,255,255,0.58)', fontSize: 15, fontWeight: 600,
            textDecoration: 'none', transition: 'all 0.2s', letterSpacing: '-0.01em',
          }}
            onMouseEnter={e => { const el = e.currentTarget as HTMLElement; el.style.background = 'rgba(255,255,255,0.08)'; el.style.border = '1px solid rgba(255,255,255,0.2)'; el.style.color = 'rgba(255,255,255,0.88)'; }}
            onMouseLeave={e => { const el = e.currentTarget as HTMLElement; el.style.background = 'rgba(255,255,255,0.04)'; el.style.border = '1px solid rgba(255,255,255,0.1)'; el.style.color = 'rgba(255,255,255,0.58)'; }}
          >
            Sign In to Your Account
          </Link>
        </div>

        {/* Trust strip */}
        <div style={{ ...reveal(on, 260), display: 'flex', flexWrap: 'wrap', justifyContent: 'center', gap: 'clamp(24px, 4vw, 48px)' }}>
          {[
            'Free to start',
            'No automotive expertise required',
            'Always recommend a professional mechanic',
          ].map(label => (
            <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12.5, color: 'rgba(255,255,255,0.3)', fontWeight: 500, letterSpacing: '0.01em' }}>
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="rgba(34,211,238,0.5)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
              {label}
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

// ══════════════════════════════════════════════════════════════
// MINIMAL FOOTER — Authority page footer
// ══════════════════════════════════════════════════════════════

function PageFooter() {
  return (
    <footer style={{ borderTop: '1px solid rgba(255,255,255,0.06)', background: '#070b11' }}>
      <div style={{ maxWidth: W, margin: '0 auto', padding: 'clamp(36px, 5vw, 56px) clamp(20px, 4vw, 40px)', display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: 20 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ width: 28, height: 28, borderRadius: 7, background: 'linear-gradient(135deg, #22d3ee 0%, #818cf8 100%)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#040910" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
            </svg>
          </div>
          <span style={{ fontSize: 13, fontWeight: 700, color: 'rgba(255,255,255,0.5)', letterSpacing: '-0.2px' }}>Used Cars Doctor</span>
        </div>

        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'clamp(16px, 3vw, 28px)', alignItems: 'center' }}>
          {[
            { label: 'Home', href: '/' },
            { label: 'Start Inspection', href: '/inspection' },
            { label: 'Privacy Policy', href: '/legal/privacy' },
            { label: 'Terms of Service', href: '/legal/terms' },
          ].map(item => (
            <Link key={item.href} href={item.href} style={{
              fontSize: 12, color: 'rgba(255,255,255,0.3)', textDecoration: 'none', letterSpacing: '-0.1px', transition: 'color 0.15s',
            }}
              onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = 'rgba(255,255,255,0.62)'; }}
              onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = 'rgba(255,255,255,0.3)'; }}
            >
              {item.label}
            </Link>
          ))}
        </div>
      </div>
    </footer>
  )
}

// ══════════════════════════════════════════════════════════════
// PAGE — root export
// ══════════════════════════════════════════════════════════════

export default function BeforeYouBuy() {
  return (
    <div style={{ minHeight: '100svh', background: '#070b11', color: '#fff', overflowX: 'hidden' }}>
      <LandingNav />
      <PageHero />
      <RealitySection />
      <DetectionSection />
      <ProcessSection />
      <VisualInspectionSection />
      <ConfidenceSection />
      <TransparencySection />
      <DecisiveSection />
      <FAQSection />
      <FinalCTA />
      <PageFooter />
    </div>
  )
}
