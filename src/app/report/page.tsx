'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useVehicleStore, useInspectionStore, usePaymentStore } from '@/store'
import { inspectionApi } from '@/services/api/inspection.api'
import type { RiskScore } from '@/types'
import AppShell from '../AppShell'

/* ── Verdict config ── */
const VERDICT: Record<string, { label: string; color: string; bg: string; border: string }> = {
  STRONG_BUY:       { label: 'Strong Buy',       color: '#22c55e', bg: 'rgba(34,197,94,0.07)',  border: 'rgba(34,197,94,0.2)' },
  BUY_WITH_CAUTION: { label: 'Buy with Caution', color: '#f59e0b', bg: 'rgba(245,158,11,0.07)', border: 'rgba(245,158,11,0.2)' },
  HIGH_RISK:        { label: 'High Risk',         color: '#f97316', bg: 'rgba(249,115,22,0.07)', border: 'rgba(249,115,22,0.2)' },
  WALK_AWAY:        { label: 'Walk Away',         color: '#ef4444', bg: 'rgba(239,68,68,0.07)',  border: 'rgba(239,68,68,0.2)' },
}

const SEV_COLOR: Record<string, string> = {
  critical: '#ef4444',
  warning:  '#f59e0b',
  info:     '#22d3ee',
}

/* ── Score ring (SVG circle progress) ── */
function ScoreRing({ score, color }: Readonly<{ score: number; color: string }>) {
  const r  = 44
  const c  = 2 * Math.PI * r
  const pct = Math.max(0, Math.min(100, score))
  return (
    <svg width="120" height="120" viewBox="0 0 120 120" style={{ display: 'block' }}>
      <circle cx="60" cy="60" r={r} fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="10" />
      <circle
        cx="60" cy="60" r={r} fill="none" stroke={color} strokeWidth="10"
        strokeDasharray={`${c} ${c}`}
        strokeDashoffset={c - (pct / 100) * c}
        strokeLinecap="round"
        transform="rotate(-90 60 60)"
        style={{ transition: 'stroke-dashoffset 0.8s ease' }}
      />
      <text x="60" y="56" textAnchor="middle" fill="#fff" fontSize="26" fontWeight="800" fontFamily="system-ui" letterSpacing="-2">
        {pct}
      </text>
      <text x="60" y="70" textAnchor="middle" fill="rgba(255,255,255,0.35)" fontSize="10" fontFamily="system-ui">
        / 100
      </text>
    </svg>
  )
}

/* ── Dimension bar ── */
function DimBar({ label, score, explanation }: Readonly<{ label: string; score: number; explanation?: string }>) {
  const color = score >= 70 ? '#22c55e' : score >= 45 ? '#f59e0b' : '#ef4444'
  return (
    <div style={{ padding: '14px 16px', background: 'rgba(255,255,255,0.025)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 12 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
        <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.45)' }}>{label}</span>
        <span style={{ fontSize: 18, fontWeight: 800, color, letterSpacing: '-0.5px' }}>{score}</span>
      </div>
      <div style={{ height: 4, background: 'rgba(255,255,255,0.05)', borderRadius: 4, overflow: 'hidden' }}>
        <div style={{ height: '100%', width: `${score}%`, background: color, borderRadius: 4, transition: 'width 0.6s ease' }} />
      </div>
      {explanation && (
        <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.28)', marginTop: 7, lineHeight: 1.5 }}>{explanation}</div>
      )}
    </div>
  )
}

/* ── Empty state ── */
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

export default function ReportPage() {
  const { activeVehicle }              = useVehicleStore()
  const { aiResults }  = useInspectionStore()
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
      setCalcError(err instanceof Error ? err.message : 'Failed to calculate score')
    } finally {
      setCalculating(false)
    }
  }

  /* ── No vehicle ── */
  if (!activeVehicle) {
    return (
      <AppShell>
        <EmptyReport
          icon={<svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="#22d3ee" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><line x1="10" y1="9" x2="8" y2="9"/></svg>}
          title="No vehicle selected"
          sub="Select a vehicle and complete an inspection first."
        />
        <div style={{ textAlign: 'center', marginTop: 4 }}>
          <Link href="/vehicle" style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '11px 22px', background: '#22d3ee', color: '#000', borderRadius: 11, fontSize: 14, fontWeight: 700, textDecoration: 'none' }}>
            Go to Vehicles
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 18 15 12 9 6"/></svg>
          </Link>
        </div>
      </AppShell>
    )
  }

  const latestAI = aiResults[0] ?? null
  const verdict  = riskScore ? VERDICT[riskScore.verdict] : null

  const dims = riskScore ? [
    { key: 'ai',        label: 'AI Analysis' },
    { key: 'exterior',  label: 'Exterior' },
    { key: 'interior',  label: 'Interior' },
    { key: 'mechanical',label: 'Mechanical' },
    { key: 'documents', label: 'Documents' },
    { key: 'testDrive', label: 'Test Drive' },
  ] as const : []

  return (
    <AppShell>
      <div style={{ maxWidth: 820, display: 'flex', flexDirection: 'column', gap: 14 }}>

        {/* ── Header ── */}
        <div style={{ marginBottom: 4 }}>
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
              sub="Complete the inspection checklist then calculate your AI confidence score."
            />
            <div style={{ padding: '0 24px 28px', display: 'flex', gap: 10, justifyContent: 'center' }}>
              <Link href="/inspection" style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '10px 18px', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 10, fontSize: 13, color: 'rgba(255,255,255,0.5)', textDecoration: 'none' }}>
                ← Back to Inspection
              </Link>
              <button
                onClick={handleCalculate}
                disabled={calculating}
                style={{ padding: '10px 24px', background: calculating ? 'rgba(34,211,238,0.5)' : '#22d3ee', color: '#000', border: 'none', borderRadius: 10, fontSize: 13, fontWeight: 700, cursor: calculating ? 'not-allowed' : 'pointer', fontFamily: 'var(--font-sans)' }}
              >
                {calculating ? 'Calculating…' : 'Calculate Score'}
              </button>
            </div>
          </div>
        )}

        {/* ── Score hero ── */}
        {riskScore && verdict && (
          <>
            <div style={{ padding: '22px 24px', background: verdict.bg, border: `1px solid ${verdict.border}`, borderRadius: 18, display: 'flex', alignItems: 'center', gap: 24, flexWrap: 'wrap' }}>
              <ScoreRing score={riskScore.buyScore} color={verdict.color} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 10, fontWeight: 700, color: 'rgba(255,255,255,0.38)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 8 }}>
                  AI Confidence Score
                </div>
                <div style={{ display: 'inline-flex', padding: '5px 14px', background: verdict.bg, border: `1px solid ${verdict.border}`, borderRadius: 20, fontSize: 14, fontWeight: 700, color: verdict.color, marginBottom: 10 }}>
                  {verdict.label}
                </div>
                <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.35)', lineHeight: 1.6 }}>
                  Risk index: <span style={{ color: 'rgba(255,255,255,0.6)', fontWeight: 600 }}>{riskScore.riskScore}</span> / 100
                  {riskScore.hasPremiumData && (
                    <span style={{ marginLeft: 10, color: '#22d3ee', fontSize: 11, fontWeight: 600 }}>
                      ✓ Premium data included
                    </span>
                  )}
                </div>
              </div>
              <div style={{ flexShrink: 0 }}>
                <button
                  onClick={handleCalculate}
                  disabled={calculating}
                  style={{ padding: '8px 16px', background: 'transparent', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 9, fontSize: 12, color: 'rgba(255,255,255,0.38)', cursor: calculating ? 'not-allowed' : 'pointer', fontFamily: 'var(--font-sans)' }}
                >
                  {calculating ? 'Recalculating…' : 'Recalculate'}
                </button>
              </div>
            </div>

            {/* ── Dimension scores ── */}
            {dims.length > 0 && (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 8 }}>
                {dims.map(d => {
                  const dim = riskScore.dimensions[d.key]
                  return (
                    <DimBar key={d.key} label={d.label} score={dim.score} explanation={dim.explanation} />
                  )
                })}
              </div>
            )}

            {/* ── Reasons for / against ── */}
            {(riskScore.reasonsFor.length > 0 || riskScore.reasonsAgainst.length > 0) && (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 10 }}>
                <div style={{ padding: '18px 20px', background: 'rgba(34,197,94,0.04)', border: '1px solid rgba(34,197,94,0.12)', borderRadius: 14 }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: '#22c55e', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 12 }}>Reasons to Buy</div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {riskScore.reasonsFor.map((r) => (
                      <div key={r} style={{ display: 'flex', gap: 9, fontSize: 13, color: 'rgba(255,255,255,0.65)', lineHeight: 1.4 }}>
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#22c55e" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0, marginTop: 2 }}><polyline points="20 6 9 17 4 12"/></svg>
                        {r}
                      </div>
                    ))}
                  </div>
                </div>
                <div style={{ padding: '18px 20px', background: 'rgba(239,68,68,0.04)', border: '1px solid rgba(239,68,68,0.12)', borderRadius: 14 }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: '#ef4444', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 12 }}>Concerns</div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {riskScore.reasonsAgainst.map((r) => (
                      <div key={r} style={{ display: 'flex', gap: 9, fontSize: 13, color: 'rgba(255,255,255,0.65)', lineHeight: 1.4 }}>
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#ef4444" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0, marginTop: 2 }}><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                        {r}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* ── AI Findings ── */}
            {latestAI && latestAI.findings.length > 0 && (
              <div style={{ padding: '18px 20px', background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 14 }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: 'rgba(255,255,255,0.35)', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 14 }}>
                  AI Findings ({latestAI.findings.length})
                </div>
                <div style={{ display: 'flex', flexDirection: 'column' }}>
                  {latestAI.findings.map(f => (
                    <div key={f.id} style={{ display: 'flex', alignItems: 'flex-start', gap: 12, padding: '10px 0', borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                      <div style={{ width: 6, height: 6, borderRadius: '50%', background: SEV_COLOR[f.severity] ?? '#fff', marginTop: 5, flexShrink: 0 }} />
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 13, fontWeight: 500, color: 'rgba(255,255,255,0.8)' }}>{f.title}</div>
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

            {/* ── Premium upsell / unlocked ── */}
            <div style={{ padding: '18px 22px', background: hasPremium ? 'rgba(34,211,238,0.04)' : 'rgba(255,255,255,0.02)', border: `1px solid ${hasPremium ? 'rgba(34,211,238,0.16)' : 'rgba(255,255,255,0.06)'}`, borderRadius: 14, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16 }}>
              <div>
                <div style={{ fontSize: 10, fontWeight: 700, color: hasPremium ? '#22d3ee' : 'rgba(255,255,255,0.35)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 4 }}>
                  Premium Vehicle History
                </div>
                <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.6)', lineHeight: 1.5 }}>
                  {hasPremium
                    ? 'CarVertical history report is factored into your score.'
                    : 'Unlock ownership records, accidents & service history to boost confidence.'}
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
