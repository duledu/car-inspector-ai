'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useTranslation } from 'react-i18next'
import { useVehicleStore, useInspectionStore, usePaymentStore } from '@/store'
import { inspectionApi } from '@/services/api/inspection.api'
import { PhotoAnalysisDisclaimer } from '@/components/legal/PhotoAnalysisDisclaimer'
import type { RiskScore } from '@/types'
import AppShell from '../AppShell'

// ─── Verdict config (colours only — labels resolved via t()) ─────────────────
const VERDICT_CFG: Record<string, { labelKey: string; color: string; bg: string; border: string; glow: string }> = {
  STRONG_BUY:       { labelKey: 'verdict.STRONG_BUY',       color: '#22c55e', bg: 'rgba(34,197,94,0.08)',   border: 'rgba(34,197,94,0.25)',   glow: 'rgba(34,197,94,0.15)'   },
  BUY_WITH_CAUTION: { labelKey: 'verdict.BUY_WITH_CAUTION', color: '#f59e0b', bg: 'rgba(245,158,11,0.08)',  border: 'rgba(245,158,11,0.25)',  glow: 'rgba(245,158,11,0.15)'  },
  HIGH_RISK:        { labelKey: 'verdict.HIGH_RISK',         color: '#f97316', bg: 'rgba(249,115,22,0.08)',  border: 'rgba(249,115,22,0.25)',  glow: 'rgba(249,115,22,0.15)'  },
  WALK_AWAY:        { labelKey: 'verdict.WALK_AWAY',         color: '#ef4444', bg: 'rgba(239,68,68,0.08)',   border: 'rgba(239,68,68,0.25)',   glow: 'rgba(239,68,68,0.15)'   },
}

const FLAG_CFG: Record<string, { labelKey: string; detailKey: string; color: string; bg: string; border: string }> = {
  NO_SERVICE_HISTORY:    { labelKey: 'flag.NO_SERVICE_HISTORY.label',    detailKey: 'flag.NO_SERVICE_HISTORY.detail',    color: '#ef4444', bg: 'rgba(239,68,68,0.06)',   border: 'rgba(239,68,68,0.2)'   },
  POSSIBLE_FAKE_HISTORY: { labelKey: 'flag.POSSIBLE_FAKE_HISTORY.label', detailKey: 'flag.POSSIBLE_FAKE_HISTORY.detail', color: '#f97316', bg: 'rgba(249,115,22,0.06)',  border: 'rgba(249,115,22,0.2)'  },
  HIGH_DAMAGE_COUNT:     { labelKey: 'flag.HIGH_DAMAGE_COUNT.label',     detailKey: 'flag.HIGH_DAMAGE_COUNT.detail',     color: '#ef4444', bg: 'rgba(239,68,68,0.06)',   border: 'rgba(239,68,68,0.2)'   },
  HIGH_REPAIR_HISTORY:   { labelKey: 'flag.HIGH_REPAIR_HISTORY.label',   detailKey: 'flag.HIGH_REPAIR_HISTORY.detail',   color: '#f59e0b', bg: 'rgba(245,158,11,0.06)',  border: 'rgba(245,158,11,0.2)'  },
}

const SVC_HISTORY_CFG: Record<string, { labelKey: string; color: string }> = {
  FULL:       { labelKey: 'svc.FULL',       color: '#22c55e' },
  PARTIAL:    { labelKey: 'svc.PARTIAL',    color: '#f59e0b' },
  NONE:       { labelKey: 'svc.NONE',       color: '#ef4444' },
  SUSPICIOUS: { labelKey: 'svc.SUSPICIOUS', color: '#f97316' },
}

const SEV_COLOR: Record<string, string> = { critical: '#ef4444', warning: '#f59e0b', info: '#22d3ee' }
type Translate = (key: string, options?: Record<string, unknown>) => string

function translateDimensionExplanation(key: string, text: string | undefined, t: Translate): string | undefined {
  if (!text) return undefined

  if (text === 'No AI findings. Photos appear clean.') return t('report.dimExplanation.ai.clean')
  if (text === 'Checklist not completed for this section.') return t('report.dimExplanation.checklist.notCompleted')
  if (text === 'No items assessed yet.') return t('report.dimExplanation.checklist.notAssessed')
  if (text === 'Basic VIN decoded only. Upgrade to premium for full history scoring.') return t('report.dimExplanation.vin.basic')
  if (text === 'Test drive not yet completed.') return t('report.dimExplanation.testDrive.notCompleted')

  const aiMatch = text.match(/^(\d+) issue(s)? detected\. Primary concern: (.+) \(confidence (\d+)%\)\.$/)
  if (aiMatch) {
    return t('report.dimExplanation.ai.issues', {
      count: Number(aiMatch[1]),
      title: aiMatch[3],
      confidence: Number(aiMatch[4]),
    })
  }

  const checklistMatch = text.match(/^(\d+) OK · (\d+) warnings · (\d+) problems across (\d+) items\.$/)
  if (checklistMatch) {
    return t('report.dimExplanation.checklist.summary', {
      ok: Number(checklistMatch[1]),
      warnings: Number(checklistMatch[2]),
      problems: Number(checklistMatch[3]),
      total: Number(checklistMatch[4]),
    })
  }

  const vinMatch = text.match(/^(\d+) accident\(s\)\. (\d+) open recall\(s\)\. Mileage: (consistent|inconsistent)\.$/)
  if (vinMatch) {
    return t('report.dimExplanation.vin.summary', {
      accidents: Number(vinMatch[1]),
      recalls: Number(vinMatch[2]),
      mileage: t(`report.mileage.${vinMatch[3]}`),
    })
  }

  const testDriveMatch = text.match(/^(\d+) good · (\d+) concerns · (\d+) problems observed during test drive\.$/)
  if (testDriveMatch) {
    return t('report.dimExplanation.testDrive.summary', {
      good: Number(testDriveMatch[1]),
      concerns: Number(testDriveMatch[2]),
      problems: Number(testDriveMatch[3]),
    })
  }

  return t(`report.dimExplanation.${key}.fallback`, { defaultValue: text })
}

function translateReason(text: string, t: Translate): string {
  const exact: Record<string, string> = {
    'Full service history verified': 'report.reason.fullServiceHistory',
    'No write-off or total loss recorded': 'report.reason.noTotalLoss',
    'No outstanding finance found': 'report.reason.noOutstandingFinance',
    'Vehicle not reported stolen': 'report.reason.notStolen',
    'Mileage progression is consistent': 'report.reason.mileageConsistent',
    'No critical AI anomalies detected in photos': 'report.reason.noCriticalAi',
    'No verified service history — major risk factor': 'report.reason.noServiceHistory',
    'Service records appear suspicious or inconsistent': 'report.reason.suspiciousServiceRecords',
    'High recorded repair costs in vehicle history': 'report.reason.highRepairCosts',
    'Outstanding finance found — legal risk': 'report.reason.outstandingFinance',
    'Mileage inconsistency detected': 'report.reason.mileageInconsistent',
  }
  if (exact[text]) return t(exact[text])

  const ownerMatch = text.match(/^Only (\d+) previous owner\(s\)$/)
  if (ownerMatch) return t('report.reason.previousOwners', { count: Number(ownerMatch[1]) })

  const checklistPassedMatch = text.match(/^(\d+) checklist items passed inspection$/)
  if (checklistPassedMatch) return t('report.reason.checklistPassed', { count: Number(checklistPassedMatch[1]) })

  const damageCountMatch = text.match(/^(\d+)\+ accidents recorded in vehicle history$/)
  if (damageCountMatch) return t('report.reason.accidentsAtLeast', { count: Number(damageCountMatch[1]) })

  const criticalAiMatch = text.match(/^AI detected (\d+) critical visual anomaly$/)
  if (criticalAiMatch) return t('report.reason.criticalAi', { count: Number(criticalAiMatch[1]) })

  const warningAiMatch = text.match(/^(\d+) AI warnings \(paint, gaps, or trim\)$/)
  if (warningAiMatch) return t('report.reason.aiWarnings', { count: Number(warningAiMatch[1]) })

  const accidentMatch = text.match(/^(\d+) accident\(s\) recorded in history$/)
  if (accidentMatch) return t('report.reason.accidentsRecorded', { count: Number(accidentMatch[1]) })

  const recallMatch = text.match(/^(\d+) outstanding safety recall\(s\)$/)
  if (recallMatch) return t('report.reason.openRecalls', { count: Number(recallMatch[1]) })

  const problemMatch = text.match(/^(\d+) checklist item\(s\) marked as problem$/)
  if (problemMatch) return t('report.reason.checklistProblems', { count: Number(problemMatch[1]) })

  return text
}

function translateNegotiationHint(text: string, t: Translate): string {
  const exact: Record<string, string> = {
    'Obtain full service records before finalising purchase.': 'report.hint.obtainServiceRecords',
    'No verified service history — negotiate a price reduction of €1,000–€3,000.': 'report.hint.noServiceHistoryDiscount',
    'Request an independent pre-purchase inspection as a condition of sale.': 'report.hint.independentInspection',
    'Budget for an immediate full service if you proceed.': 'report.hint.immediateService',
    'Suspicious or inconsistent service records — treat as no history.': 'report.hint.suspiciousRecords',
    'Negotiate a price reduction of €2,000–€4,000.': 'report.hint.suspiciousRecordsDiscount',
    'Walk away unless the seller can provide verifiable original receipts.': 'report.hint.requireReceipts',
  }
  if (exact[text]) return t(exact[text])

  const accidentsMatch = text.match(/^(\d+) recorded accidents — negotiate at least €1,500 off asking price\.$/)
  if (accidentsMatch) return t('report.hint.accidentDiscount', { count: Number(accidentsMatch[1]) })

  const repairMatch = text.match(/^High recorded repair costs \(>(.+) EUR\) — budget for potential recurring issues\.$/)
  if (repairMatch) return t('report.hint.highRepairCosts', { amount: repairMatch[1] })

  return text
}

function recommendationKey(verdict: string): string {
  return `report.recommendation.${verdict}`
}

// ─── Score ring ───────────────────────────────────────────────────────────────
function ScoreRing({ score, color }: Readonly<{ score: number; color: string }>) {
  const r   = 44
  const c   = 2 * Math.PI * r
  const pct = Math.max(0, Math.min(100, score))
  return (
    <svg width="112" height="112" viewBox="0 0 112 112" style={{ display: 'block', flexShrink: 0 }}>
      <circle cx="56" cy="56" r={r} fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="9" />
      <circle cx="56" cy="56" r={r} fill="none" stroke={color} strokeWidth="9"
        strokeDasharray={`${c} ${c}`}
        strokeDashoffset={c - (pct / 100) * c}
        strokeLinecap="round"
        transform="rotate(-90 56 56)"
        style={{ transition: 'stroke-dashoffset 0.9s ease' }}
      />
      <text x="56" y="52" textAnchor="middle" fill="#fff" fontSize="28" fontWeight="800" fontFamily="system-ui" letterSpacing="-2">{pct}</text>
      <text x="56" y="66" textAnchor="middle" fill="rgba(255,255,255,0.3)" fontSize="10" fontFamily="system-ui">/ 100</text>
    </svg>
  )
}

// ─── Risk flag card ───────────────────────────────────────────────────────────
function RiskFlagCard({ flagKey }: Readonly<{ flagKey: string }>) {
  const { t } = useTranslation()
  const cfg   = FLAG_CFG[flagKey]
  if (!cfg) return null
  return (
    <div style={{ padding: '14px 16px', background: cfg.bg, border: `1px solid ${cfg.border}`, borderRadius: 13, display: 'flex', gap: 12 }}>
      <div style={{ width: 36, height: 36, borderRadius: 10, background: `${cfg.color}18`, border: `1px solid ${cfg.color}40`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={cfg.color} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
          <line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>
        </svg>
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: cfg.color, marginBottom: 4, letterSpacing: '-0.1px' }}>{t(cfg.labelKey)}</div>
        <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.58)', lineHeight: 1.55 }}>{t(cfg.detailKey)}</div>
      </div>
    </div>
  )
}

// ─── Dimension bar ────────────────────────────────────────────────────────────
function dimColor(score: number): string {
  if (score >= 70) return '#22c55e'
  if (score >= 45) return '#f59e0b'
  return '#ef4444'
}

function DimBar({ label, score, explanation }: Readonly<{ label: string; score: number; explanation?: string }>) {
  const color = dimColor(score)
  return (
    <div style={{ padding: '13px 15px', background: 'rgba(255,255,255,0.025)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 12 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 7 }}>
        <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.45)' }}>{label}</span>
        <span style={{ fontSize: 17, fontWeight: 800, color, letterSpacing: '-0.5px' }}>{score}</span>
      </div>
      <div style={{ height: 3, background: 'rgba(255,255,255,0.05)', borderRadius: 3, overflow: 'hidden' }}>
        <div style={{ height: '100%', width: `${score}%`, background: color, borderRadius: 3, transition: 'width 0.7s ease' }} />
      </div>
      {explanation && (
        <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.28)', marginTop: 7, lineHeight: 1.5 }}>{explanation}</div>
      )}
    </div>
  )
}

// ─── Section label ────────────────────────────────────────────────────────────
function SectionLabel({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <div style={{ fontSize: 10, fontWeight: 700, color: 'rgba(255,255,255,0.32)', textTransform: 'uppercase', letterSpacing: '0.09em', marginBottom: 10 }}>
      {children}
    </div>
  )
}

// ─── Empty state ──────────────────────────────────────────────────────────────
function EmptyReport({ icon, title, sub }: Readonly<{ icon: React.ReactNode; title: string; sub: string }>) {
  return (
    <div style={{ textAlign: 'center', padding: '64px 24px' }}>
      <div style={{ width: 60, height: 60, borderRadius: 18, margin: '0 auto 22px', background: 'rgba(34,211,238,0.07)', border: '1px solid rgba(34,211,238,0.14)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        {icon}
      </div>
      <div style={{ fontSize: 18, fontWeight: 700, color: '#fff', marginBottom: 8, letterSpacing: '-0.3px' }}>{title}</div>
      <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.38)', lineHeight: 1.6 }}>{sub}</div>
    </div>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────
export default function ReportPage() {
  const { t }                          = useTranslation()
  const { activeVehicle }              = useVehicleStore()
  const { aiResults }                  = useInspectionStore()
  const { hasAccess }                  = usePaymentStore()

  const [riskScore,   setRiskScore]   = useState<RiskScore | null>(null)
  const [loading,     setLoading]     = useState(false)
  const [calculating, setCalculating] = useState(false)
  const [calcError,   setCalcError]   = useState<string | null>(null)

  const vehicleId  = activeVehicle?.id ?? ''
  const hasPremium = hasAccess(vehicleId, 'CARVERTICAL_REPORT')

  useEffect(() => {
    if (!vehicleId) return
    setLoading(true)
    inspectionApi.getScore(vehicleId)
      .then(s  => { setRiskScore(s); setLoading(false) })
      .catch(() => setLoading(false))
  }, [vehicleId])

  const handleCalculate = async () => {
    if (!vehicleId) return
    setCalculating(true)
    setCalcError(null)
    try {
      const s = await inspectionApi.calculateScore(vehicleId)
      setRiskScore(s)
    } catch (err: unknown) {
      setCalcError((err as { message?: string })?.message ?? t('report.error.calculateFailed'))
    } finally {
      setCalculating(false)
    }
  }

  // ── No vehicle ──
  if (!activeVehicle) {
    return (
      <AppShell>
        <EmptyReport
          icon={<svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="#22d3ee" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>}
          title={t('report.noVehicle')}
          sub={t('report.noVehicleSub')}
        />
        <div style={{ textAlign: 'center', marginTop: 4 }}>
          <Link href="/vehicle" style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '11px 22px', background: '#22d3ee', color: '#000', borderRadius: 11, fontSize: 14, fontWeight: 700, textDecoration: 'none' }}>
            {t('report.goToVehicles')}
          </Link>
        </div>
      </AppShell>
    )
  }

  const latestAI = aiResults[0] ?? null
  const verdict  = riskScore ? VERDICT_CFG[riskScore.verdict] : null
  const svcLabel = riskScore ? (SVC_HISTORY_CFG[riskScore.serviceHistoryStatus] ?? SVC_HISTORY_CFG.PARTIAL) : null

  const dims = riskScore ? ([
    { key: 'ai'         },
    { key: 'exterior'   },
    { key: 'interior'   },
    { key: 'mechanical' },
    { key: 'documents'  },
    { key: 'testDrive'  },
  ] as const) : []

  return (
    <AppShell>
      <div style={{ maxWidth: 820, display: 'flex', flexDirection: 'column', gap: 14 }}>

        {/* ── Header ── */}
        <div style={{ marginBottom: 2 }}>
          <h1 style={{ margin: 0, fontSize: 22, fontWeight: 800, color: '#fff', letterSpacing: '-0.5px' }}>{t('report.title')}</h1>
          <p style={{ margin: '4px 0 0', fontSize: 13, color: 'rgba(255,255,255,0.35)' }}>
            {activeVehicle.year} {activeVehicle.make} {activeVehicle.model}
          </p>
        </div>

        {/* ── Loading ── */}
        {loading && (
          <div style={{ textAlign: 'center', padding: '60px 0', color: 'rgba(255,255,255,0.28)', fontSize: 14 }}>
            {t('report.loading')}
          </div>
        )}

        {/* ── No score yet ── */}
        {!loading && !riskScore && (
          <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 16, overflow: 'hidden' }}>
            <EmptyReport
              icon={<svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="#22d3ee" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg>}
              title={t('report.noScore')}
              sub={t('report.noScoreSub')}
            />
            <div style={{ padding: '0 24px 28px', display: 'flex', gap: 10, justifyContent: 'center' }}>
              <Link href="/inspection" style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '10px 18px', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 10, fontSize: 13, color: 'rgba(255,255,255,0.5)', textDecoration: 'none' }}>
                {t('report.backToInspection')}
              </Link>
              <button onClick={handleCalculate} disabled={calculating}
                style={{ padding: '10px 24px', background: calculating ? 'rgba(34,211,238,0.5)' : '#22d3ee', color: '#000', border: 'none', borderRadius: 10, fontSize: 13, fontWeight: 700, cursor: calculating ? 'not-allowed' : 'pointer', fontFamily: 'var(--font-sans)' }}>
                {calculating ? t('report.calculating') : t('report.calculateScore')}
              </button>
            </div>
          </div>
        )}

        {riskScore && verdict && svcLabel && (
          <>
            {/* ══════════════════════════════════════════════════════════
                1. SUMMARY — score ring, verdict, service history badge
               ══════════════════════════════════════════════════════════ */}
            <div style={{
              padding: '20px 22px',
              background: verdict.bg,
              border: `1px solid ${verdict.border}`,
              borderRadius: 18,
              boxShadow: `0 0 40px ${verdict.glow}`,
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 22, flexWrap: 'wrap' }}>
                <ScoreRing score={riskScore.buyScore} color={verdict.color} />

                <div style={{ flex: 1, minWidth: 180 }}>
                  <div style={{ fontSize: 9, fontWeight: 700, color: 'rgba(255,255,255,0.35)', textTransform: 'uppercase', letterSpacing: '0.09em', marginBottom: 8 }}>
                    {t('report.aiConfidenceScore')}
                  </div>
                  {/* Verdict pill */}
                  <div style={{ display: 'inline-flex', padding: '5px 14px', background: verdict.bg, border: `1px solid ${verdict.border}`, borderRadius: 20, fontSize: 14, fontWeight: 700, color: verdict.color, marginBottom: 10 }}>
                    {t(verdict.labelKey)}
                  </div>
                  {/* Service history + premium badges */}
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 7 }}>
                    <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 9px', borderRadius: 5, background: `${svcLabel.color}18`, border: `1px solid ${svcLabel.color}40`, color: svcLabel.color }}>
                      {t(svcLabel.labelKey)}
                    </span>
                    {riskScore.hasPremiumData && (
                      <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 9px', borderRadius: 5, background: 'rgba(34,211,238,0.1)', border: '1px solid rgba(34,211,238,0.25)', color: '#22d3ee' }}>
                        {t('report.premiumData')}
                      </span>
                    )}
                    {/* Active risk flag count */}
                    {riskScore.riskFlags.length > 0 && (
                      <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 9px', borderRadius: 5, background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.25)', color: '#ef4444' }}>
                        {t('report.riskFlagCount_other', { count: riskScore.riskFlags.length })}
                      </span>
                    )}
                  </div>
                </div>

                {/* Recalculate button */}
                <button onClick={handleCalculate} disabled={calculating}
                  style={{ flexShrink: 0, padding: '8px 16px', background: 'transparent', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 9, fontSize: 12, color: 'rgba(255,255,255,0.4)', cursor: calculating ? 'not-allowed' : 'pointer', fontFamily: 'var(--font-sans)' }}>
                  {calculating ? t('report.recalculating') : t('report.recalculate')}
                </button>
              </div>
            </div>

            {/* ══════════════════════════════════════════════════════════
                2. RISK FLAGS — one card per active flag
               ══════════════════════════════════════════════════════════ */}
            <PhotoAnalysisDisclaimer />

            {riskScore.riskFlags.length > 0 && (
              <div>
                <SectionLabel>{t('report.riskFlags')}</SectionLabel>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>
                  {riskScore.riskFlags.map((flag) => (
                    <RiskFlagCard key={flag} flagKey={flag} />
                  ))}
                </div>
              </div>
            )}

            {/* Service history warning (when not flagged but still partial/none) */}
            {riskScore.serviceHistoryStatus === 'NONE' && riskScore.riskFlags.length === 0 && (
              <div style={{ padding: '14px 16px', background: 'rgba(239,68,68,0.06)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: 13 }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: '#ef4444', marginBottom: 4 }}>{t('report.noServiceHistoryTitle')}</div>
                <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.58)', lineHeight: 1.55 }}>
                  {t('report.noServiceHistorySub')}
                </div>
              </div>
            )}

            {/* ══════════════════════════════════════════════════════════
                3. PROS & CONS
               ══════════════════════════════════════════════════════════ */}
            {(riskScore.reasonsFor.length > 0 || riskScore.reasonsAgainst.length > 0) && (
              <div>
                <SectionLabel>{t('report.breakdown')}</SectionLabel>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 10 }}>
                  {riskScore.reasonsFor.length > 0 && (
                    <div style={{ padding: '16px 18px', background: 'rgba(34,197,94,0.04)', border: '1px solid rgba(34,197,94,0.12)', borderRadius: 14 }}>
                      <div style={{ fontSize: 11, fontWeight: 700, color: '#22c55e', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 12 }}>{t('report.reasons.for')}</div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>
                        {riskScore.reasonsFor.map((r) => (
                          <div key={r} style={{ display: 'flex', gap: 9, fontSize: 13, color: 'rgba(255,255,255,0.65)', lineHeight: 1.4 }}>
                            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#22c55e" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0, marginTop: 2 }}><polyline points="20 6 9 17 4 12"/></svg>
                            {translateReason(r, t)}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                  {riskScore.reasonsAgainst.length > 0 && (
                    <div style={{ padding: '16px 18px', background: 'rgba(239,68,68,0.04)', border: '1px solid rgba(239,68,68,0.12)', borderRadius: 14 }}>
                      <div style={{ fontSize: 11, fontWeight: 700, color: '#ef4444', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 12 }}>{t('report.reasons.against')}</div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>
                        {riskScore.reasonsAgainst.map((r) => (
                          <div key={r} style={{ display: 'flex', gap: 9, fontSize: 13, color: 'rgba(255,255,255,0.65)', lineHeight: 1.4 }}>
                            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#ef4444" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0, marginTop: 2 }}><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                            {translateReason(r, t)}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* ══════════════════════════════════════════════════════════
                4. INSPECTION BREAKDOWN — dimension bars
               ══════════════════════════════════════════════════════════ */}
            {dims.length > 0 && (
              <div>
                <SectionLabel>{t('report.breakdown')}</SectionLabel>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 8 }}>
                  {dims.map(d => {
                    const dim = riskScore.dimensions[d.key]
                    return <DimBar key={d.key} label={t(`dim.${d.key}`)} score={dim.score} explanation={translateDimensionExplanation(d.key, dim.explanation, t)} />
                  })}
                </div>
              </div>
            )}

            {/* ══════════════════════════════════════════════════════════
                5. BUYER ADVICE — negotiation hints + recommendation
               ══════════════════════════════════════════════════════════ */}
            {riskScore.negotiationHints.length > 0 && (
              <div>
                <SectionLabel>{t('report.negotiation')}</SectionLabel>
                <div style={{ padding: '18px 20px', background: 'rgba(245,158,11,0.05)', border: '1px solid rgba(245,158,11,0.18)', borderRadius: 14 }}>
                  <div style={{ display: 'flex', gap: 12, marginBottom: 14 }}>
                    <div style={{ width: 36, height: 36, borderRadius: 10, background: 'rgba(245,158,11,0.1)', border: '1px solid rgba(245,158,11,0.25)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                      <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="#f59e0b" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
                      </svg>
                    </div>
                    <div>
                      <div style={{ fontSize: 13, fontWeight: 700, color: '#f59e0b', marginBottom: 2 }}>{t('report.negotiation')}</div>
                      <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.45)' }}>{t('topbar.inspection.sub')}</div>
                    </div>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>
                    {riskScore.negotiationHints.map((hint, i) => (
                      // eslint-disable-next-line react/no-array-index-key
                      <div key={i} style={{ display: 'flex', gap: 10, fontSize: 13, color: 'rgba(255,255,255,0.7)', lineHeight: 1.5 }}>
                        <div style={{ width: 5, height: 5, borderRadius: '50%', background: '#f59e0b', flexShrink: 0, marginTop: 7 }} />
                        {translateNegotiationHint(hint, t)}
                      </div>
                    ))}
                  </div>
                  {/* Overall recommendation */}
                  <div style={{ marginTop: 16, paddingTop: 14, borderTop: '1px solid rgba(245,158,11,0.15)', fontSize: 12, color: 'rgba(255,255,255,0.4)', lineHeight: 1.55 }}>
                    {t(recommendationKey(riskScore.verdict))}
                  </div>
                </div>
              </div>
            )}

            {/* ══════════════════════════════════════════════════════════
                6. AI PHOTO FINDINGS
               ══════════════════════════════════════════════════════════ */}
            <div className="report-lower-stack">
              <div>
                <SectionLabel>{t('report.aiFindings')} ({latestAI?.findings.length ?? 0})</SectionLabel>
                <div style={{ background: 'linear-gradient(135deg, rgba(34,211,238,0.035) 0%, rgba(255,255,255,0.018) 100%)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 16, overflow: 'hidden', boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.04)' }}>
                  {latestAI && latestAI.findings.length > 0 ? latestAI.findings.map((f, i) => (
                    // eslint-disable-next-line react/no-array-index-key
                    <div key={i} className="report-ai-finding-row" style={{ display: 'flex', alignItems: 'flex-start', gap: 12, padding: '14px 16px', borderBottom: i < latestAI.findings.length - 1 ? '1px solid rgba(255,255,255,0.05)' : 'none' }}>
                      <div style={{ width: 7, height: 7, borderRadius: '50%', background: SEV_COLOR[f.severity] ?? '#fff', marginTop: 5, flexShrink: 0, boxShadow: `0 0 10px ${SEV_COLOR[f.severity] ?? '#fff'}55` }} />
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 13, fontWeight: 650, color: 'rgba(255,255,255,0.86)', lineHeight: 1.35 }}>{f.title}</div>
                        {f.description && <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.44)', marginTop: 4, lineHeight: 1.55 }}>{f.description}</div>}
                      </div>
                      <span style={{ fontSize: 9, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.06em', color: SEV_COLOR[f.severity] ?? '#fff', flexShrink: 0, marginTop: 1, padding: '3px 6px', borderRadius: 6, background: 'rgba(255,255,255,0.035)', border: '1px solid rgba(255,255,255,0.07)' }}>
                        {t(`report.severity.${f.severity}`)}
                      </span>
                    </div>
                  )) : (
                    <div style={{ padding: '18px 18px', display: 'flex', gap: 12, alignItems: 'flex-start' }}>
                      <div style={{ width: 32, height: 32, borderRadius: 9, flexShrink: 0, background: 'rgba(34,211,238,0.08)', border: '1px solid rgba(34,211,238,0.18)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#22d3ee" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
                      </div>
                      <div>
                        <div style={{ fontSize: 13, fontWeight: 700, color: 'rgba(255,255,255,0.78)', marginBottom: 3 }}>{t('inspection.noFlagsRaised')}</div>
                        <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.42)', lineHeight: 1.55 }}>{t('report.dimExplanation.ai.clean')}</div>
                      </div>
                    </div>
                  )}
                </div>
              </div>

            {/* ══════════════════════════════════════════════════════════
                7. PREMIUM UPSELL / UNLOCKED
               ══════════════════════════════════════════════════════════ */}
              <div className="report-premium-card" style={{ padding: '18px 20px', background: hasPremium ? 'linear-gradient(135deg, rgba(34,211,238,0.07), rgba(34,211,238,0.025))' : 'linear-gradient(135deg, rgba(255,255,255,0.03), rgba(255,255,255,0.015))', border: `1px solid ${hasPremium ? 'rgba(34,211,238,0.18)' : 'rgba(255,255,255,0.07)'}`, borderRadius: 16, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16, boxShadow: hasPremium ? '0 0 28px rgba(34,211,238,0.08), inset 0 1px 0 rgba(255,255,255,0.05)' : 'inset 0 1px 0 rgba(255,255,255,0.04)' }}>
              <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: 10, fontWeight: 700, color: hasPremium ? '#22d3ee' : 'rgba(255,255,255,0.35)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 4 }}>
                  {t('report.premiumUnlock')}
                </div>
                <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.6)', lineHeight: 1.5 }}>
                  {hasPremium ? t('profile.carverticalReport') : t('dashboard.unlockHistorySub')}
                </div>
              </div>
              <Link href="/premium" style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 5, flexShrink: 0, padding: '10px 18px', minHeight: 42, background: 'rgba(34,211,238,0.1)', border: '1px solid rgba(34,211,238,0.22)', borderRadius: 9, fontSize: 12, fontWeight: 700, color: '#22d3ee', textDecoration: 'none', whiteSpace: 'nowrap' }}>
                {hasPremium ? t('report.title') : t('report.premiumUnlock')}
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 18 15 12 9 6"/></svg>
              </Link>
              </div>
            </div>
          </>
        )}

        {/* ── Calc error ── */}
        {calcError && (
          <div style={{ padding: '10px 14px', background: 'rgba(239,68,68,0.07)', border: '1px solid rgba(239,68,68,0.15)', borderRadius: 9, fontSize: 13, color: '#f87171' }}>
            {calcError}
          </div>
        )}
      </div>
    </AppShell>
  )
}
