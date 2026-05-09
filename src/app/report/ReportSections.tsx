'use client'

type Translate = (key: string, options?: Record<string, unknown>) => string

function safeT(t: Translate, key: string, fallback: string, options?: Record<string, unknown>): string {
  const resolved = t(key, options)
  if (resolved && resolved !== key) return resolved
  if (!options) return fallback
  return Object.entries(options).reduce(
    (text, [name, value]) => text.replaceAll(`{{${name}}}`, String(value)),
    fallback,
  )
}

interface DecisionBlockProps {
  verdict: string
  riskFlagCount: number
  criticalFindingCount: number
  verdictColor: string
  verdictBg: string
  verdictBorder: string
  t: Translate
}

function buildDecisionContent(
  verdict: string,
  criticalCount: number,
  riskFlagCount: number,
  t: Translate,
): { headline: string; body: string } | null {
  const total = criticalCount + riskFlagCount
  switch (verdict) {
    case 'STRONG_BUY':
      return {
        headline: safeT(t, 'report.decision.headline.strongBuy', 'Proceed with confidence'),
        body: safeT(t, 'report.decision.body.strongBuy', 'No significant issues detected. The vehicle appears suitable for purchase with a standard inspection.'),
      }
    case 'BUY_WITH_CAUTION':
      return {
        headline: safeT(t, 'report.decision.headline.caution', 'Proceed with caution'),
        body: total > 0
          ? safeT(t, 'report.decision.body.cautionIssues', '{{count}} finding(s) need attention. Clarify these with the seller before finalising.', { count: total })
          : safeT(t, 'report.decision.body.caution', 'Some minor risks detected. Review the flagged items with the seller before agreeing on a price.'),
      }
    case 'HIGH_RISK':
      return {
        headline: safeT(t, 'report.decision.headline.highRisk', 'High risk — do not buy without inspection'),
        body: safeT(t, 'report.decision.body.highRisk', 'Serious issues detected. Request a professional inspection before making any decision.'),
      }
    case 'WALK_AWAY':
      return {
        headline: safeT(t, 'report.decision.headline.walkAway', 'Purchase not recommended'),
        body: safeT(t, 'report.decision.body.walkAway', 'Multiple critical issues found. The risk outweighs the value at the asking price.'),
      }
    default:
      return null
  }
}

function DecisionIcon({ verdict, color }: Readonly<{ verdict: string; color: string }>) {
  if (verdict === 'STRONG_BUY') {
    return (
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
        <polyline points="20 6 9 17 4 12"/>
      </svg>
    )
  }
  if (verdict === 'WALK_AWAY') {
    return (
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
        <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
      </svg>
    )
  }
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
      <line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>
    </svg>
  )
}

export function DecisionBlock({
  verdict,
  riskFlagCount,
  criticalFindingCount,
  verdictColor,
  verdictBg,
  verdictBorder,
  t,
}: Readonly<DecisionBlockProps>) {
  const content = buildDecisionContent(verdict, criticalFindingCount, riskFlagCount, t)
  if (!content) return null

  return (
    <div style={{
      padding: '22px 24px',
      background: verdictBg,
      border: `1px solid ${verdictBorder}`,
      borderRadius: 16,
    }}>
      {/* Label row */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14,
      }}>
        <div style={{
          width: 26, height: 26, borderRadius: 7,
          background: `${verdictColor}18`, border: `1px solid ${verdictColor}30`,
          display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
        }}>
          <DecisionIcon verdict={verdict} color={verdictColor} />
        </div>
        <span style={{
          fontSize: 9.5, fontWeight: 700, color: 'rgba(255,255,255,0.35)',
          textTransform: 'uppercase', letterSpacing: '0.1em',
        }}>
          {safeT(t, 'report.finalRecommendation', 'Final recommendation')}
        </span>
      </div>

      {/* Headline */}
      <div style={{
        fontSize: 18, fontWeight: 800, color: verdictColor,
        marginBottom: 10, letterSpacing: '-0.4px', lineHeight: 1.2,
      }}>
        {content.headline}
      </div>

      {/* Body */}
      <div style={{ fontSize: 14, color: 'rgba(255,255,255,0.72)', lineHeight: 1.65 }}>
        {content.body}
      </div>
    </div>
  )
}

interface ConfidenceIndicatorProps {
  photoCount: number
  hasAIResults: boolean
  checklistComplete: boolean
  hasAnyChecklistData: boolean
  t: Translate
}

type ConfLevel = 'high' | 'medium' | 'low'

function computeConfidence(
  photoCount: number,
  hasAI: boolean,
  checklistComplete: boolean,
  hasAnyChecklist: boolean,
): ConfLevel {
  const photoScore = Math.min(photoCount / 6, 1)
  const checkScore = checklistComplete ? 1 : hasAnyChecklist ? 0.5 : 0
  const aiScore = hasAI ? 1 : 0
  const total = photoScore * 0.40 + checkScore * 0.35 + aiScore * 0.25
  const raw: ConfLevel = total >= 0.70 ? 'high' : total >= 0.38 ? 'medium' : 'low'
  // AI photo analysis is the report's core signal. Without it, confidence
  // cannot be 'high' regardless of how much checklist data is present —
  // that would overclaim the report's reliability and mislead users.
  if (!hasAI && raw === 'high') return 'medium'
  return raw
}

const CONF_STYLE: Record<ConfLevel, { color: string; bg: string; border: string; bars: number }> = {
  high:   { color: '#22c55e', bg: 'rgba(34,197,94,0.07)',  border: 'rgba(34,197,94,0.18)',  bars: 3 },
  medium: { color: '#f59e0b', bg: 'rgba(245,158,11,0.07)', border: 'rgba(245,158,11,0.18)', bars: 2 },
  low:    { color: '#ef4444', bg: 'rgba(239,68,68,0.07)',  border: 'rgba(239,68,68,0.18)',  bars: 1 },
}

const CONF_TEXT_KEY: Record<ConfLevel, string> = {
  high:   'report.confidence.high',
  medium: 'report.confidence.medium',
  low:    'report.confidence.low',
}

const CONF_TEXT_FALLBACK: Record<ConfLevel, string> = {
  high:   'High — sufficient data for a reliable assessment',
  medium: 'Medium — partial data, result is indicative',
  low:    'Low — limited data, interpret results carefully',
}

export function ConfidenceIndicator({
  photoCount,
  hasAIResults,
  checklistComplete,
  hasAnyChecklistData,
  t,
}: Readonly<ConfidenceIndicatorProps>) {
  const level = computeConfidence(photoCount, hasAIResults, checklistComplete, hasAnyChecklistData)
  const s = CONF_STYLE[level]

  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap',
      padding: '11px 16px',
      background: s.bg, border: `1px solid ${s.border}`, borderRadius: 12,
    }}>
      <span style={{
        fontSize: 9.5, fontWeight: 700, color: 'rgba(255,255,255,0.32)',
        textTransform: 'uppercase', letterSpacing: '0.09em', flexShrink: 0,
      }}>
        {safeT(t, 'report.confidenceLabel', 'Report confidence')}
      </span>
      <div style={{ display: 'flex', gap: 3, flexShrink: 0 }}>
        {([1, 2, 3] as const).map(i => (
          <div key={i} style={{
            width: 18, height: 5, borderRadius: 3,
            background: i <= s.bars ? s.color : 'rgba(255,255,255,0.07)',
          }} />
        ))}
      </div>
      <span style={{ fontSize: 12, color: s.color, fontWeight: 600, lineHeight: 1.3, flex: 1, minWidth: 120 }}>
        {safeT(t, CONF_TEXT_KEY[level], CONF_TEXT_FALLBACK[level])}
      </span>
    </div>
  )
}
