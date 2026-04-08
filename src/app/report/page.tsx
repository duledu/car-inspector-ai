'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useVehicleStore, useInspectionStore, usePaymentStore } from '@/store'
import { inspectionApi } from '@/services/api/inspection.api'
import type { RiskScore } from '@/types'
import AppShell from '../AppShell'

// ─── Verdict config ───────────────────────────────────────────────────────────
const VERDICT_CFG: Record<string, { label: string; color: string; bg: string; border: string; glow: string }> = {
  STRONG_BUY:       { label: 'Strong Buy',       color: '#22c55e', bg: 'rgba(34,197,94,0.08)',   border: 'rgba(34,197,94,0.25)',   glow: 'rgba(34,197,94,0.15)'   },
  BUY_WITH_CAUTION: { label: 'Buy with Caution', color: '#f59e0b', bg: 'rgba(245,158,11,0.08)',  border: 'rgba(245,158,11,0.25)',  glow: 'rgba(245,158,11,0.15)'  },
  HIGH_RISK:        { label: 'High Risk',         color: '#f97316', bg: 'rgba(249,115,22,0.08)',  border: 'rgba(249,115,22,0.25)',  glow: 'rgba(249,115,22,0.15)'  },
  WALK_AWAY:        { label: 'Walk Away',         color: '#ef4444', bg: 'rgba(239,68,68,0.08)',   border: 'rgba(239,68,68,0.25)',   glow: 'rgba(239,68,68,0.15)'   },
}

const FLAG_CFG: Record<string, { label: string; detail: string; color: string; bg: string; border: string }> = {
  NO_SERVICE_HISTORY:   { label: 'No Service History',       detail: 'One of the biggest risk factors. Without documented maintenance, mechanical condition and mileage cannot be trusted.', color: '#ef4444', bg: 'rgba(239,68,68,0.06)',   border: 'rgba(239,68,68,0.2)'   },
  POSSIBLE_FAKE_HISTORY:{ label: 'Suspicious Service Records', detail: 'Service records appear inconsistent or fabricated. Treat this vehicle as having no history at all.',                 color: '#f97316', bg: 'rgba(249,115,22,0.06)',  border: 'rgba(249,115,22,0.2)'  },
  HIGH_DAMAGE_COUNT:    { label: 'Multiple Accidents',        detail: '3 or more recorded accidents indicate a pattern of damage. Inspect structural integrity thoroughly.',                   color: '#ef4444', bg: 'rgba(239,68,68,0.06)',   border: 'rgba(239,68,68,0.2)'   },
  HIGH_REPAIR_HISTORY:  { label: 'High Repair Costs',         detail: 'Significant repair costs recorded. These issues may recur or indicate deeper mechanical problems.',                    color: '#f59e0b', bg: 'rgba(245,158,11,0.06)',  border: 'rgba(245,158,11,0.2)'  },
}

const SVC_HISTORY_LABEL: Record<string, { label: string; color: string }> = {
  FULL:        { label: 'Full history',    color: '#22c55e' },
  PARTIAL:     { label: 'Partial history', color: '#f59e0b' },
  NONE:        { label: 'No history',      color: '#ef4444' },
  SUSPICIOUS:  { label: 'Suspicious',      color: '#f97316' },
}

const SEV_COLOR: Record<string, string> = { critical: '#ef4444', warning: '#f59e0b', info: '#22d3ee' }

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
  const cfg = FLAG_CFG[flagKey]
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
        <div style={{ fontSize: 13, fontWeight: 700, color: cfg.color, marginBottom: 4, letterSpacing: '-0.1px' }}>{cfg.label}</div>
        <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.58)', lineHeight: 1.55 }}>{cfg.detail}</div>
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
      setCalcError((err as { message?: string })?.message ?? 'Failed to calculate score')
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
          title="No vehicle selected"
          sub="Select a vehicle and complete an inspection first."
        />
        <div style={{ textAlign: 'center', marginTop: 4 }}>
          <Link href="/vehicle" style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '11px 22px', background: '#22d3ee', color: '#000', borderRadius: 11, fontSize: 14, fontWeight: 700, textDecoration: 'none' }}>
            Go to Vehicles
          </Link>
        </div>
      </AppShell>
    )
  }

  const latestAI = aiResults[0] ?? null
  const verdict  = riskScore ? VERDICT_CFG[riskScore.verdict] : null
  const svcLabel = riskScore ? (SVC_HISTORY_LABEL[riskScore.serviceHistoryStatus] ?? SVC_HISTORY_LABEL.PARTIAL) : null

  const dims = riskScore ? ([
    { key: 'ai',         label: 'AI Analysis'  },
    { key: 'exterior',   label: 'Exterior'     },
    { key: 'interior',   label: 'Interior'     },
    { key: 'mechanical', label: 'Mechanical'   },
    { key: 'documents',  label: 'Documents'    },
    { key: 'testDrive',  label: 'Test Drive'   },
  ] as const) : []

  return (
    <AppShell>
      <div style={{ maxWidth: 820, display: 'flex', flexDirection: 'column', gap: 14 }}>

        {/* ── Header ── */}
        <div style={{ marginBottom: 2 }}>
          <h1 style={{ margin: 0, fontSize: 22, fontWeight: 800, color: '#fff', letterSpacing: '-0.5px' }}>Confidence Report</h1>
          <p style={{ margin: '4px 0 0', fontSize: 13, color: 'rgba(255,255,255,0.35)' }}>
            {activeVehicle.year} {activeVehicle.make} {activeVehicle.model}
          </p>
        </div>

        {/* ── Loading ── */}
        {loading && (
          <div style={{ textAlign: 'center', padding: '60px 0', color: 'rgba(255,255,255,0.28)', fontSize: 14 }}>
            Loading report…
          </div>
        )}

        {/* ── No score yet ── */}
        {!loading && !riskScore && (
          <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 16, overflow: 'hidden' }}>
            <EmptyReport
              icon={<svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="#22d3ee" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg>}
              title="No score yet"
              sub="Complete the inspection checklist then calculate your confidence score."
            />
            <div style={{ padding: '0 24px 28px', display: 'flex', gap: 10, justifyContent: 'center' }}>
              <Link href="/inspection" style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '10px 18px', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 10, fontSize: 13, color: 'rgba(255,255,255,0.5)', textDecoration: 'none' }}>
                ← Back to Inspection
              </Link>
              <button onClick={handleCalculate} disabled={calculating}
                style={{ padding: '10px 24px', background: calculating ? 'rgba(34,211,238,0.5)' : '#22d3ee', color: '#000', border: 'none', borderRadius: 10, fontSize: 13, fontWeight: 700, cursor: calculating ? 'not-allowed' : 'pointer', fontFamily: 'var(--font-sans)' }}>
                {calculating ? 'Calculating…' : 'Calculate Score'}
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
                    AI Confidence Score
                  </div>
                  {/* Verdict pill */}
                  <div style={{ display: 'inline-flex', padding: '5px 14px', background: verdict.bg, border: `1px solid ${verdict.border}`, borderRadius: 20, fontSize: 14, fontWeight: 700, color: verdict.color, marginBottom: 10 }}>
                    {verdict.label}
                  </div>
                  {/* Service history + premium badges */}
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 7 }}>
                    <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 9px', borderRadius: 5, background: `${svcLabel.color}18`, border: `1px solid ${svcLabel.color}40`, color: svcLabel.color }}>
                      {svcLabel.label}
                    </span>
                    {riskScore.hasPremiumData && (
                      <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 9px', borderRadius: 5, background: 'rgba(34,211,238,0.1)', border: '1px solid rgba(34,211,238,0.25)', color: '#22d3ee' }}>
                        Premium data
                      </span>
                    )}
                    {/* Active risk flag count */}
                    {riskScore.riskFlags.length > 0 && (
                      <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 9px', borderRadius: 5, background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.25)', color: '#ef4444' }}>
                        {riskScore.riskFlags.length} risk flag{riskScore.riskFlags.length > 1 ? 's' : ''}
                      </span>
                    )}
                  </div>
                </div>

                {/* Recalculate button */}
                <button onClick={handleCalculate} disabled={calculating}
                  style={{ flexShrink: 0, padding: '8px 16px', background: 'transparent', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 9, fontSize: 12, color: 'rgba(255,255,255,0.4)', cursor: calculating ? 'not-allowed' : 'pointer', fontFamily: 'var(--font-sans)' }}>
                  {calculating ? 'Recalculating…' : 'Recalculate'}
                </button>
              </div>
            </div>

            {/* ══════════════════════════════════════════════════════════
                2. RISK FLAGS — one card per active flag
               ══════════════════════════════════════════════════════════ */}
            {riskScore.riskFlags.length > 0 && (
              <div>
                <SectionLabel>Risk Flags</SectionLabel>
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
                <div style={{ fontSize: 13, fontWeight: 700, color: '#ef4444', marginBottom: 4 }}>No verified service history</div>
                <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.58)', lineHeight: 1.55 }}>
                  Without documented maintenance, mileage and mechanical condition cannot be trusted.
                </div>
              </div>
            )}

            {/* ══════════════════════════════════════════════════════════
                3. PROS & CONS
               ══════════════════════════════════════════════════════════ */}
            {(riskScore.reasonsFor.length > 0 || riskScore.reasonsAgainst.length > 0) && (
              <div>
                <SectionLabel>Inspection Summary</SectionLabel>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 10 }}>
                  {riskScore.reasonsFor.length > 0 && (
                    <div style={{ padding: '16px 18px', background: 'rgba(34,197,94,0.04)', border: '1px solid rgba(34,197,94,0.12)', borderRadius: 14 }}>
                      <div style={{ fontSize: 11, fontWeight: 700, color: '#22c55e', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 12 }}>Positive signals</div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>
                        {riskScore.reasonsFor.map((r) => (
                          <div key={r} style={{ display: 'flex', gap: 9, fontSize: 13, color: 'rgba(255,255,255,0.65)', lineHeight: 1.4 }}>
                            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#22c55e" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0, marginTop: 2 }}><polyline points="20 6 9 17 4 12"/></svg>
                            {r}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                  {riskScore.reasonsAgainst.length > 0 && (
                    <div style={{ padding: '16px 18px', background: 'rgba(239,68,68,0.04)', border: '1px solid rgba(239,68,68,0.12)', borderRadius: 14 }}>
                      <div style={{ fontSize: 11, fontWeight: 700, color: '#ef4444', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 12 }}>Concerns</div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>
                        {riskScore.reasonsAgainst.map((r) => (
                          <div key={r} style={{ display: 'flex', gap: 9, fontSize: 13, color: 'rgba(255,255,255,0.65)', lineHeight: 1.4 }}>
                            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#ef4444" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0, marginTop: 2 }}><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                            {r}
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
                <SectionLabel>Inspection Breakdown</SectionLabel>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 8 }}>
                  {dims.map(d => {
                    const dim = riskScore.dimensions[d.key]
                    return <DimBar key={d.key} label={d.label} score={dim.score} explanation={dim.explanation} />
                  })}
                </div>
              </div>
            )}

            {/* ══════════════════════════════════════════════════════════
                5. BUYER ADVICE — negotiation hints + recommendation
               ══════════════════════════════════════════════════════════ */}
            {riskScore.negotiationHints.length > 0 && (
              <div>
                <SectionLabel>Buyer Advice</SectionLabel>
                <div style={{ padding: '18px 20px', background: 'rgba(245,158,11,0.05)', border: '1px solid rgba(245,158,11,0.18)', borderRadius: 14 }}>
                  <div style={{ display: 'flex', gap: 12, marginBottom: 14 }}>
                    <div style={{ width: 36, height: 36, borderRadius: 10, background: 'rgba(245,158,11,0.1)', border: '1px solid rgba(245,158,11,0.25)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                      <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="#f59e0b" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
                      </svg>
                    </div>
                    <div>
                      <div style={{ fontSize: 13, fontWeight: 700, color: '#f59e0b', marginBottom: 2 }}>Negotiation Strategy</div>
                      <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.45)' }}>Based on inspection findings</div>
                    </div>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>
                    {riskScore.negotiationHints.map((hint, i) => (
                      // eslint-disable-next-line react/no-array-index-key
                      <div key={i} style={{ display: 'flex', gap: 10, fontSize: 13, color: 'rgba(255,255,255,0.7)', lineHeight: 1.5 }}>
                        <div style={{ width: 5, height: 5, borderRadius: '50%', background: '#f59e0b', flexShrink: 0, marginTop: 7 }} />
                        {hint}
                      </div>
                    ))}
                  </div>
                  {/* Overall recommendation */}
                  <div style={{ marginTop: 16, paddingTop: 14, borderTop: '1px solid rgba(245,158,11,0.15)', fontSize: 12, color: 'rgba(255,255,255,0.4)', lineHeight: 1.55 }}>
                    {riskScore.verdict === 'STRONG_BUY'
                      ? 'This vehicle passes all major checks. Proceed with confidence — or use minor findings to negotiate a small discount.'
                      : riskScore.verdict === 'BUY_WITH_CAUTION'
                      ? 'Proceed only after resolving all concerns above. Use the checklist to negotiate a fair price.'
                      : riskScore.verdict === 'HIGH_RISK'
                      ? 'This vehicle carries significant risk. Only proceed if the seller agrees to a major price reduction or addresses all issues.'
                      : 'Based on the evidence, walking away is the safest option. Significant issues detected that are likely to cost more than the asking price.'}
                  </div>
                </div>
              </div>
            )}

            {/* ══════════════════════════════════════════════════════════
                6. AI PHOTO FINDINGS
               ══════════════════════════════════════════════════════════ */}
            {latestAI && latestAI.findings.length > 0 && (
              <div>
                <SectionLabel>AI Photo Findings ({latestAI.findings.length})</SectionLabel>
                <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 14, overflow: 'hidden' }}>
                  {latestAI.findings.map((f, i) => (
                    // eslint-disable-next-line react/no-array-index-key
                    <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 12, padding: '12px 16px', borderBottom: i < latestAI.findings.length - 1 ? '1px solid rgba(255,255,255,0.04)' : 'none' }}>
                      <div style={{ width: 6, height: 6, borderRadius: '50%', background: SEV_COLOR[f.severity] ?? '#fff', marginTop: 5, flexShrink: 0 }} />
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 13, fontWeight: 500, color: 'rgba(255,255,255,0.82)' }}>{f.title}</div>
                        {f.description && <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.35)', marginTop: 2, lineHeight: 1.5 }}>{f.description}</div>}
                      </div>
                      <span style={{ fontSize: 9, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: SEV_COLOR[f.severity] ?? '#fff', flexShrink: 0, marginTop: 2 }}>
                        {f.severity}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* ══════════════════════════════════════════════════════════
                7. PREMIUM UPSELL / UNLOCKED
               ══════════════════════════════════════════════════════════ */}
            <div style={{ padding: '18px 22px', background: hasPremium ? 'rgba(34,211,238,0.04)' : 'rgba(255,255,255,0.02)', border: `1px solid ${hasPremium ? 'rgba(34,211,238,0.16)' : 'rgba(255,255,255,0.06)'}`, borderRadius: 14, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16 }}>
              <div>
                <div style={{ fontSize: 10, fontWeight: 700, color: hasPremium ? '#22d3ee' : 'rgba(255,255,255,0.35)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 4 }}>
                  Premium Vehicle History
                </div>
                <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.6)', lineHeight: 1.5 }}>
                  {hasPremium
                    ? 'CarVertical history report is factored into your score.'
                    : 'Unlock ownership records, accidents & service history to boost scoring accuracy.'}
                </div>
              </div>
              <Link href="/premium" style={{ display: 'inline-flex', alignItems: 'center', gap: 5, flexShrink: 0, padding: '9px 18px', background: 'rgba(34,211,238,0.1)', border: '1px solid rgba(34,211,238,0.22)', borderRadius: 9, fontSize: 12, fontWeight: 600, color: '#22d3ee', textDecoration: 'none' }}>
                {hasPremium ? 'View Report' : 'Unlock Premium'}
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 18 15 12 9 6"/></svg>
              </Link>
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
