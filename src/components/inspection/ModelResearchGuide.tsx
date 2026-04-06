'use client'

// =============================================================================
// ModelResearchGuide — AI-powered pre-inspection known-issues guide
// Researches the vehicle model and surfaces known weaknesses, watchouts,
// and inspection priorities before the user starts their walkthrough.
// =============================================================================

import { useState, useCallback } from 'react'
import type { VehicleResearchResult, ResearchSection, ResearchIssue, ResearchTagType } from '@/types'
import { researchApi } from '@/services/api/research.api'

// ─── Tag config ───────────────────────────────────────────────────────────────

const TAG_CONFIG: Record<ResearchTagType, { label: string; color: string; bg: string; border: string }> = {
  HIGH_ATTENTION: { label: 'High Attention',  color: '#ef4444', bg: 'rgba(239,68,68,0.08)',    border: 'rgba(239,68,68,0.22)'   },
  COMMON_ISSUE:   { label: 'Common Issue',    color: '#f59e0b', bg: 'rgba(245,158,11,0.08)',   border: 'rgba(245,158,11,0.22)'  },
  EXPENSIVE_RISK: { label: 'Expensive Risk',  color: '#a855f7', bg: 'rgba(168,85,247,0.08)',   border: 'rgba(168,85,247,0.22)'  },
  VISUAL_CHECK:   { label: 'Visual Check',    color: '#22d3ee', bg: 'rgba(34,211,238,0.08)',   border: 'rgba(34,211,238,0.22)'  },
  TEST_DRIVE:     { label: 'Test Drive',      color: '#22c55e', bg: 'rgba(34,197,94,0.08)',    border: 'rgba(34,197,94,0.22)'   },
}

const SEVERITY_DOT: Record<string, string> = {
  high:   '#ef4444',
  medium: '#f59e0b',
  low:    '#6b7280',
}

// ─── Risk level config ────────────────────────────────────────────────────────

const RISK_CONFIG = {
  low:      { label: 'Low Risk',      color: '#22c55e', bg: 'rgba(34,197,94,0.08)',  border: 'rgba(34,197,94,0.2)'  },
  moderate: { label: 'Moderate Risk', color: '#f59e0b', bg: 'rgba(245,158,11,0.08)', border: 'rgba(245,158,11,0.2)' },
  high:     { label: 'High Risk',     color: '#ef4444', bg: 'rgba(239,68,68,0.08)',  border: 'rgba(239,68,68,0.2)'  },
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function Tag({ type }: Readonly<{ type: ResearchTagType }>) {
  const cfg = TAG_CONFIG[type]
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 3,
      fontSize: 10, fontWeight: 700, letterSpacing: '0.04em',
      padding: '3px 8px', borderRadius: 5,
      color: cfg.color, background: cfg.bg, border: `1px solid ${cfg.border}`,
      whiteSpace: 'nowrap',
    }}>
      {cfg.label}
    </span>
  )
}

function IssueCard({ issue }: Readonly<{ issue: ResearchIssue }>) {
  const [expanded, setExpanded] = useState(false)
  const dot = SEVERITY_DOT[issue.severity] ?? SEVERITY_DOT.low

  return (
    <div
      style={{
        padding: '13px 14px',
        background: 'rgba(255,255,255,0.02)',
        border: '1px solid rgba(255,255,255,0.07)',
        borderRadius: 12,
        cursor: 'pointer',
        transition: 'border-color 0.15s',
      }}
      onClick={() => setExpanded(e => !e)}
      role="button"
      tabIndex={0}
      onKeyDown={e => e.key === 'Enter' && setExpanded(v => !v)}
    >
      {/* Issue header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
        {/* Severity dot */}
        <div style={{
          width: 8, height: 8, borderRadius: '50%', background: dot,
          flexShrink: 0, marginTop: 5,
          boxShadow: `0 0 6px ${dot}60`,
        }} />

        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{
            fontSize: 13, fontWeight: 600,
            color: 'rgba(255,255,255,0.9)',
            lineHeight: 1.3, marginBottom: 5,
          }}>
            {issue.title}
          </div>
          {/* Tags */}
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
            {issue.tags.map(tag => <Tag key={tag} type={tag} />)}
          </div>
        </div>

        {/* Expand chevron */}
        <svg
          width="14" height="14" viewBox="0 0 24 24" fill="none"
          stroke="rgba(255,255,255,0.25)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
          style={{
            flexShrink: 0, marginTop: 2,
            transform: expanded ? 'rotate(180deg)' : 'rotate(0deg)',
            transition: 'transform 0.2s',
          }}
        >
          <polyline points="6 9 12 15 18 9"/>
        </svg>
      </div>

      {/* Expanded description */}
      {expanded && (
        <div style={{
          marginTop: 10, paddingTop: 10,
          borderTop: '1px solid rgba(255,255,255,0.06)',
          fontSize: 12, color: 'rgba(255,255,255,0.5)',
          lineHeight: 1.65,
        }}>
          {issue.description}
        </div>
      )}
    </div>
  )
}

function SectionBlock({ section }: Readonly<{ section: ResearchSection }>) {
  const [open, setOpen] = useState(true)

  const SECTION_ICONS: Record<string, React.ReactNode> = {
    commonProblems: (
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
      </svg>
    ),
    highPriorityChecks: (
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>
      </svg>
    ),
    visualAttention: (
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/>
      </svg>
    ),
    mechanicalWatchouts: (
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="3"/><path d="M12 1v4M12 19v4M4.22 4.22l2.83 2.83M16.95 16.95l2.83 2.83M1 12h4M19 12h4M4.22 19.78l2.83-2.83M16.95 7.05l2.83-2.83"/>
      </svg>
    ),
    testDriveFocus: (
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/>
      </svg>
    ),
    costAwareness: (
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/>
      </svg>
    ),
  }

  const icon = SECTION_ICONS[section.id] ?? null

  return (
    <div style={{
      background: 'rgba(255,255,255,0.015)',
      border: '1px solid rgba(255,255,255,0.07)',
      borderRadius: 14,
      overflow: 'hidden',
    }}>
      {/* Section header */}
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        style={{
          width: '100%', padding: '14px 16px',
          display: 'flex', alignItems: 'center', gap: 9,
          background: 'transparent', border: 'none', cursor: 'pointer',
          fontFamily: 'var(--font-sans)',
        }}
      >
        <span style={{ color: '#22d3ee', display: 'flex', alignItems: 'center' }}>{icon}</span>
        <span style={{ flex: 1, textAlign: 'left', fontSize: 13, fontWeight: 700, color: 'rgba(255,255,255,0.85)', letterSpacing: '-0.1px' }}>
          {section.title}
        </span>
        <span style={{
          fontSize: 10, fontWeight: 700, color: 'rgba(255,255,255,0.3)',
          background: 'rgba(255,255,255,0.05)', borderRadius: 4,
          padding: '2px 7px', border: '1px solid rgba(255,255,255,0.07)',
          marginRight: 6,
        }}>
          {section.items.length}
        </span>
        <svg
          width="13" height="13" viewBox="0 0 24 24" fill="none"
          stroke="rgba(255,255,255,0.25)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
          style={{ transform: open ? 'rotate(180deg)' : 'rotate(0deg)', transition: 'transform 0.2s', flexShrink: 0 }}
        >
          <polyline points="6 9 12 15 18 9"/>
        </svg>
      </button>

      {/* Section items */}
      {open && (
        <div style={{ padding: '0 12px 12px', display: 'flex', flexDirection: 'column', gap: 8 }}>
          {section.items.map((issue, idx) => (
            // eslint-disable-next-line react/no-array-index-key
            <IssueCard key={`${section.id}-${idx}`} issue={issue} />
          ))}
        </div>
      )}
    </div>
  )
}

// ─── Loading state ────────────────────────────────────────────────────────────

function ResearchLoadingState({ vehicleName }: Readonly<{ vehicleName: string }>) {
  const steps = [
    'Analysing vehicle generation…',
    'Cross-referencing known issues…',
    'Identifying high-risk areas…',
    'Building inspection guide…',
  ]
  const [step] = useState(() => Math.floor(Math.random() * steps.length))

  return (
    <div style={{
      padding: '28px 20px',
      background: 'rgba(34,211,238,0.03)',
      border: '1px solid rgba(34,211,238,0.12)',
      borderRadius: 16,
      textAlign: 'center',
    }}>
      {/* Animated orb */}
      <div style={{
        width: 56, height: 56, margin: '0 auto 20px',
        position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        {/* Outer ring */}
        <div style={{
          position: 'absolute', inset: 0, borderRadius: '50%',
          border: '1.5px solid rgba(34,211,238,0.15)',
          animation: 'spin 3s linear infinite',
        }} />
        {/* Middle ring */}
        <div style={{
          position: 'absolute', inset: 6, borderRadius: '50%',
          border: '1.5px solid transparent',
          borderTopColor: '#22d3ee',
          animation: 'spin 1.4s linear infinite',
        }} />
        {/* Inner ring */}
        <div style={{
          position: 'absolute', inset: 12, borderRadius: '50%',
          border: '1.5px solid rgba(129,140,248,0.3)',
          borderBottomColor: '#818cf8',
          animation: 'spin 0.9s linear infinite reverse',
        }} />
        {/* Center dot */}
        <div style={{
          width: 10, height: 10, borderRadius: '50%',
          background: 'radial-gradient(circle, #22d3ee, #818cf8)',
          boxShadow: '0 0 12px rgba(34,211,238,0.6)',
        }} />
      </div>

      <div style={{ fontSize: 14, fontWeight: 700, color: '#fff', marginBottom: 6, letterSpacing: '-0.2px' }}>
        Researching {vehicleName}
      </div>
      <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.38)', lineHeight: 1.5 }}>
        {steps[step]}
      </div>

      {/* Progress dots */}
      <div style={{ display: 'flex', justifyContent: 'center', gap: 5, marginTop: 18 }}>
        {[0, 1, 2].map(i => (
          <div
            key={i}
            style={{
              width: 5, height: 5, borderRadius: '50%',
              background: '#22d3ee',
              opacity: 0.3,
              animation: `pulse 1.4s ease-in-out ${i * 0.2}s infinite`,
            }}
          />
        ))}
      </div>
    </div>
  )
}

// ─── CTA card (pre-research) ──────────────────────────────────────────────────

function ResearchCTA({
  vehicleName,
  onStart,
}: Readonly<{ vehicleName: string; onStart: () => void }>) {
  return (
    <div style={{
      padding: '20px 18px',
      background: 'linear-gradient(135deg, rgba(34,211,238,0.04) 0%, rgba(129,140,248,0.04) 100%)',
      border: '1px solid rgba(34,211,238,0.14)',
      borderRadius: 16,
    }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 14, marginBottom: 16 }}>
        <div style={{
          width: 44, height: 44, borderRadius: 13, flexShrink: 0,
          background: 'rgba(34,211,238,0.08)', border: '1px solid rgba(34,211,238,0.18)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#22d3ee" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
            <path d="M11 8v6M8 11h6"/>
          </svg>
        </div>

        <div>
          <div style={{ fontSize: 14, fontWeight: 700, color: '#fff', letterSpacing: '-0.2px', marginBottom: 4 }}>
            AI Model Research
          </div>
          <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.4)', lineHeight: 1.5 }}>
            Before you start, let AI surface known issues and inspection priorities for the <span style={{ color: 'rgba(255,255,255,0.65)', fontWeight: 600 }}>{vehicleName}</span>.
          </div>
        </div>
      </div>

      {/* Feature bullets */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 7, marginBottom: 18 }}>
        {[
          { icon: '⚠️', text: 'Known weaknesses & common failures' },
          { icon: '🔍', text: 'What to physically inspect' },
          { icon: '💸', text: 'Expensive repairs to negotiate on' },
          { icon: '🚗', text: 'Test drive warning signs' },
        ].map(item => (
          <div key={item.text} style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
            <span style={{ fontSize: 13 }}>{item.icon}</span>
            <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.5)' }}>{item.text}</span>
          </div>
        ))}
      </div>

      <button
        type="button"
        onClick={onStart}
        style={{
          width: '100%', padding: '13px 0',
          background: 'rgba(34,211,238,0.1)',
          border: '1px solid rgba(34,211,238,0.28)',
          borderRadius: 12, cursor: 'pointer',
          fontSize: 13, fontWeight: 700, color: '#22d3ee',
          fontFamily: 'var(--font-sans)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7,
          transition: 'background 0.15s',
        }}
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <polygon points="5 3 19 12 5 21 5 3"/>
        </svg>
        Research This Model
      </button>
    </div>
  )
}

// ─── Error state ──────────────────────────────────────────────────────────────

function ResearchError({ message, onRetry }: Readonly<{ message: string; onRetry: () => void }>) {
  return (
    <div style={{
      padding: '18px 16px',
      background: 'rgba(239,68,68,0.04)',
      border: '1px solid rgba(239,68,68,0.14)',
      borderRadius: 14,
      display: 'flex', alignItems: 'flex-start', gap: 12,
    }}>
      <div style={{ flexShrink: 0, color: '#ef4444', marginTop: 1 }}>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
        </svg>
      </div>
      <div style={{ flex: 1 }}>
        <div style={{ fontSize: 12, fontWeight: 600, color: '#f87171', marginBottom: 4 }}>Research unavailable</div>
        <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.35)', marginBottom: 10, lineHeight: 1.5 }}>
          {message}
        </div>
        <button
          type="button" onClick={onRetry}
          style={{
            fontSize: 11, fontWeight: 600, color: '#22d3ee', background: 'transparent',
            border: '1px solid rgba(34,211,238,0.2)', borderRadius: 7,
            padding: '5px 12px', cursor: 'pointer', fontFamily: 'var(--font-sans)',
          }}
        >
          Try again
        </button>
      </div>
    </div>
  )
}

// ─── Full results view ────────────────────────────────────────────────────────

function ResearchResults({
  result,
  onReset,
}: Readonly<{ result: VehicleResearchResult; onReset: () => void }>) {
  const risk = RISK_CONFIG[result.overallRiskLevel] ?? RISK_CONFIG.moderate
  const sectionOrder: (keyof VehicleResearchResult['sections'])[] = [
    'commonProblems',
    'highPriorityChecks',
    'visualAttention',
    'mechanicalWatchouts',
    'testDriveFocus',
    'costAwareness',
  ]

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      {/* Result header */}
      <div style={{
        padding: '14px 16px',
        background: 'rgba(255,255,255,0.02)',
        border: '1px solid rgba(255,255,255,0.07)',
        borderRadius: 14,
        display: 'flex', alignItems: 'flex-start', gap: 12,
      }}>
        <div style={{
          width: 40, height: 40, borderRadius: 11, flexShrink: 0,
          background: 'rgba(34,211,238,0.07)', border: '1px solid rgba(34,211,238,0.15)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#22d3ee" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
          </svg>
        </div>

        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 5 }}>
            <span style={{ fontSize: 13, fontWeight: 700, color: '#fff', letterSpacing: '-0.2px' }}>
              Model Inspection Guide
            </span>
            {/* Risk badge */}
            <span style={{
              fontSize: 10, fontWeight: 700, letterSpacing: '0.04em',
              padding: '2px 8px', borderRadius: 5,
              color: risk.color, background: risk.bg, border: `1px solid ${risk.border}`,
            }}>
              {risk.label}
            </span>
          </div>
          <p style={{ margin: 0, fontSize: 12, color: 'rgba(255,255,255,0.45)', lineHeight: 1.55 }}>
            {result.summary}
          </p>
        </div>
      </div>

      {/* Sections */}
      {sectionOrder.map(key => {
        const section = result.sections[key]
        if (!section?.items?.length) return null
        return <SectionBlock key={key} section={section} />
      })}

      {/* Disclaimer */}
      <div style={{
        padding: '10px 14px',
        background: 'rgba(255,255,255,0.01)',
        border: '1px solid rgba(255,255,255,0.05)',
        borderRadius: 10,
        display: 'flex', alignItems: 'flex-start', gap: 8,
      }}>
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.25)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0, marginTop: 1 }}>
          <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
        </svg>
        <p style={{ margin: 0, fontSize: 11, color: 'rgba(255,255,255,0.28)', lineHeight: 1.5 }}>
          {result.disclaimer}
        </p>
      </div>

      {/* Reset button */}
      <button
        type="button" onClick={onReset}
        style={{
          width: '100%', padding: '10px 0',
          background: 'transparent',
          border: '1px solid rgba(255,255,255,0.07)',
          borderRadius: 10, cursor: 'pointer',
          fontSize: 12, color: 'rgba(255,255,255,0.3)',
          fontFamily: 'var(--font-sans)', fontWeight: 500,
        }}
      >
        Re-research this model
      </button>
    </div>
  )
}

// ─── Main export ──────────────────────────────────────────────────────────────

interface ModelResearchGuideProps {
  make: string
  model: string
  year: number
  engine?: string
  trim?: string
}

export function ModelResearchGuide({
  make, model, year, engine, trim,
}: Readonly<ModelResearchGuideProps>) {
  const vehicleName = `${year} ${make} ${model}`
  const [state, setState] = useState<'idle' | 'loading' | 'success' | 'error'>('idle')
  const [result, setResult] = useState<VehicleResearchResult | null>(null)
  const [errorMsg, setErrorMsg] = useState<string>('')

  const runResearch = useCallback(async () => {
    setState('loading')
    setErrorMsg('')
    try {
      const data = await researchApi.getModelGuide({ make, model, year, engine, trim })
      setResult(data)
      setState('success')
    } catch (err: unknown) {
      setErrorMsg(err instanceof Error ? err.message : 'Could not complete research. Check your connection and try again.')
      setState('error')
    }
  }, [make, model, year, engine, trim])

  const reset = useCallback(() => {
    setState('idle')
    setResult(null)
    setErrorMsg('')
  }, [])

  if (state === 'idle') {
    return <ResearchCTA vehicleName={vehicleName} onStart={runResearch} />
  }

  if (state === 'loading') {
    return <ResearchLoadingState vehicleName={vehicleName} />
  }

  if (state === 'error') {
    return <ResearchError message={errorMsg} onRetry={runResearch} />
  }

  if (state === 'success' && result) {
    return <ResearchResults result={result} onReset={reset} />
  }

  return null
}
