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
  HIGH_ATTENTION: { label: 'High Attention',  color: '#ef4444', bg: 'rgba(239,68,68,0.1)',    border: 'rgba(239,68,68,0.25)'   },
  COMMON_ISSUE:   { label: 'Common Issue',    color: '#f59e0b', bg: 'rgba(245,158,11,0.1)',   border: 'rgba(245,158,11,0.25)'  },
  EXPENSIVE_RISK: { label: 'Expensive Risk',  color: '#a855f7', bg: 'rgba(168,85,247,0.1)',   border: 'rgba(168,85,247,0.25)'  },
  VISUAL_CHECK:   { label: 'Visual Check',    color: '#22d3ee', bg: 'rgba(34,211,238,0.1)',   border: 'rgba(34,211,238,0.25)'  },
  TEST_DRIVE:     { label: 'Test Drive',      color: '#22c55e', bg: 'rgba(34,197,94,0.1)',    border: 'rgba(34,197,94,0.25)'   },
}

const SEVERITY_DOT: Record<string, string> = {
  high:   '#ef4444',
  medium: '#f59e0b',
  low:    '#6b7280',
}

const RISK_CONFIG = {
  low:      { label: 'Low Risk',      color: '#22c55e', bg: 'rgba(34,197,94,0.08)',  border: 'rgba(34,197,94,0.2)'  },
  moderate: { label: 'Moderate Risk', color: '#f59e0b', bg: 'rgba(245,158,11,0.08)', border: 'rgba(245,158,11,0.2)' },
  high:     { label: 'High Risk',     color: '#ef4444', bg: 'rgba(239,68,68,0.08)',  border: 'rgba(239,68,68,0.2)'  },
}

// ─── SVG Icon library (no emojis) ────────────────────────────────────────────

const Icons = {
  warning: (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
      <line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>
    </svg>
  ),
  search: (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
    </svg>
  ),
  cost: (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/>
    </svg>
  ),
  drive: (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M5 17H3a2 2 0 0 1-2-2V9a2 2 0 0 1 2-2h13l4 4v4a2 2 0 0 1-2 2h-2"/>
      <circle cx="7.5" cy="17.5" r="2.5"/><circle cx="17.5" cy="17.5" r="2.5"/>
    </svg>
  ),
  shield: (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
    </svg>
  ),
  info: (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
    </svg>
  ),
  retry: (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M1 4v6h6"/><path d="M3.51 15a9 9 0 1 0 .49-3.51"/>
    </svg>
  ),
  chevronDown: (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.3)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="6 9 12 15 18 9"/>
    </svg>
  ),
  database: (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <ellipse cx="12" cy="5" rx="9" ry="3"/><path d="M21 12c0 1.66-4 3-9 3s-9-1.34-9-3"/>
      <path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5"/>
    </svg>
  ),
}

const SECTION_ICONS: Record<string, React.ReactNode> = {
  commonProblems: (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
      <line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>
    </svg>
  ),
  highPriorityChecks: (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
    </svg>
  ),
  visualAttention: (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/>
    </svg>
  ),
  mechanicalWatchouts: (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"/>
    </svg>
  ),
  testDriveFocus: (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M5 17H3a2 2 0 0 1-2-2V9a2 2 0 0 1 2-2h13l4 4v4a2 2 0 0 1-2 2h-2"/>
      <circle cx="7.5" cy="17.5" r="2.5"/><circle cx="17.5" cy="17.5" r="2.5"/>
    </svg>
  ),
  costAwareness: (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/>
    </svg>
  ),
}

// ─── Tag component ────────────────────────────────────────────────────────────

function Tag({ type }: Readonly<{ type: ResearchTagType }>) {
  const cfg = TAG_CONFIG[type]
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 3,
      fontSize: 9, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase',
      padding: '2px 7px', borderRadius: 4,
      color: cfg.color, background: cfg.bg, border: `1px solid ${cfg.border}`,
      whiteSpace: 'nowrap',
    }}>
      {cfg.label}
    </span>
  )
}

// ─── Issue card ───────────────────────────────────────────────────────────────

function IssueCard({ issue }: Readonly<{ issue: ResearchIssue }>) {
  const [expanded, setExpanded] = useState(false)
  const dot = SEVERITY_DOT[issue.severity] ?? SEVERITY_DOT.low

  return (
    <button
      type="button"
      onClick={() => setExpanded(e => !e)}
      style={{
        width: '100%', textAlign: 'left',
        padding: '12px 14px',
        background: 'rgba(255,255,255,0.025)',
        border: `1px solid ${expanded ? 'rgba(255,255,255,0.1)' : 'rgba(255,255,255,0.06)'}`,
        borderRadius: 11,
        cursor: 'pointer',
        transition: 'border-color 0.15s, background 0.15s',
        fontFamily: 'var(--font-sans)',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
        {/* Severity dot */}
        <div style={{
          width: 7, height: 7, borderRadius: '50%', background: dot,
          flexShrink: 0, marginTop: 6,
          boxShadow: `0 0 6px ${dot}80`,
        }} />

        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{
            fontSize: 13, fontWeight: 600,
            color: 'rgba(255,255,255,0.92)',
            lineHeight: 1.3, marginBottom: 6,
          }}>
            {issue.title}
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
            {issue.tags.map(tag => <Tag key={tag} type={tag} />)}
          </div>
        </div>

        {/* Expand icon */}
        <div style={{
          flexShrink: 0, marginTop: 2,
          transform: expanded ? 'rotate(180deg)' : 'rotate(0deg)',
          transition: 'transform 0.2s',
          color: 'rgba(255,255,255,0.25)',
        }}>
          {Icons.chevronDown}
        </div>
      </div>

      {expanded && (
        <div style={{
          marginTop: 10, paddingTop: 10,
          borderTop: '1px solid rgba(255,255,255,0.07)',
          fontSize: 12.5, color: 'rgba(255,255,255,0.7)',
          lineHeight: 1.7,
        }}>
          {issue.description}
        </div>
      )}
    </button>
  )
}

// ─── Section block ────────────────────────────────────────────────────────────

function SectionBlock({ section }: Readonly<{ section: ResearchSection }>) {
  const [open, setOpen] = useState(true)
  const icon = SECTION_ICONS[section.id] ?? null

  return (
    <div style={{
      background: 'rgba(255,255,255,0.015)',
      border: '1px solid rgba(255,255,255,0.07)',
      borderRadius: 13,
      overflow: 'hidden',
    }}>
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        style={{
          width: '100%', padding: '13px 15px',
          display: 'flex', alignItems: 'center', gap: 9,
          background: 'transparent', border: 'none', cursor: 'pointer',
          fontFamily: 'var(--font-sans)',
        }}
      >
        <span style={{ color: '#22d3ee', display: 'flex', alignItems: 'center', flexShrink: 0 }}>{icon}</span>
        <span style={{ flex: 1, textAlign: 'left', fontSize: 13, fontWeight: 700, color: 'rgba(255,255,255,0.88)', letterSpacing: '-0.1px' }}>
          {section.title}
        </span>
        <span style={{
          fontSize: 10, fontWeight: 700, color: 'rgba(255,255,255,0.35)',
          background: 'rgba(255,255,255,0.05)', borderRadius: 4,
          padding: '2px 7px', border: '1px solid rgba(255,255,255,0.07)',
          marginRight: 6, flexShrink: 0,
        }}>
          {section.items.length}
        </span>
        <div style={{
          transform: open ? 'rotate(180deg)' : 'rotate(0deg)',
          transition: 'transform 0.2s', flexShrink: 0,
        }}>
          {Icons.chevronDown}
        </div>
      </button>

      {open && (
        <div style={{ padding: '0 12px 12px', display: 'flex', flexDirection: 'column', gap: 7 }}>
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
      {/* Animated spinner */}
      <div style={{ width: 52, height: 52, margin: '0 auto 20px', position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ position: 'absolute', inset: 0, borderRadius: '50%', border: '1.5px solid rgba(34,211,238,0.12)', animation: 'spin 3s linear infinite' }} />
        <div style={{ position: 'absolute', inset: 6, borderRadius: '50%', border: '1.5px solid transparent', borderTopColor: '#22d3ee', animation: 'spin 1.4s linear infinite' }} />
        <div style={{ position: 'absolute', inset: 12, borderRadius: '50%', border: '1.5px solid rgba(129,140,248,0.3)', borderBottomColor: '#818cf8', animation: 'spin 0.9s linear infinite reverse' }} />
        <div style={{ width: 10, height: 10, borderRadius: '50%', background: 'radial-gradient(circle, #22d3ee, #818cf8)', boxShadow: '0 0 12px rgba(34,211,238,0.6)' }} />
      </div>

      <div style={{ fontSize: 14, fontWeight: 700, color: '#fff', marginBottom: 5, letterSpacing: '-0.2px' }}>
        Researching {vehicleName}
      </div>
      <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.45)', lineHeight: 1.5 }}>
        {steps[step]}
      </div>

      <div style={{ display: 'flex', justifyContent: 'center', gap: 5, marginTop: 18 }}>
        {[0, 1, 2].map(i => (
          <div key={i} style={{ width: 5, height: 5, borderRadius: '50%', background: '#22d3ee', opacity: 0.4, animation: `pulse 1.4s ease-in-out ${i * 0.2}s infinite` }} />
        ))}
      </div>
    </div>
  )
}

// ─── CTA card (pre-research) ──────────────────────────────────────────────────

const CTA_FEATURES = [
  { icon: Icons.warning, text: 'Known weaknesses & common failures' },
  { icon: Icons.search,  text: 'What to physically inspect on this model' },
  { icon: Icons.cost,    text: 'Expensive repairs to negotiate on' },
  { icon: Icons.drive,   text: 'Test drive warning signs' },
]

function ResearchCTA({ vehicleName, onStart, loading }: Readonly<{ vehicleName: string; onStart: () => void; loading: boolean }>) {
  return (
    <div style={{
      padding: '20px 18px',
      background: 'linear-gradient(135deg, rgba(34,211,238,0.04) 0%, rgba(129,140,248,0.04) 100%)',
      border: '1px solid rgba(34,211,238,0.16)',
      borderRadius: 16,
    }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 14, marginBottom: 16 }}>
        <div style={{
          width: 44, height: 44, borderRadius: 13, flexShrink: 0,
          background: 'rgba(34,211,238,0.08)', border: '1px solid rgba(34,211,238,0.2)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          boxShadow: '0 0 20px rgba(34,211,238,0.1)',
        }}>
          <span style={{ color: '#22d3ee' }}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/><path d="M11 8v6M8 11h6"/>
            </svg>
          </span>
        </div>

        <div>
          <div style={{ fontSize: 14, fontWeight: 700, color: '#fff', letterSpacing: '-0.2px', marginBottom: 4 }}>
            AI Model Research
          </div>
          <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.45)', lineHeight: 1.55 }}>
            Let AI surface known issues and priorities for the{' '}
            <span style={{ color: 'rgba(255,255,255,0.75)', fontWeight: 600 }}>{vehicleName}</span>{' '}
            before you inspect.
          </div>
        </div>
      </div>

      {/* Feature list */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 18 }}>
        {CTA_FEATURES.map(item => (
          <div key={item.text} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ color: '#22d3ee', display: 'flex', alignItems: 'center', flexShrink: 0 }}>{item.icon}</span>
            <span style={{ fontSize: 12.5, color: 'rgba(255,255,255,0.65)', lineHeight: 1.4 }}>{item.text}</span>
          </div>
        ))}
      </div>

      {/* CTA button */}
      <button
        type="button"
        onClick={onStart}
        disabled={loading}
        style={{
          width: '100%', padding: '14px 0',
          background: loading ? 'rgba(34,211,238,0.07)' : 'rgba(34,211,238,0.12)',
          border: '1px solid rgba(34,211,238,0.3)',
          borderRadius: 12, cursor: loading ? 'not-allowed' : 'pointer',
          fontSize: 13, fontWeight: 700, color: '#22d3ee',
          fontFamily: 'var(--font-sans)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
          transition: 'background 0.15s, box-shadow 0.15s',
          boxShadow: loading ? 'none' : '0 0 20px rgba(34,211,238,0.08)',
        }}
      >
        {loading ? (
          <>
            <div style={{ width: 13, height: 13, borderRadius: '50%', border: '2px solid rgba(34,211,238,0.3)', borderTopColor: '#22d3ee', animation: 'spin 0.8s linear infinite' }} />
            Researching…
          </>
        ) : (
          <>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <polygon points="5 3 19 12 5 21 5 3"/>
            </svg>
            Research This Model
          </>
        )}
      </button>
    </div>
  )
}

// ─── Limited mode banner ──────────────────────────────────────────────────────

function LimitedModeBanner() {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 10,
      padding: '10px 14px',
      background: 'rgba(245,158,11,0.06)',
      border: '1px solid rgba(245,158,11,0.18)',
      borderRadius: 10,
    }}>
      <span style={{ color: '#f59e0b', display: 'flex', alignItems: 'center', flexShrink: 0 }}>{Icons.database}</span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: '#f59e0b', marginBottom: 2 }}>
          Live data unavailable
        </div>
        <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.45)', lineHeight: 1.5 }}>
          Showing known issues for this brand from our built-in knowledge base.
        </div>
      </div>
    </div>
  )
}

// ─── Error state ──────────────────────────────────────────────────────────────

function ResearchError({ message, onRetry }: Readonly<{ message: string; onRetry: () => void }>) {
  return (
    <div style={{
      padding: '20px 18px',
      background: 'rgba(239,68,68,0.05)',
      border: '1px solid rgba(239,68,68,0.18)',
      borderRadius: 14,
    }}>
      {/* Icon + headline */}
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 13, marginBottom: 14 }}>
        <div style={{
          width: 38, height: 38, borderRadius: 11, flexShrink: 0,
          background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <span style={{ color: '#ef4444' }}>
            {Icons.warning}
          </span>
        </div>
        <div>
          <div style={{ fontSize: 14, fontWeight: 700, color: '#f87171', marginBottom: 4, letterSpacing: '-0.2px' }}>
            Research unavailable
          </div>
          <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.45)', lineHeight: 1.6 }}>
            {message}
          </div>
        </div>
      </div>

      {/* Retry button */}
      <button
        type="button" onClick={onRetry}
        style={{
          width: '100%', padding: '12px 0',
          fontSize: 13, fontWeight: 700, color: '#22d3ee',
          background: 'rgba(34,211,238,0.06)',
          border: '1px solid rgba(34,211,238,0.22)',
          borderRadius: 10, cursor: 'pointer', fontFamily: 'var(--font-sans)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7,
          transition: 'background 0.15s',
        }}
      >
        {Icons.retry}
        Retry Research
      </button>
    </div>
  )
}

// ─── Confidence badge ────────────────────────────────────────────────────────

function ConfidenceBadge({ confidence }: Readonly<{ confidence: 'high' | 'medium' | 'low' }>) {
  const cfg = {
    high:   { label: 'AI Live',        color: '#22d3ee', bg: 'rgba(34,211,238,0.08)',  border: 'rgba(34,211,238,0.22)'  },
    medium: { label: 'Knowledge Base', color: '#f59e0b', bg: 'rgba(245,158,11,0.08)', border: 'rgba(245,158,11,0.22)' },
    low:    { label: 'Generic Guide',  color: '#6b7280', bg: 'rgba(107,114,128,0.08)', border: 'rgba(107,114,128,0.22)' },
  }[confidence]

  return (
    <span style={{
      fontSize: 9, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase',
      padding: '2px 8px', borderRadius: 4,
      color: cfg.color, background: cfg.bg, border: `1px solid ${cfg.border}`,
    }}>
      {cfg.label}
    </span>
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
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      {/* Limited mode banner */}
      {result.limitedMode && <LimitedModeBanner />}

      {/* Result header card */}
      <div style={{
        padding: '16px 16px',
        background: 'linear-gradient(135deg, rgba(34,211,238,0.04) 0%, rgba(129,140,248,0.03) 100%)',
        border: '1px solid rgba(255,255,255,0.08)',
        borderRadius: 14,
        display: 'flex', alignItems: 'flex-start', gap: 13,
      }}>
        <div style={{
          width: 40, height: 40, borderRadius: 11, flexShrink: 0,
          background: 'rgba(34,211,238,0.07)', border: '1px solid rgba(34,211,238,0.18)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <span style={{ color: '#22d3ee' }}>{Icons.shield}</span>
        </div>

        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 7, flexWrap: 'wrap', marginBottom: 6 }}>
            <span style={{ fontSize: 13, fontWeight: 700, color: '#fff', letterSpacing: '-0.2px' }}>
              Model Inspection Guide
            </span>
            {/* Risk badge */}
            <span style={{
              fontSize: 9, fontWeight: 700, letterSpacing: '0.05em', textTransform: 'uppercase',
              padding: '2px 8px', borderRadius: 4,
              color: risk.color, background: risk.bg, border: `1px solid ${risk.border}`,
            }}>
              {risk.label}
            </span>
            <ConfidenceBadge confidence={result.confidence} />
          </div>
          <p style={{ margin: 0, fontSize: 12.5, color: 'rgba(255,255,255,0.6)', lineHeight: 1.6 }}>
            {result.summary}
          </p>
        </div>
      </div>

      {/* Sections */}
      {sectionOrder.map(key => {
        const s = result.sections[key]
        if (!s?.items?.length) return null
        return <SectionBlock key={key} section={s} />
      })}

      {/* Disclaimer */}
      <div style={{
        padding: '10px 13px',
        background: 'rgba(255,255,255,0.01)',
        border: '1px solid rgba(255,255,255,0.05)',
        borderRadius: 9,
        display: 'flex', alignItems: 'flex-start', gap: 8,
      }}>
        <span style={{ color: 'rgba(255,255,255,0.2)', flexShrink: 0, marginTop: 1 }}>{Icons.info}</span>
        <p style={{ margin: 0, fontSize: 11, color: 'rgba(255,255,255,0.32)', lineHeight: 1.55 }}>
          {result.disclaimer}
        </p>
      </div>

      {/* Reset */}
      <button
        type="button" onClick={onReset}
        style={{
          width: '100%', padding: '11px 0',
          background: 'transparent',
          border: '1px solid rgba(255,255,255,0.07)',
          borderRadius: 10, cursor: 'pointer',
          fontSize: 12, color: 'rgba(255,255,255,0.32)',
          fontFamily: 'var(--font-sans)', fontWeight: 500,
          transition: 'border-color 0.15s',
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

export function ModelResearchGuide({ make, model, year, engine, trim }: Readonly<ModelResearchGuideProps>) {
  const vehicleName = `${year} ${make} ${model}`
  const [state,    setState]    = useState<'idle' | 'loading' | 'success' | 'error'>('idle')
  const [result,   setResult]   = useState<VehicleResearchResult | null>(null)
  const [errorMsg, setErrorMsg] = useState<string>('')

  const runResearch = useCallback(async () => {
    setState('loading')
    setErrorMsg('')
    try {
      const data = await researchApi.getModelGuide({ make, model, year, engine, trim })
      setResult(data)
      setState('success')
    } catch (err: unknown) {
      setErrorMsg(
        err instanceof Error
          ? err.message
          : 'Could not connect to research service. Check your connection and try again.'
      )
      setState('error')
    }
  }, [make, model, year, engine, trim])

  const reset = useCallback(() => {
    setState('idle')
    setResult(null)
    setErrorMsg('')
  }, [])

  if (state === 'idle') {
    return <ResearchCTA vehicleName={vehicleName} onStart={runResearch} loading={false} />
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
