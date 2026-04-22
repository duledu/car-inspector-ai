'use client'

// =============================================================================
// ModelResearchGuide — AI-powered pre-inspection known-issues guide
// Researches the vehicle model and surfaces known weaknesses, watchouts,
// and inspection priorities before the user starts their walkthrough.
// =============================================================================

import { useState, useCallback, useEffect, useMemo, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import type { VehicleResearchResult, ResearchSection, ResearchIssue, ResearchTagType, PriceContext } from '@/types'
import { researchApi } from '@/services/api/research.api'

// ─── Tag config ───────────────────────────────────────────────────────────────

const TAG_CONFIG: Record<ResearchTagType, { labelKey: string; color: string; bg: string; border: string }> = {
  HIGH_ATTENTION: { labelKey: 'research.tagHighAttention', color: '#ef4444', bg: 'rgba(239,68,68,0.1)',    border: 'rgba(239,68,68,0.25)'   },
  COMMON_ISSUE:   { labelKey: 'research.tagCommonIssue',   color: '#f59e0b', bg: 'rgba(245,158,11,0.1)',   border: 'rgba(245,158,11,0.25)'  },
  EXPENSIVE_RISK: { labelKey: 'research.tagExpensiveRisk', color: '#a855f7', bg: 'rgba(168,85,247,0.1)',   border: 'rgba(168,85,247,0.25)'  },
  VISUAL_CHECK:   { labelKey: 'research.tagVisualCheck',   color: '#22d3ee', bg: 'rgba(34,211,238,0.1)',   border: 'rgba(34,211,238,0.25)'  },
  TEST_DRIVE:     { labelKey: 'research.tagTestDrive',     color: '#22c55e', bg: 'rgba(34,197,94,0.1)',    border: 'rgba(34,197,94,0.25)'   },
}

const SEVERITY_DOT: Record<string, string> = {
  high:   '#ef4444',
  medium: '#f59e0b',
  low:    '#6b7280',
}

const RISK_CONFIG = {
  low:      { labelKey: 'research.riskLow',      color: '#22c55e', bg: 'rgba(34,197,94,0.08)',  border: 'rgba(34,197,94,0.2)'  },
  moderate: { labelKey: 'research.riskModerate', color: '#f59e0b', bg: 'rgba(245,158,11,0.08)', border: 'rgba(245,158,11,0.2)' },
  high:     { labelKey: 'research.riskHigh',     color: '#ef4444', bg: 'rgba(239,68,68,0.08)',  border: 'rgba(239,68,68,0.2)'  },
}

// ─── SVG Icon library (no emojis) ────────────────────────────────────────────

const ISSUE_TITLE_KEYS: Record<string, string> = {
  'Engine Oil Consumption':                 'research.issue.engineOilConsumption',
  'Automatic Transmission Wear':            'research.issue.automaticTransmissionWear',
  'Rust on Structural Areas':               'research.issue.rustStructuralAreas',
  'Service History, Verify Every Entry':    'research.issue.serviceHistoryVerify',
  'OBD Diagnostic Scan':                    'research.issue.obdDiagnosticScan',
  'Independent Pre-Purchase Inspection':    'research.issue.independentPrePurchaseInspection',
  'Paint Thickness & Panel Colour Match':   'research.issue.paintThicknessPanelMatch',
  'Underneath, Fluid Leaks & Rust':         'research.issue.underneathFluidLeaksRust',
  'Tyre Condition & Wear Pattern':          'research.issue.tyreConditionWearPattern',
  'Timing Belt / Chain Service':            'research.issue.timingBeltChainService',
  'Cooling System Condition':               'research.issue.coolingSystemCondition',
  'Clutch Feel (manual gearbox)':           'research.issue.clutchFeelManual',
  'Cold Start Behaviour':                   'research.issue.coldStartBehaviour',
  'Emergency Braking Test':                 'research.issue.emergencyBrakingTest',
  'Acceleration & Gear Changes':            'research.issue.accelerationGearChanges',
  'Timing Belt Replacement':                'research.issue.timingBeltReplacement',
  'Full Service at Purchase':               'research.issue.fullServiceAtPurchase',
  'Pre-Purchase Inspection':                'research.issue.prePurchaseInspection',
}

function translatedIssueTitle(
  t: ReturnType<typeof useTranslation>['t'],
  i18n: ReturnType<typeof useTranslation>['i18n'],
  title: string,
): string {
  const key = ISSUE_TITLE_KEYS[title]
  const lang = i18n.resolvedLanguage ?? i18n.language
  return key && i18n.exists(key, { lng: lang }) ? t(key) : title
}

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
  const { t } = useTranslation()
  const cfg = TAG_CONFIG[type]
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 3,
      fontSize: 9, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase',
      padding: '2px 7px', borderRadius: 4,
      color: cfg.color, background: cfg.bg, border: `1px solid ${cfg.border}`,
      whiteSpace: 'nowrap',
    }}>
      {t(cfg.labelKey)}
    </span>
  )
}

// ─── Issue card ───────────────────────────────────────────────────────────────

function IssueCard({ issue }: Readonly<{ issue: ResearchIssue }>) {
  const { i18n, t } = useTranslation()
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
            {translatedIssueTitle(t, i18n, issue.title)}
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
  const { i18n, t } = useTranslation()
  const [open, setOpen] = useState(true)
  const icon = SECTION_ICONS[section.id] ?? null
  const sectionTitleKey = `research.section.${section.id}`
  const lang = i18n.resolvedLanguage ?? i18n.language
  const sectionTitle = i18n.exists(sectionTitleKey, { lng: lang })
    ? t(sectionTitleKey)
    : section.title

  return (
    <div style={{
      background: 'rgba(255,255,255,0.018)',
      border: '1px solid rgba(255,255,255,0.07)',
      borderRadius: 14,
      overflow: 'hidden',
      boxShadow: '0 1px 2px rgba(0,0,0,0.2), inset 0 1px 0 rgba(255,255,255,0.04)',
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
          {sectionTitle}
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
  const { t } = useTranslation()
  const steps = [
    t('research.loadingStep1'),
    t('research.loadingStep2'),
    t('research.loadingStep3'),
    t('research.loadingStep4'),
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
        {t('research.researchingVehicle', { vehicleName })}
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

function ResearchCTA({ vehicleName, onStart, loading }: Readonly<{ vehicleName: string; onStart: () => void; loading: boolean }>) {
  const { t } = useTranslation()
  const ctaFeatures = [
    { icon: Icons.warning, text: t('research.ctaFeature1') },
    { icon: Icons.search,  text: t('research.ctaFeature2') },
    { icon: Icons.cost,    text: t('research.ctaFeature3') },
    { icon: Icons.drive,   text: t('research.ctaFeature4') },
  ]
  return (
    <div
      className="research-cta-card"
      style={{
        padding: '20px 18px',
        background: 'linear-gradient(135deg, rgba(34,211,238,0.06) 0%, rgba(34,211,238,0.02) 55%, rgba(129,140,248,0.03) 100%)',
        border: '1px solid rgba(34,211,238,0.18)',
        borderRadius: 18,
        boxShadow: '0 1px 3px rgba(0,0,0,0.3), inset 0 1px 0 rgba(255,255,255,0.04)',
      }}
    >
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
            {t('research.ctaTitle')}
          </div>
          <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.45)', lineHeight: 1.55 }}>
            {t('research.ctaDesc', { vehicleName })}
          </div>
        </div>
      </div>

      {/* Feature list */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 18 }}>
        {ctaFeatures.map(item => (
          <div key={item.text} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ color: '#22d3ee', display: 'flex', alignItems: 'center', flexShrink: 0 }}>{item.icon}</span>
            <span style={{ fontSize: 12.5, color: 'rgba(255,255,255,0.65)', lineHeight: 1.4 }}>{item.text}</span>
          </div>
        ))}
      </div>

      {/* CTA button — solid gradient primary action */}
      <button
        type="button"
        onClick={onStart}
        disabled={loading}
        style={{
          width: '100%', padding: '14px 0',
          background: loading
            ? 'rgba(34,211,238,0.06)'
            : 'linear-gradient(135deg, #22d3ee 0%, #06b6d4 100%)',
          border: loading ? '1px solid rgba(34,211,238,0.2)' : 'none',
          borderRadius: 13, cursor: loading ? 'not-allowed' : 'pointer',
          fontSize: 13.5, fontWeight: 800,
          color: loading ? 'rgba(34,211,238,0.6)' : '#050810',
          fontFamily: 'var(--font-sans)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
          transition: 'box-shadow 0.2s ease, transform 0.1s ease',
          boxShadow: loading ? 'none' : '0 4px 20px rgba(34,211,238,0.32), inset 0 1px 0 rgba(255,255,255,0.22)',
          letterSpacing: loading ? '0' : '-0.1px',
        }}
      >
        {loading ? (
          <>
            <div style={{ width: 13, height: 13, borderRadius: '50%', border: '2px solid rgba(34,211,238,0.3)', borderTopColor: '#22d3ee', animation: 'spin 0.8s linear infinite' }} />
            {t('research.researching')}
          </>
        ) : (
          <>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <polygon points="5 3 19 12 5 21 5 3"/>
            </svg>
            {t('research.researchThisModel')}
          </>
        )}
      </button>
    </div>
  )
}

// ─── Limited mode banner ──────────────────────────────────────────────────────

function LimitedModeBanner() {
  const { t } = useTranslation()
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
          {t('research.limitedModeTitle')}
        </div>
        <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.45)', lineHeight: 1.5 }}>
          {t('research.limitedModeDesc')}
        </div>
      </div>
    </div>
  )
}

// ─── Error state ──────────────────────────────────────────────────────────────

function ResearchError({ message, onRetry }: Readonly<{ message: string; onRetry: () => void }>) {
  const { t } = useTranslation()
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
            {t('research.errorTitle')}
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
        {t('research.retryResearch')}
      </button>
    </div>
  )
}

// ─── Confidence badge ────────────────────────────────────────────────────────

function ConfidenceBadge({ confidence }: Readonly<{ confidence: 'high' | 'medium' | 'low' }>) {
  const { t } = useTranslation()
  const cfg = {
    high:   { labelKey: 'research.confidenceAiLive',        color: '#22d3ee', bg: 'rgba(34,211,238,0.08)',   border: 'rgba(34,211,238,0.22)'  },
    medium: { labelKey: 'research.confidenceKnowledgeBase', color: '#f59e0b', bg: 'rgba(245,158,11,0.08)',  border: 'rgba(245,158,11,0.22)'  },
    low:    { labelKey: 'research.confidenceGenericGuide',  color: '#94a3b8', bg: 'rgba(148,163,184,0.1)', border: 'rgba(148,163,184,0.24)' },
  }[confidence]

  return (
    <span style={{
      fontSize: 9, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase',
      padding: '2px 8px', borderRadius: 4,
      color: cfg.color, background: cfg.bg, border: `1px solid ${cfg.border}`,
    }}>
      {t(cfg.labelKey)}
    </span>
  )
}

// ─── Price context card ───────────────────────────────────────────────────────

const EVAL_CFG = {
  low:  { labelKey: 'research.evalBelowMarket', color: '#22c55e', bg: 'rgba(34,197,94,0.06)',   border: 'rgba(34,197,94,0.18)',   barColor: '#22c55e' },
  fair: { labelKey: 'research.evalFairMarket',  color: '#22d3ee', bg: 'rgba(34,211,238,0.06)', border: 'rgba(34,211,238,0.18)', barColor: '#22d3ee' },
  high: { labelKey: 'research.evalAboveMarket', color: '#f59e0b', bg: 'rgba(245,158,11,0.06)', border: 'rgba(245,158,11,0.18)', barColor: '#f59e0b' },
}

const CONFIDENCE_CFG = {
  high:   { labelKey: 'research.confidenceHigh',   color: '#22c55e', bg: 'rgba(34,197,94,0.08)',   border: 'rgba(34,197,94,0.2)'   },
  medium: { labelKey: 'research.confidenceMedium', color: '#f59e0b', bg: 'rgba(245,158,11,0.08)', border: 'rgba(245,158,11,0.2)' },
  low:    { labelKey: 'research.confidenceLow',    color: '#94a3b8', bg: 'rgba(148,163,184,0.1)', border: 'rgba(148,163,184,0.24)' },
}

function PriceContextCard({ pc }: Readonly<{ pc: PriceContext }>) {
  const { t } = useTranslation()
  const cfg  = EVAL_CFG[pc.evaluation] ?? EVAL_CFG.fair
  const ccfg = CONFIDENCE_CFG[pc.confidence ?? 'medium']
  const fmt  = (n: number) => `€${n.toLocaleString('de-DE')}`
  const curr = pc.currency ?? 'EUR'

  // Position of asking price on the range bar (0–100%)
  const rangeSpan = pc.marketRangeTo - pc.marketRangeFrom
  const askingPct = pc.askingPrice != null && rangeSpan > 0
    ? Math.max(4, Math.min(96, ((pc.askingPrice - pc.marketRangeFrom) / rangeSpan) * 100))
    : null
  const avgPct = pc.avgPrice != null && rangeSpan > 0
    ? Math.max(2, Math.min(98, ((pc.avgPrice - pc.marketRangeFrom) / rangeSpan) * 100))
    : 50

  return (
    <div style={{
      borderRadius: 16,
      border: `1px solid ${cfg.border}`,
      background: cfg.bg,
      overflow: 'hidden',
    }}>
      {/* Header */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 9,
        padding: '11px 14px 10px',
        borderBottom: `1px solid ${cfg.border}`,
      }}>
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke={cfg.color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/>
        </svg>
        <span style={{ fontSize: 12, fontWeight: 700, color: cfg.color, letterSpacing: '-0.1px', flex: 1 }}>
          {t('research.marketPriceHeader')}
        </span>
        {/* Confidence badge */}
        <span style={{
          fontSize: 9, fontWeight: 700, letterSpacing: '0.05em', textTransform: 'uppercase',
          padding: '2px 7px', borderRadius: 4,
          color: ccfg.color, background: ccfg.bg, border: `1px solid ${ccfg.border}`,
        }}>
          {t(ccfg.labelKey)}
        </span>
      </div>

      {/* Numbers row */}
      <div style={{ display: 'grid', gridTemplateColumns: pc.askingPrice != null ? '1fr 1fr 1fr' : '1fr 1fr', gap: 0 }}>
        {/* Range */}
        <div style={{ padding: '12px 14px', borderRight: `1px solid ${cfg.border}` }}>
          <div style={{ fontSize: 10, fontWeight: 600, color: 'rgba(255,255,255,0.38)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 5 }}>
            {t('research.priceRange')}
          </div>
          <div style={{ fontSize: 13, fontWeight: 800, color: '#fff', letterSpacing: '-0.3px', lineHeight: 1.1 }}>
            {fmt(pc.marketRangeFrom)}
          </div>
          <div style={{ fontSize: 11, fontWeight: 600, color: 'rgba(255,255,255,0.35)', margin: '2px 0' }}>{t('research.priceTo')}</div>
          <div style={{ fontSize: 13, fontWeight: 800, color: '#fff', letterSpacing: '-0.3px', lineHeight: 1.1 }}>
            {fmt(pc.marketRangeTo)}
          </div>
          <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.28)', marginTop: 3 }}>{curr}</div>
        </div>

        {/* Average */}
        {pc.avgPrice != null && (
          <div style={{ padding: '12px 14px', borderRight: pc.askingPrice != null ? `1px solid ${cfg.border}` : undefined }}>
            <div style={{ fontSize: 10, fontWeight: 600, color: 'rgba(255,255,255,0.38)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 5 }}>
              {t('research.priceAvg')}
            </div>
            <div style={{ fontSize: 16, fontWeight: 900, color: cfg.color, letterSpacing: '-0.5px', lineHeight: 1 }}>
              {fmt(pc.avgPrice)}
            </div>
            <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.28)', marginTop: 5 }}>{curr}</div>
          </div>
        )}

        {/* Asking price */}
        {pc.askingPrice != null && (
          <div style={{ padding: '12px 14px' }}>
            <div style={{ fontSize: 10, fontWeight: 600, color: 'rgba(255,255,255,0.38)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 5 }}>
              {t('research.priceAsking')}
            </div>
            <div style={{ fontSize: 16, fontWeight: 900, color: '#fff', letterSpacing: '-0.5px', lineHeight: 1 }}>
              {fmt(pc.askingPrice)}
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginTop: 5 }}>
              <div style={{ width: 6, height: 6, borderRadius: '50%', background: cfg.color, boxShadow: `0 0 5px ${cfg.color}80`, flexShrink: 0 }} />
              <span style={{ fontSize: 10, fontWeight: 700, color: cfg.color }}>{t(cfg.labelKey)}</span>
            </div>
          </div>
        )}
      </div>

      {/* Visual range bar */}
      <div style={{ padding: '10px 14px 12px', borderTop: `1px solid ${cfg.border}` }}>
        <div style={{ fontSize: 10, fontWeight: 600, color: 'rgba(255,255,255,0.3)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 8 }}>
          {t('research.pricePosition')}
        </div>
        <div style={{ position: 'relative', height: 6, borderRadius: 6, background: 'rgba(255,255,255,0.07)', overflow: 'visible' }}>
          {/* Gradient track */}
          <div style={{
            position: 'absolute', inset: 0, borderRadius: 6,
            background: `linear-gradient(90deg, rgba(34,197,94,0.5) 0%, rgba(34,211,238,0.5) 50%, rgba(245,158,11,0.5) 100%)`,
          }} />
          {/* Avg marker */}
          <div style={{
            position: 'absolute', top: '50%', left: `${avgPct}%`,
            transform: 'translate(-50%, -50%)',
            width: 2, height: 10, borderRadius: 2,
            background: 'rgba(255,255,255,0.4)',
          }} />
          {/* Asking price marker */}
          {askingPct != null && (
            <div style={{
              position: 'absolute', top: '50%', left: `${askingPct}%`,
              transform: 'translate(-50%, -50%)',
              width: 12, height: 12, borderRadius: '50%',
              background: cfg.barColor,
              border: '2px solid #080c14',
              boxShadow: `0 0 8px ${cfg.barColor}90`,
              zIndex: 1,
            }} />
          )}
        </div>
        {/* Labels */}
        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 6 }}>
          <span style={{ fontSize: 9.5, color: 'rgba(255,255,255,0.28)', fontWeight: 500 }}>{fmt(pc.marketRangeFrom)}</span>
          {pc.avgPrice != null && (
            <span style={{ fontSize: 9.5, color: 'rgba(255,255,255,0.28)', fontWeight: 500 }}>{t('research.priceAvgShort')} {fmt(pc.avgPrice)}</span>
          )}
          <span style={{ fontSize: 9.5, color: 'rgba(255,255,255,0.28)', fontWeight: 500 }}>{fmt(pc.marketRangeTo)}</span>
        </div>
      </div>

      {/* Summary */}
      <div style={{
        padding: '9px 14px 12px',
        fontSize: 11.5, color: 'rgba(255,255,255,0.58)', lineHeight: 1.6,
      }}>
        {pc.summary}

        {/* Listing count + filter attribution */}
        {pc.listingCount != null && pc.listingCount > 0 && (() => {
          const filters = pc.filtersMatched
          const filterParts = filters
            ? [filters.fuelType, filters.transmission, filters.bodyType].filter(Boolean)
            : []
          const filterLabel = filterParts.length > 0 ? filterParts.join(', ') : null
          const relaxedSuffix = pc.filtersRelaxed ? ` (${t('research.filtersPartiallyMatched')})` : ''
          const listingText = filterLabel
            ? `${t('research.basedOnListings', { count: pc.listingCount, filters: filterLabel })}${relaxedSuffix}`
            : `${t('research.basedOnBroaderMarket')}${relaxedSuffix}`
          return (
            <span style={{
              display: 'block', marginTop: 6,
              fontSize: 10, fontWeight: 600,
              color: pc.filtersRelaxed ? 'rgba(245,158,11,0.7)' : 'rgba(34,211,238,0.65)',
              fontStyle: 'italic',
            }}>
              {listingText}
            </span>
          )
        })()}

        {pc.source && (
          <span style={{ display: 'block', marginTop: 4, fontSize: 10, color: 'rgba(255,255,255,0.28)', fontStyle: 'italic' }}>
            {t('research.source')} {pc.source}
          </span>
        )}
      </div>
    </div>
  )
}

// ─── Full results view ────────────────────────────────────────────────────────

function ResearchResults({
  result,
  onReset,
}: Readonly<{ result: VehicleResearchResult; onReset: () => void }>) {
  const { t } = useTranslation()
  const risk = RISK_CONFIG[result.overallRiskLevel] ?? RISK_CONFIG.moderate
  const sectionOrder: (keyof VehicleResearchResult['sections'])[] = [
    'commonProblems',
  ]

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      {/* Limited mode banner */}
      {result.limitedMode && result.dataSource === 'generic_fallback' && <LimitedModeBanner />}

      {/* Result header card */}
      <div style={{
        padding: '16px 16px',
        background: 'linear-gradient(135deg, rgba(34,211,238,0.06) 0%, rgba(34,211,238,0.02) 55%, rgba(129,140,248,0.03) 100%)',
        border: '1px solid rgba(34,211,238,0.15)',
        borderRadius: 16,
        display: 'flex', alignItems: 'flex-start', gap: 13,
        boxShadow: '0 1px 3px rgba(0,0,0,0.3), inset 0 1px 0 rgba(255,255,255,0.05)',
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
              {t('research.modelInspectionGuide')}
            </span>
            {/* Risk badge */}
            <span style={{
              fontSize: 9, fontWeight: 700, letterSpacing: '0.05em', textTransform: 'uppercase',
              padding: '2px 8px', borderRadius: 4,
              color: risk.color, background: risk.bg, border: `1px solid ${risk.border}`,
            }}>
              {t(risk.labelKey)}
            </span>
            <ConfidenceBadge confidence={result.confidence} />
          </div>
          <p style={{ margin: 0, fontSize: 12.5, color: 'rgba(255,255,255,0.6)', lineHeight: 1.6 }}>
            {result.summary}
          </p>
        </div>
      </div>

      {/* Price context card — always shown when present */}
      {result.priceContext && <PriceContextCard pc={result.priceContext} />}

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
        <span style={{ color: 'rgba(255,255,255,0.45)', flexShrink: 0, marginTop: 1 }}>{Icons.info}</span>
        <p style={{ margin: 0, fontSize: 11, color: 'rgba(255,255,255,0.58)', lineHeight: 1.55 }}>
          {t('inspection.prepReportDisclaimer', { defaultValue: result.disclaimer })}
        </p>
      </div>

      {/* Reset */}
      <button
        type="button" onClick={onReset}
        style={{
          width: '100%', padding: '11px 0',
          background: 'transparent',
          border: '1px solid rgba(255,255,255,0.12)',
          borderRadius: 10, cursor: 'pointer',
          fontSize: 12, color: 'rgba(255,255,255,0.68)',
          fontFamily: 'var(--font-sans)', fontWeight: 500,
          transition: 'border-color 0.15s',
        }}
      >
        {t('research.reresearch')}
      </button>
    </div>
  )
}

// ─── Main export ──────────────────────────────────────────────────────────────

interface ModelResearchGuideProps {
  make: string
  model: string
  year: number
  engineCc?: number | null
  powerKw?: number | null
  engine?: string
  trim?: string
  askingPrice?: number | null
  currency?: string | null
  fuelType?: string | null
  transmission?: string | null
  drivetrain?: string | null
  bodyType?: string | null
  mileage?: number | null
}

export function ModelResearchGuide({
  make, model, year, engineCc, powerKw, engine, trim,
  askingPrice, currency, fuelType, transmission, drivetrain, bodyType, mileage,
}: Readonly<ModelResearchGuideProps>) {
  const { i18n, t } = useTranslation()
  // Build a human-readable vehicle identity for display (e.g. "2013 BMW 530 2.0L 135kW")
  const litreStr  = engineCc ? ` ${(engineCc / 1000).toFixed(1)}L` : ''
  const kwStr     = powerKw  ? ` ${powerKw}kW`                     : ''
  const vehicleName = `${year} ${make} ${model}${litreStr}${kwStr}`

  const [state,    setState]    = useState<'idle' | 'loading' | 'success' | 'error'>('idle')
  const [result,   setResult]   = useState<VehicleResearchResult | null>(null)
  const [errorMsg, setErrorMsg] = useState<string>('')
  const latestIdentityRef = useRef('')
  const vehicleIdentityKey = useMemo(() => JSON.stringify({
    make, model, year, engineCc, powerKw, engine, trim,
    askingPrice, currency, fuelType, transmission, drivetrain, bodyType, mileage,
    locale: (i18n.resolvedLanguage ?? i18n.language ?? 'en').split('-')[0],
  }), [
    make, model, year, engineCc, powerKw, engine, trim,
    askingPrice, currency, fuelType, transmission, drivetrain, bodyType, mileage,
    i18n.resolvedLanguage, i18n.language,
  ])
  latestIdentityRef.current = vehicleIdentityKey

  useEffect(() => {
    setState('idle')
    setResult(null)
    setErrorMsg('')
  }, [vehicleIdentityKey])

  const runResearch = useCallback(async () => {
    const requestIdentityKey = vehicleIdentityKey
    setState('loading')
    setErrorMsg('')
    try {
      const data = await researchApi.getModelGuide({
        make, model, year,
        engineCc:     engineCc     ?? undefined,
        powerKw:      powerKw      ?? undefined,
        askingPrice:  askingPrice  ?? undefined,
        currency:     currency     ?? undefined,
        fuelType:     fuelType     ?? undefined,
        transmission: transmission ?? undefined,
        drivetrain:   drivetrain   ?? undefined,
        bodyType:     bodyType     ?? undefined,
        mileage:      mileage      ?? undefined,
        locale:       (i18n.resolvedLanguage ?? i18n.language ?? 'en').split('-')[0],
        engine, trim,
      })
      if (latestIdentityRef.current !== requestIdentityKey) return
      setResult(data)
      setState('success')
    } catch (err: unknown) {
      if (latestIdentityRef.current !== requestIdentityKey) return
      const msg = (err as { message?: string })?.message
        ?? t('research.errorConnection')
      setErrorMsg(msg)
      setState('error')
    }
  }, [make, model, year, engineCc, powerKw, askingPrice, currency, fuelType, transmission, drivetrain, bodyType, mileage, i18n.resolvedLanguage, i18n.language, engine, trim, t, vehicleIdentityKey])

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
