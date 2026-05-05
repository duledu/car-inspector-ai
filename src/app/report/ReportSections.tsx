'use client'

type Translate = (key: string, options?: Record<string, unknown>) => string

// ─── Decision Block ───────────────────────────────────────────────────────────

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
        headline: t('report.decision.headline.strongBuy', { defaultValue: 'Safe to proceed' }),
        body: t('report.decision.body.strongBuy', { defaultValue: 'No significant issues detected. This vehicle appears suitable for purchase.' }),
      }
    case 'BUY_WITH_CAUTION':
      return {
        headline: t('report.decision.headline.caution', { defaultValue: 'Proceed with caution' }),
        body: total > 0
          ? t('report.decision.body.cautionIssues', { count: total, defaultValue: `${total} concern(s) need attention. Address these before finalising any deal.` })
          : t('report.decision.body.caution', { defaultValue: 'Minor risks present. Review flagged items with the seller before committing.' }),
      }
    case 'HIGH_RISK':
      return {
        headline: t('report.decision.headline.highRisk', { defaultValue: 'High risk — do not buy without inspection' }),
        body: t('report.decision.body.highRisk', { defaultValue: 'Serious issues detected. Get a professional inspection before making any decision.' }),
      }
    case 'WALK_AWAY':
      return {
        headline: t('report.decision.headline.walkAway', { defaultValue: 'Not recommended' }),
        body: t('report.decision.body.walkAway', { defaultValue: 'Multiple critical problems found. The risks outweigh the value of this vehicle at the asking price.' }),
      }
    default:
      return null
  }
}

function DecisionIcon({ verdict, color }: Readonly<{ verdict: string; color: string }>) {
  if (verdict === 'STRONG_BUY') {
    return (
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
        <polyline points="20 6 9 17 4 12"/>
      </svg>
    )
  }
  if (verdict === 'WALK_AWAY') {
    return (
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
        <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
      </svg>
    )
  }
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
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
      padding: '16px 18px',
      background: verdictBg,
      border: `1px solid ${verdictBorder}`,
      borderLeft: `3px solid ${verdictColor}`,
      borderRadius: 14,
    }}>
      <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
        <div style={{
          width: 32, height: 32, borderRadius: 9,
          background: `${verdictColor}18`, border: `1px solid ${verdictColor}35`,
          display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
        }}>
          <DecisionIcon verdict={verdict} color={verdictColor} />
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 9.5, fontWeight: 700, color: 'rgba(255,255,255,0.35)', textTransform: 'uppercase', letterSpacing: '0.09em', marginBottom: 5 }}>
            {t('report.finalRecommendation', { defaultValue: 'Final Recommendation' })}
          </div>
          <div style={{ fontSize: 15, fontWeight: 700, color: verdictColor, marginBottom: 6, letterSpacing: '-0.1px', lineHeight: 1.3 }}>
            {content.headline}
          </div>
          <div style={{ fontSize: 13.5, color: 'rgba(255,255,255,0.7)', lineHeight: 1.6 }}>
            {content.body}
          </div>
        </div>
      </div>
    </div>
  )
}

// ─── Confidence Indicator ─────────────────────────────────────────────────────

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
  const photoScore    = Math.min(photoCount / 6, 1)
  const checkScore    = checklistComplete ? 1 : hasAnyChecklist ? 0.5 : 0
  const aiScore       = hasAI ? 1 : 0
  const total = photoScore * 0.40 + checkScore * 0.35 + aiScore * 0.25
  if (total >= 0.70) return 'high'
  if (total >= 0.38) return 'medium'
  return 'low'
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

const CONF_TEXT_DEFAULT: Record<ConfLevel, string> = {
  high:   'High — sufficient data for reliable analysis',
  medium: 'Moderate — partial data, results are indicative',
  low:    'Low — limited data, treat results with caution',
}

export function ConfidenceIndicator({
  photoCount,
  hasAIResults,
  checklistComplete,
  hasAnyChecklistData,
  t,
}: Readonly<ConfidenceIndicatorProps>) {
  const level = computeConfidence(photoCount, hasAIResults, checklistComplete, hasAnyChecklistData)
  const s     = CONF_STYLE[level]

  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 10,
      padding: '9px 14px',
      background: s.bg, border: `1px solid ${s.border}`, borderRadius: 10,
    }}>
      <span style={{ fontSize: 10, fontWeight: 700, color: 'rgba(255,255,255,0.3)', textTransform: 'uppercase', letterSpacing: '0.08em', flexShrink: 0 }}>
        {t('report.confidenceLabel', { defaultValue: 'Confidence' })}
      </span>
      <div style={{ display: 'flex', gap: 3, flexShrink: 0 }}>
        {([1, 2, 3] as const).map(i => (
          <div key={i} style={{ width: 16, height: 5, borderRadius: 3, background: i <= s.bars ? s.color : 'rgba(255,255,255,0.07)' }} />
        ))}
      </div>
      <span style={{ fontSize: 11.5, color: s.color, fontWeight: 600, lineHeight: 1.3 }}>
        {t(CONF_TEXT_KEY[level], { defaultValue: CONF_TEXT_DEFAULT[level] })}
      </span>
    </div>
  )
}
