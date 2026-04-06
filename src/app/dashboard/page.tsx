'use client'

import { useEffect } from 'react'
import Link from 'next/link'
import { useVehicleStore, useInspectionStore, usePaymentStore } from '@/store'
import AppShell from '../AppShell'

// ─── Design atoms ─────────────────────────────────────────────
const glass = {
  background: 'rgba(255,255,255,0.03)',
  border: '1px solid rgba(255,255,255,0.08)',
  backdropFilter: 'blur(16px)',
  WebkitBackdropFilter: 'blur(16px)',
} as React.CSSProperties

const glassAccent = {
  background: 'rgba(34,211,238,0.04)',
  border: '1px solid rgba(34,211,238,0.14)',
} as React.CSSProperties

function severityColor(s: string) {
  if (s === 'critical') return '#ef4444'
  if (s === 'warning')  return '#f59e0b'
  return '#22c55e'
}

const PHASE_LABELS: Record<string, string> = {
  PRE_SCREENING: 'Pre-Screening', AI_PHOTOS: 'Photos', EXTERIOR: 'Exterior',
  INTERIOR: 'Interior', MECHANICAL: 'Mechanical', TEST_DRIVE: 'Test Drive',
  VIN_DOCS: 'Documents', RISK_ANALYSIS: 'AI Analysis', FINAL_REPORT: 'Complete',
}

// ─── Score ring ────────────────────────────────────────────────
function ScoreRing({ score }: Readonly<{ score: number }>) {
  const r = 26
  const circ = 2 * Math.PI * r
  const offset = circ - (circ * score) / 100
  return (
    <div style={{ position: 'relative', width: 68, height: 68, flexShrink: 0 }}>
      <svg width="68" height="68" viewBox="0 0 68 68">
        <circle cx="34" cy="34" r={r} fill="none" stroke="rgba(34,211,238,0.08)" strokeWidth="4"/>
        <circle cx="34" cy="34" r={r} fill="none"
          stroke="url(#dash-grad)" strokeWidth="4"
          strokeLinecap="round"
          strokeDasharray={circ}
          strokeDashoffset={offset}
          transform="rotate(-90 34 34)"
          style={{ transition: 'stroke-dashoffset 1s ease' }}
        />
        <defs>
          <linearGradient id="dash-grad" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="#22d3ee"/>
            <stop offset="100%" stopColor="#818cf8"/>
          </linearGradient>
        </defs>
      </svg>
      <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
        <span style={{ fontSize: 16, fontWeight: 900, color: '#fff', letterSpacing: '-0.5px', lineHeight: 1 }}>{score}</span>
        <span style={{ fontSize: 8, fontWeight: 700, color: 'rgba(255,255,255,0.3)', textTransform: 'uppercase', letterSpacing: '0.06em', marginTop: 1 }}>AI</span>
      </div>
    </div>
  )
}

// ─── Stat card ─────────────────────────────────────────────────
function StatCard({ value, label, href, color = '#22d3ee', icon }: Readonly<{
  value: string | number; label: string; href: string; color?: string; icon: React.ReactNode
}>) {
  return (
    <Link href={href} style={{ textDecoration: 'none' }}>
      <div style={{
        ...glass, borderRadius: 16, padding: '14px 14px',
        display: 'flex', flexDirection: 'column', gap: 10,
        cursor: 'pointer', transition: 'all 0.15s',
      }}>
        <div style={{
          width: 32, height: 32, borderRadius: 10,
          background: `${color}12`, border: `1px solid ${color}25`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          color,
        }}>
          {icon}
        </div>
        <div>
          <div style={{ fontSize: 22, fontWeight: 900, color: '#fff', letterSpacing: '-1px', lineHeight: 1 }}>{value}</div>
          <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.32)', marginTop: 3, fontWeight: 500 }}>{label}</div>
        </div>
      </div>
    </Link>
  )
}

// ─── Section header ────────────────────────────────────────────
function SectionHeader({ label, actionLabel, actionHref }: Readonly<{ label: string; actionLabel?: string; actionHref?: string }>) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
      <span style={{ fontSize: 11, fontWeight: 700, color: 'rgba(255,255,255,0.28)', textTransform: 'uppercase', letterSpacing: '0.09em' }}>{label}</span>
      {actionLabel && actionHref && (
        <Link href={actionHref} style={{ fontSize: 12, fontWeight: 600, color: 'rgba(34,211,238,0.65)', textDecoration: 'none' }}>
          {actionLabel} →
        </Link>
      )}
    </div>
  )
}

// ─── Page ─────────────────────────────────────────────────────
export default function DashboardPage() {
  const { activeVehicle, vehicles, fetchVehicles }                         = useVehicleStore()
  const { session, currentPhase, checklistItems, aiResults, initSession }  = useInspectionStore()
  const { fetchPurchaseHistory, purchaseHistory }                          = usePaymentStore()

  useEffect(() => { fetchVehicles(); fetchPurchaseHistory() }, [])
  useEffect(() => {
    const id = activeVehicle?.id
    if (id && session === null) initSession(id)
  }, [activeVehicle?.id])

  const pendingCount = checklistItems.filter(i => i.status === 'PENDING').length
  const total     = checklistItems.length
  const checked   = total - pendingCount
  const progress  = total > 0 ? Math.round((checked / total) * 100) : 0
  const latestAI  = aiResults[0] ?? null
  const aiScore   = latestAI?.overallScore ?? null
  const paidCount = purchaseHistory.filter(p => p.status === 'PAID').length
  const hasNoPremiumReports = paidCount === 0

  return (
    <AppShell>
      <div style={{ maxWidth: 680, display: 'flex', flexDirection: 'column', gap: 16 }}>

        {/* ══ Hero card ══════════════════════════════════════════ */}
        <div style={{
          borderRadius: 20, overflow: 'hidden',
          background: 'linear-gradient(135deg, rgba(34,211,238,0.07) 0%, rgba(129,140,248,0.05) 100%)',
          border: '1px solid rgba(34,211,238,0.14)',
          padding: '20px',
          position: 'relative',
        }}>
          {/* Glow orb */}
          <div style={{ position: 'absolute', top: -30, right: -30, width: 160, height: 160, borderRadius: '50%', background: 'radial-gradient(circle, rgba(34,211,238,0.08), transparent)', pointerEvents: 'none' }} />

          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, position: 'relative' }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              {activeVehicle ? (
                <>
                  <div style={{ fontSize: 10, fontWeight: 700, color: '#22d3ee', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 4 }}>
                    Active Vehicle
                  </div>
                  <div style={{ fontSize: 19, fontWeight: 900, color: '#fff', letterSpacing: '-0.6px', lineHeight: 1.15, marginBottom: 4 }}>
                    {activeVehicle.year} {activeVehicle.make} {activeVehicle.model}
                  </div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, fontSize: 12, color: 'rgba(255,255,255,0.38)' }}>
                    {activeVehicle.mileage && <span>{activeVehicle.mileage.toLocaleString()} km</span>}
                    {activeVehicle.askingPrice && <span>{activeVehicle.askingPrice.toLocaleString()} {activeVehicle.currency}</span>}
                    {activeVehicle.vin && <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11 }}>{activeVehicle.vin.slice(0, 8)}…</span>}
                  </div>
                </>
              ) : (
                <>
                  <div style={{ fontSize: 18, fontWeight: 800, color: '#fff', marginBottom: 6, letterSpacing: '-0.5px' }}>Get started</div>
                  <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.4)', lineHeight: 1.55 }}>Add a vehicle to begin your AI inspection.</div>
                </>
              )}
            </div>

            {/* Score or vehicle count */}
            {aiScore ? (
              <ScoreRing score={aiScore} />
            ) : (
              <div style={{
                width: 56, height: 56, borderRadius: 16, flexShrink: 0,
                ...glassAccent,
                display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
              }}>
                <div style={{ fontSize: 20, fontWeight: 900, color: '#22d3ee', lineHeight: 1 }}>{vehicles.length}</div>
                <div style={{ fontSize: 9, color: 'rgba(255,255,255,0.3)', textTransform: 'uppercase', letterSpacing: '0.05em', marginTop: 1 }}>cars</div>
              </div>
            )}
          </div>

          {/* Progress bar */}
          {session && (
            <div style={{ marginTop: 16, marginBottom: 16 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: 'rgba(255,255,255,0.32)', marginBottom: 6 }}>
                <span>Phase: {PHASE_LABELS[currentPhase] ?? currentPhase}</span>
                <span style={{ color: '#22d3ee', fontWeight: 700 }}>{progress}%</span>
              </div>
              <div style={{ height: 4, background: 'rgba(255,255,255,0.06)', borderRadius: 4, overflow: 'hidden' }}>
                <div style={{ height: '100%', width: `${progress}%`, background: 'linear-gradient(90deg, #22d3ee, #818cf8)', borderRadius: 4, transition: 'width 0.6s ease' }}/>
              </div>
            </div>
          )}

          {/* CTA row */}
          <div style={{ display: 'flex', gap: 8, marginTop: session ? 0 : 16 }}>
            <Link href="/inspection" style={{
              flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7,
              padding: '13px 16px',
              background: 'linear-gradient(135deg, #22d3ee, #06b6d4)',
              color: '#050810', borderRadius: 13,
              fontSize: 13, fontWeight: 800, textDecoration: 'none',
              boxShadow: '0 4px 20px rgba(34,211,238,0.28)',
              transition: 'all 0.15s',
            }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
              </svg>
              {session ? 'Continue Inspection' : 'Start Inspection'}
            </Link>
            <Link href="/vehicle" style={{
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              padding: '13px 14px',
              ...glass, borderRadius: 13,
              textDecoration: 'none', color: 'rgba(255,255,255,0.5)',
              transition: 'all 0.15s',
            }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
              </svg>
            </Link>
          </div>
        </div>

        {/* ══ Stats row ══════════════════════════════════════════ */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
          <StatCard
            value={vehicles.length}
            label="Vehicles"
            href="/vehicle"
            color="#22d3ee"
            icon={<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M5 17H3a2 2 0 0 1-2-2V9a2 2 0 0 1 2-2h13l4 4v4a2 2 0 0 1-2 2h-2"/><circle cx="7.5" cy="17.5" r="2.5"/><circle cx="17.5" cy="17.5" r="2.5"/></svg>}
          />
          <StatCard
            value={progress > 0 ? `${progress}%` : '—'}
            label="Progress"
            href="/inspection"
            color="#818cf8"
            icon={<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg>}
          />
          <StatCard
            value={paidCount}
            label="Reports"
            href="/premium"
            color="#a855f7"
            icon={<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>}
          />
        </div>

        {/* ══ Checklist mini-breakdown ════════════════════════════ */}
        {session && total > 0 && (
          <div style={{ ...glass, borderRadius: 18, padding: '16px' }}>
            <SectionHeader label="Inspection Breakdown" actionLabel="Continue" actionHref="/inspection" />
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
              {[
                { label: 'Total',  value: total,           color: 'rgba(255,255,255,0.55)' },
                { label: 'Done',   value: checked,         color: '#22c55e' },
                { label: 'Left',   value: total - checked, color: '#f59e0b' },
              ].map(item => (
                <div key={item.label} style={{
                  padding: '11px 10px',
                  background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)',
                  borderRadius: 12, textAlign: 'center',
                }}>
                  <div style={{ fontSize: 18, fontWeight: 800, color: item.color, lineHeight: 1 }}>{item.value}</div>
                  <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.28)', marginTop: 3, fontWeight: 500 }}>{item.label}</div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ══ AI signals ═════════════════════════════════════════ */}
        {latestAI && latestAI.findings.length > 0 && (
          <div style={{ ...glass, borderRadius: 18, padding: '16px' }}>
            <SectionHeader label="AI Risk Signals" actionLabel="Full Report" actionHref="/report" />
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              {latestAI.findings.slice(0, 4).map((f, i) => (
                <div key={f.id ?? `finding-${i}`} style={{
                  display: 'flex', alignItems: 'flex-start', gap: 12,
                  padding: '10px 0',
                  borderBottom: i < 3 ? '1px solid rgba(255,255,255,0.05)' : 'none',
                }}>
                  <div style={{
                    width: 8, height: 8, borderRadius: '50%', flexShrink: 0, marginTop: 4,
                    background: severityColor(f.severity),
                    boxShadow: `0 0 6px ${severityColor(f.severity)}60`,
                  }} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13, fontWeight: 500, color: 'rgba(255,255,255,0.8)', lineHeight: 1.3 }}>
                      {f.title ?? f.area}
                    </div>
                    {f.description && (
                      <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.35)', marginTop: 2, lineHeight: 1.45 }}>
                        {f.description}
                      </div>
                    )}
                  </div>
                  <span style={{
                    fontSize: 9, fontWeight: 800, letterSpacing: '0.06em', textTransform: 'uppercase',
                    padding: '3px 7px', borderRadius: 5, flexShrink: 0,
                    color: severityColor(f.severity),
                    background: `${severityColor(f.severity)}12`,
                    border: `1px solid ${severityColor(f.severity)}25`,
                  }}>
                    {f.severity}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ══ Quick actions ═══════════════════════════════════════ */}
        <div>
          <SectionHeader label="Quick Actions" />
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
            {([
              { label: 'View Report',    sub: 'Confidence verdict',  href: '/report',    color: '#22d3ee',
                icon: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg> },
              { label: 'Add Vehicle',    sub: 'Track a new car',     href: '/vehicle',   color: '#818cf8',
                icon: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg> },
              { label: 'Premium',        sub: 'Unlock history data', href: '/premium',   color: '#a855f7',
                icon: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg> },
              { label: 'Community',      sub: 'Advice from buyers',  href: '/community', color: '#22c55e',
                icon: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg> },
            ] as const).map(action => (
              <Link key={action.href} href={action.href} style={{ textDecoration: 'none' }}>
                <div style={{
                  ...glass, borderRadius: 16, padding: '14px',
                  display: 'flex', flexDirection: 'column', gap: 8,
                  cursor: 'pointer', transition: 'all 0.15s',
                  minHeight: 88,
                }}>
                  <div style={{
                    width: 32, height: 32, borderRadius: 10,
                    background: `${action.color}10`, border: `1px solid ${action.color}22`,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    color: action.color,
                  }}>
                    {action.icon}
                  </div>
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 700, color: '#fff', marginBottom: 2, letterSpacing: '-0.1px' }}>{action.label}</div>
                    <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.32)', fontWeight: 400 }}>{action.sub}</div>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </div>

        {/* ══ Vehicles list ══════════════════════════════════════ */}
        {vehicles.length > 0 && (
          <div>
            <SectionHeader label="Your Vehicles" actionLabel="Manage" actionHref="/vehicle" />
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {vehicles.slice(0, 3).map(v => {
                const isActive = v.id === activeVehicle?.id
                return (
                  <div key={v.id} style={{
                    padding: '14px 16px', borderRadius: 14,
                    background: isActive ? 'rgba(34,211,238,0.04)' : 'rgba(255,255,255,0.025)',
                    border: `1px solid ${isActive ? 'rgba(34,211,238,0.16)' : 'rgba(255,255,255,0.07)'}`,
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12,
                    transition: 'all 0.15s',
                  }}>
                    <div style={{ minWidth: 0, flex: 1 }}>
                      <div style={{ fontSize: 14, fontWeight: 700, color: '#fff', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', letterSpacing: '-0.2px' }}>
                        {v.year} {v.make} {v.model}
                      </div>
                      <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.3)', marginTop: 2 }}>
                        {v.mileage ? `${v.mileage.toLocaleString()} km` : 'No mileage recorded'}
                        {v.askingPrice ? <span> · {v.askingPrice.toLocaleString()} {v.currency}</span> : null}
                      </div>
                    </div>
                    {isActive && (
                      <span style={{
                        fontSize: 9, fontWeight: 800, padding: '3px 8px',
                        background: 'rgba(34,211,238,0.1)', border: '1px solid rgba(34,211,238,0.22)',
                        borderRadius: 5, color: '#22d3ee', textTransform: 'uppercase', letterSpacing: '0.07em', flexShrink: 0,
                      }}>
                        Active
                      </span>
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {/* ══ Premium upsell ═════════════════════════════════════ */}
        {hasNoPremiumReports && activeVehicle && (
          <div style={{
            padding: '18px', borderRadius: 18,
            background: 'linear-gradient(135deg, rgba(168,85,247,0.07), rgba(34,211,238,0.04))',
            border: '1px solid rgba(168,85,247,0.18)',
            display: 'flex', alignItems: 'center', gap: 14,
          }}>
            <div style={{
              width: 44, height: 44, borderRadius: 13, flexShrink: 0,
              background: 'rgba(168,85,247,0.1)', border: '1px solid rgba(168,85,247,0.2)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#a855f7" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
              </svg>
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 10, fontWeight: 700, color: '#a855f7', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 3 }}>Optional Add-on</div>
              <div style={{ fontSize: 14, fontWeight: 700, color: '#fff', marginBottom: 2, letterSpacing: '-0.2px' }}>Unlock vehicle history</div>
              <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.38)', lineHeight: 1.5 }}>Ownership, accidents, service logs.</div>
            </div>
            <Link href="/premium" style={{
              flexShrink: 0, padding: '10px 14px',
              background: 'rgba(168,85,247,0.12)', border: '1px solid rgba(168,85,247,0.25)',
              borderRadius: 11, fontSize: 12, fontWeight: 700, color: '#a855f7', textDecoration: 'none',
            }}>
              Explore →
            </Link>
          </div>
        )}

        {/* bottom breathing room */}
        <div style={{ height: 8 }} />
      </div>
    </AppShell>
  )
}
