'use client'

import { useRef, useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'

// ── Phase key config — module-level (no t() calls allowed here) ───────────────
// Only translation key strings; actual translated text is derived inside the
// component so the animation math (N, cardState, etc.) stays fully static.

type PhaseKeyConfig = {
  titleKey:   string
  descKey:    string
  bulletKeys: [string, string, string]
}

const PHASE_KEYS: PhaseKeyConfig[] = [
  {
    titleKey:   'scroll.research.title',
    descKey:    'scroll.research.desc',
    bulletKeys: ['scroll.research.b0', 'scroll.research.b1', 'scroll.research.b2'],
  },
  {
    titleKey:   'scroll.exterior.title',
    descKey:    'scroll.exterior.desc',
    bulletKeys: ['scroll.exterior.b0', 'scroll.exterior.b1', 'scroll.exterior.b2'],
  },
  {
    titleKey:   'scroll.photos.title',
    descKey:    'scroll.photos.desc',
    bulletKeys: ['scroll.photos.b0', 'scroll.photos.b1', 'scroll.photos.b2'],
  },
  {
    titleKey:   'scroll.interior.title',
    descKey:    'scroll.interior.desc',
    bulletKeys: ['scroll.interior.b0', 'scroll.interior.b1', 'scroll.interior.b2'],
  },
  {
    titleKey:   'scroll.mechanical.title',
    descKey:    'scroll.mechanical.desc',
    bulletKeys: ['scroll.mechanical.b0', 'scroll.mechanical.b1', 'scroll.mechanical.b2'],
  },
  {
    titleKey:   'scroll.score.title',
    descKey:    'scroll.score.desc',
    bulletKeys: ['scroll.score.b0', 'scroll.score.b1', 'scroll.score.b2'],
  },
]

const N = PHASE_KEYS.length

// ── Layer state ────────────────────────────────────────────────────────────────

interface S {
  rotX: number   // rotateX deg
  ty: number     // translateY px
  tz: number     // translateZ px
  scale: number
  opacity: number
  blur: number
}

const ACTIVE:   S = { rotX: 0,   ty: 0,   tz: 0,    scale: 1,    opacity: 1,    blur: 0   }
const B1:       S = { rotX: 4,   ty: -22, tz: -90,  scale: 0.94, opacity: 0.7,  blur: 0   }
const B2:       S = { rotX: 7,   ty: -38, tz: -180, scale: 0.88, opacity: 0.42, blur: 0.6 }
const B3:       S = { rotX: 10,  ty: -52, tz: -260, scale: 0.82, opacity: 0.18, blur: 1.2 }
const GONE:     S = { rotX: 10,  ty: -52, tz: -260, scale: 0.82, opacity: 0,    blur: 1.2 }
const INCOMING: S = { rotX: -2,  ty: 64,  tz: -44,  scale: 0.96, opacity: 0,    blur: 0   }

const lerp = (a: number, b: number, t: number) => a + (b - a) * Math.max(0, Math.min(1, t))

const lerpS = (a: S, b: S, t: number): S => ({
  rotX:    lerp(a.rotX,    b.rotX,    t),
  ty:      lerp(a.ty,      b.ty,      t),
  tz:      lerp(a.tz,      b.tz,      t),
  scale:   lerp(a.scale,   b.scale,   t),
  opacity: lerp(a.opacity, b.opacity, t),
  blur:    lerp(a.blur,    b.blur,    t),
})

const toXform = (s: S) =>
  `rotateX(${s.rotX.toFixed(2)}deg) translateY(${s.ty.toFixed(1)}px) translateZ(${s.tz.toFixed(1)}px) scale(${s.scale.toFixed(4)})`

// Cubic ease-out
const ease3 = (t: number) => 1 - Math.pow(Math.max(0, Math.min(1, 1 - t)), 3)

function cardState(idx: number, prog: number): S {
  const raw = prog * N
  const ai  = Math.min(N - 1, Math.floor(raw))
  const tp  = ai === N - 1 ? 0 : ease3(raw - Math.floor(raw))
  const rel = idx - ai
  if (rel === 0)  return lerpS(ACTIVE,   B1,   tp)
  if (rel === 1)  return lerpS(INCOMING, ACTIVE, tp)
  if (rel === -1) return lerpS(B1,       B2,   tp)
  if (rel === -2) return lerpS(B2,       B3,   tp)
  if (rel === -3) return lerpS(B3,       GONE, tp)
  if (rel < -3)   return GONE
  return INCOMING
}

// Walk up DOM to find the actual scrolling ancestor
function findScroller(el: HTMLElement): Element {
  let node = el.parentElement
  while (node && node !== document.documentElement) {
    const { overflow, overflowY } = globalThis.getComputedStyle(node)
    if (/auto|scroll/.test(overflow + overflowY)) return node
    node = node.parentElement
  }
  return document.documentElement
}

// ── Component ─────────────────────────────────────────────────────────────────

export function PhaseScrollStack() {
  const { t }    = useTranslation()
  const outerRef = useRef<HTMLDivElement>(null)
  const cardRefs = useRef<(HTMLDivElement | null)[]>(new Array(N).fill(null))
  const dotRefs  = useRef<(HTMLDivElement | null)[]>(new Array(N).fill(null))
  const hintRef  = useRef<HTMLDivElement>(null)
  const rafRef   = useRef(0)
  const aiRef    = useRef(0)

  // React state only for lazy content rendering — not for per-frame updates
  const [activeIdx, setActiveIdx] = useState(0)

  useEffect(() => {
    const outer = outerRef.current
    if (!outer) return

    const scroller = findScroller(outer)
    const isWin = scroller === document.documentElement

    const tick = () => {
      const outerRect   = outer.getBoundingClientRect()
      const viewH       = isWin ? globalThis.innerHeight : (scroller as HTMLElement).clientHeight
      const scrollerTop = isWin ? 0 : scroller.getBoundingClientRect().top

      const relTop     = outerRect.top - scrollerTop
      const scrollable = outer.offsetHeight - viewH
      if (scrollable <= 0) return

      const p     = Math.max(0, Math.min(1, -relTop / scrollable))
      const rawN  = p * N
      const newAi = Math.min(N - 1, Math.floor(rawN))

      // Direct DOM mutations — zero React re-renders per frame
      cardRefs.current.forEach((el, idx) => {
        if (!el) return
        const s = cardState(idx, p)
        el.style.transform     = toXform(s)
        el.style.opacity       = s.opacity.toFixed(3)
        el.style.filter        = s.blur > 0.05 ? `blur(${s.blur.toFixed(2)}px)` : 'none'
        let zIdx: number
        if (idx === newAi) zIdx = 100
        else if (idx === newAi + 1) zIdx = 80
        else zIdx = Math.max(1, 60 - (newAi - idx) * 12)
        el.style.zIndex = String(zIdx)
        el.style.pointerEvents = idx === newAi ? 'auto' : 'none'
        el.style.borderColor   = idx === newAi ? 'rgba(34,211,238,0.22)' : 'rgba(255,255,255,0.06)'
      })

      dotRefs.current.forEach((el, idx) => {
        if (!el) return
        el.style.width = idx === newAi ? '20px' : '5px'
        let dotBg: string
        let dotOp: string
        if (idx === newAi) { dotBg = '#22d3ee'; dotOp = '1' }
        else if (idx < newAi) { dotBg = 'rgba(34,211,238,0.38)'; dotOp = '0.65' }
        else { dotBg = 'rgba(255,255,255,0.14)'; dotOp = '0.28' }
        el.style.background = dotBg
        el.style.opacity    = dotOp
      })

      if (hintRef.current) hintRef.current.style.opacity = p < 0.04 ? '1' : '0'

      if (newAi !== aiRef.current) {
        aiRef.current = newAi
        setActiveIdx(newAi)
      }
    }

    const onScroll = () => {
      cancelAnimationFrame(rafRef.current)
      rafRef.current = requestAnimationFrame(tick)
    }

    const target: EventTarget = isWin ? globalThis : scroller
    target.addEventListener('scroll', onScroll, { passive: true })
    tick() // set initial positions immediately

    return () => {
      target.removeEventListener('scroll', onScroll)
      cancelAnimationFrame(rafRef.current)
    }
  }, [])

  // Outer height = N × 100vh gives each phase 100vh of scroll range
  return (
    <div ref={outerRef} style={{ height: `${N * 100}vh`, position: 'relative' }}>

      {/* ── Sticky viewport ─────────────────────────────────────────────────── */}
      <div style={{
        position: 'sticky',
        top: 0,
        // calc(100svh - 60px): leaves room for the app header so nothing clips
        height: 'calc(100svh - 60px)',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        overflow: 'hidden',
        padding: '0 8px',
      }}>

        {/* ── Card stack ────────────────────────────────────────────────────── */}
        <div style={{
          position: 'relative',
          width: '100%',
          maxWidth: 600,
          // Height shrinks on very small screens
          height: 'min(480px, calc(100svh - 200px))',
          perspective: '1100px',
          perspectiveOrigin: '50% -6%',
        }}>
          {PHASE_KEYS.map((pk, idx) => {
            let initS: S
            if (idx === 0) initS = ACTIVE
            else if (idx === 1) initS = INCOMING
            else initS = GONE

            // Only render card content for active ± 1 to reduce DOM work
            const renderContent = Math.abs(idx - activeIdx) <= 1

            const initBorder = idx === 0 ? 'rgba(34,211,238,0.22)' : 'rgba(255,255,255,0.06)'
            let initZ: number
            if (idx === 0) initZ = 100
            else if (idx === 1) initZ = 80
            else initZ = 20

            return (
              <div
                key={idx}
                ref={el => { cardRefs.current[idx] = el }}
                style={{
                  position: 'absolute',
                  inset: 0,
                  borderRadius: 20,
                  background: 'rgba(8,12,22,0.97)',
                  border: `1px solid ${initBorder}`,
                  boxShadow: [
                    '0 2px 6px rgba(0,0,0,0.7)',
                    '0 14px 44px rgba(0,0,0,0.55)',
                    '0 40px 90px rgba(0,0,0,0.38)',
                    'inset 0 1px 0 rgba(255,255,255,0.06)',
                  ].join(', '),
                  overflow: 'hidden',
                  display: 'flex',
                  flexDirection: 'column',
                  // GPU promotion for smooth 60fps transforms
                  willChange: 'transform, opacity, filter',
                  transformOrigin: '50% 50%',
                  backfaceVisibility: 'hidden',
                  transform: toXform(initS),
                  opacity: initS.opacity,
                  zIndex: initZ,
                  pointerEvents: idx === 0 ? 'auto' : 'none',
                }}
              >
                {/* Top edge directional light */}
                <div style={{
                  position: 'absolute', top: 0, left: 0, right: 0, height: 1,
                  background: 'linear-gradient(90deg, transparent 10%, rgba(34,211,238,0.38) 50%, transparent 90%)',
                  pointerEvents: 'none', zIndex: 5,
                }} />

                {/* Step counter badge */}
                <div style={{
                  position: 'absolute', top: 14, right: 14,
                  fontSize: 9, fontWeight: 700,
                  color: 'rgba(255,255,255,0.28)',
                  background: 'rgba(255,255,255,0.04)',
                  border: '1px solid rgba(255,255,255,0.07)',
                  borderRadius: 5, padding: '2px 7px',
                  letterSpacing: '0.04em',
                }}>
                  {idx + 1} / {N}
                </div>

                {/* Card content */}
                {renderContent ? (
                  <div style={{
                    flex: 1, padding: '26px 22px 22px',
                    display: 'flex', flexDirection: 'column', justifyContent: 'center',
                  }}>
                    {/* Step number */}
                    <div style={{
                      fontSize: 10, fontWeight: 700, color: '#22d3ee',
                      letterSpacing: '0.12em', textTransform: 'uppercase', marginBottom: 10,
                    }}>
                      {t('scroll.step')} {idx + 1}
                    </div>

                    {/* Title */}
                    <div style={{
                      fontSize: 22, fontWeight: 800,
                      color: '#fff', letterSpacing: '-0.5px', lineHeight: 1.15,
                      marginBottom: 10,
                    }}>
                      {t(pk.titleKey)}
                    </div>

                    {/* Description */}
                    <div style={{
                      fontSize: 13, color: 'rgba(255,255,255,0.5)',
                      lineHeight: 1.65, marginBottom: 20,
                    }}>
                      {t(pk.descKey)}
                    </div>

                    {/* Bullets */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>
                      {pk.bulletKeys.map((bulletKey, bIdx) => (
                        <div key={bIdx} style={{
                          display: 'flex', gap: 11, alignItems: 'flex-start',
                          padding: '10px 14px',
                          background: 'rgba(255,255,255,0.025)',
                          border: '1px solid rgba(255,255,255,0.055)',
                          borderRadius: 10,
                        }}>
                          <div style={{
                            width: 5, height: 5, borderRadius: '50%', flexShrink: 0,
                            background: '#22d3ee', marginTop: 5,
                            boxShadow: '0 0 8px rgba(34,211,238,0.55)',
                          }} />
                          <span style={{
                            fontSize: 12.5, color: 'rgba(255,255,255,0.72)',
                            lineHeight: 1.55,
                          }}>
                            {t(bulletKey)}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : (
                  <div style={{ flex: 1 }} />
                )}
              </div>
            )
          })}
        </div>

        {/* ── Progress pills ──────────────────────────────────────────────────── */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: 7, marginTop: 18, zIndex: 200,
        }}>
          {PHASE_KEYS.map((_pk, idx) => (
            <div
              key={idx}
              ref={el => { dotRefs.current[idx] = el }}
              style={{
                height: 4, borderRadius: 2,
                width: idx === 0 ? 20 : 5,
                background: idx === 0 ? '#22d3ee' : 'rgba(255,255,255,0.14)',
                opacity: idx === 0 ? 1 : 0.28,
                transition: 'width 0.24s ease, background 0.24s ease, opacity 0.24s ease',
                willChange: 'width',
              }}
            />
          ))}
        </div>

        {/* ── Scroll hint ─────────────────────────────────────────────────────── */}
        <div
          ref={hintRef}
          style={{
            position: 'absolute', bottom: 18,
            left: '50%', transform: 'translateX(-50%)',
            display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 5,
            pointerEvents: 'none',
            transition: 'opacity 0.45s ease',
          }}
        >
          <span style={{
            fontSize: 9, fontWeight: 700, letterSpacing: '0.1em',
            textTransform: 'uppercase', whiteSpace: 'nowrap',
            color: 'rgba(255,255,255,0.18)',
          }}>
            {t('scroll.scrollHint')}
          </span>
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none"
            stroke="rgba(255,255,255,0.14)" strokeWidth="2.5"
            strokeLinecap="round" strokeLinejoin="round"
            style={{ animation: 'float 2.4s ease-in-out infinite' }}
          >
            <polyline points="6 9 12 15 18 9" />
          </svg>
        </div>
      </div>
    </div>
  )
}
