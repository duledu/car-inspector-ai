'use client'

import { useEffect } from 'react'
import Link from 'next/link'
import { useVehicleStore, useInspectionStore, usePaymentStore } from '@/store'
import AppShell from '../AppShell'

function severityColor(s: string): string {
  if (s === 'critical') return '#ef4444'
  if (s === 'warning')  return '#f59e0b'
  return '#22c55e'
}

function SeverityDot({ s }: Readonly<{ s: string }>) {
  return <span style={{ display: 'inline-block', width: 7, height: 7, borderRadius: '50%', background: severityColor(s), flexShrink: 0 }} />
}

export default function DashboardPage() {
  const { activeVehicle, vehicles, fetchVehicles } = useVehicleStore()
  const { session, currentPhase, checklistItems, aiResults, initSession } = useInspectionStore()
  const { fetchPurchaseHistory, purchaseHistory } = usePaymentStore()

  useEffect(() => {
    fetchVehicles()
    fetchPurchaseHistory()
  }, [])

  useEffect(() => {
    if (activeVehicle?.id && !session) initSession(activeVehicle.id)
  }, [activeVehicle?.id])

  const checked   = checklistItems.filter(i => i.status !== 'PENDING').length
  const total     = checklistItems.length
  const progress  = total > 0 ? Math.round((checked / total) * 100) : 0
  const latestAI  = aiResults[0] ?? null
  const aiScore   = latestAI?.overallScore ?? null
  const paidCount = purchaseHistory.filter(p => p.status === 'PAID').length

  const PHASE_LABELS: Record<string, string> = {
    PRE_SCREENING: 'Pre-Screening', AI_PHOTOS: 'Photos', EXTERIOR: 'Exterior',
    INTERIOR: 'Interior', MECHANICAL: 'Mechanical', TEST_DRIVE: 'Test Drive',
    VIN_DOCS: 'Documents', RISK_ANALYSIS: 'AI Analysis', FINAL_REPORT: 'Complete',
  }

  return (
    <AppShell>
      <div style={{ maxWidth: 680, display: 'flex', flexDirection: 'column', gap: 14 }}>

        {/* ── Hero start card ── */}
        <div style={{
          borderRadius: 18, overflow: 'hidden',
          background: 'linear-gradient(135deg, rgba(34,211,238,0.08), rgba(129,140,248,0.06))',
          border: '1px solid rgba(34,211,238,0.15)',
          padding: '20px 20px 16px',
        }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              {activeVehicle ? (
                <>
                  <div style={{ fontSize: 10, fontWeight: 700, color: '#22d3ee', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 4 }}>Active Vehicle</div>
                  <div style={{ fontSize: 18, fontWeight: 800, color: '#fff', letterSpacing: '-0.4px', lineHeight: 1.2 }}>
                    {activeVehicle.year} {activeVehicle.make} {activeVehicle.model}
                  </div>
                  {activeVehicle.vin && (
                    <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.3)', marginTop: 4, fontFamily: 'var(--font-mono)' }}>
                      {activeVehicle.vin}
                    </div>
                  )}
                  <div style={{ display: 'flex', gap: 12, marginTop: 6, fontSize: 12, color: 'rgba(255,255,255,0.4)' }}>
                    {activeVehicle.mileage != null && (
                      <span>{activeVehicle.mileage.toLocaleString()} km</span>
                    )}
                    {activeVehicle.askingPrice != null && (
                      <span>{activeVehicle.askingPrice.toLocaleString()} {activeVehicle.currency}</span>
                    )}
                  </div>
                </>
              ) : (
                <>
                  <div style={{ fontSize: 17, fontWeight: 700, color: '#fff', marginBottom: 4 }}>Get started</div>
                  <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.38)', lineHeight: 1.5 }}>Add a vehicle to begin your AI inspection.</div>
                </>
              )}
            </div>

            {/* Score ring or vehicle count */}
            {aiScore != null ? (
              <div style={{ flexShrink: 0, textAlign: 'center' }}>
                <svg width="60" height="60" viewBox="0 0 60 60">
                  <circle cx="30" cy="30" r="24" fill="none" stroke="rgba(34,211,238,0.1)" strokeWidth="4" />
                  <circle
                    cx="30" cy="30" r="24"
                    fill="none" stroke="#22d3ee" strokeWidth="4"
                    strokeLinecap="round"
                    strokeDasharray="150.8"
                    strokeDashoffset={150.8 - (150.8 * aiScore / 100)}
                    transform="rotate(-90 30 30)"
                    style={{ transition: 'stroke-dashoffset 0.8s ease' }}
                  />
                  <text x="30" y="35" textAnchor="middle" fontSize="14" fontWeight="800" fill="#fff">{aiScore}</text>
                </svg>
                <div style={{ fontSize: 9, color: 'rgba(255,255,255,0.3)', marginTop: 2, textTransform: 'uppercase', letterSpacing: '0.06em' }}>AI Score</div>
              </div>
            ) : (
              <div style={{
                width: 52, height: 52, borderRadius: 14, flexShrink: 0,
                background: 'rgba(34,211,238,0.07)', border: '1px solid rgba(34,211,238,0.14)',
                display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
              }}>
                <div style={{ fontSize: 18, fontWeight: 800, color: '#22d3ee', lineHeight: 1 }}>{vehicles.length}</div>
                <div style={{ fontSize: 9, color: 'rgba(255,255,255,0.3)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>cars</div>
              </div>
            )}
          </div>

          {/* CTA */}
          <div style={{ display: 'flex', gap: 8, marginTop: 16 }}>
            <Link
              href="/inspection"
              style={{
                flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                padding: '12px 16px', background: '#22d3ee', color: '#000',
                borderRadius: 11, fontSize: 13, fontWeight: 700, textDecoration: 'none',
                boxShadow: '0 4px 16px rgba(34,211,238,0.25)',
              }}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/>
                <circle cx="12" cy="13" r="4"/>
              </svg>
              {session ? 'Continue Inspection' : 'Start Inspection'}
            </Link>
            <Link
              href="/vehicle"
              style={{
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                padding: '12px 14px',
                background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)',
                borderRadius: 11, textDecoration: 'none', color: 'rgba(255,255,255,0.6)',
              }}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
              </svg>
            </Link>
          </div>
        </div>

        {/* ── Stats row ── */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
          {[
            { label: 'Vehicles', value: vehicles.length || 0, href: '/vehicle', icon: '🚗' },
            { label: 'Progress', value: progress > 0 ? `${progress}%` : '—', href: '/inspection', icon: '✓' },
            { label: 'Reports',  value: paidCount || 0, href: '/premium', icon: '★' },
          ].map(s => (
            <Link key={s.label} href={s.href} style={{ textDecoration: 'none' }}>
              <div style={{
                padding: '14px 12px',
                background: 'rgba(255,255,255,0.025)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 12,
                textAlign: 'center',
              }}>
                <div style={{ fontSize: 20, fontWeight: 800, color: '#fff', letterSpacing: '-0.5px', lineHeight: 1 }}>
                  {s.value}
                </div>
                <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.3)', marginTop: 3 }}>{s.label}</div>
              </div>
            </Link>
          ))}
        </div>

        {/* ── Inspection progress card ── */}
        {session && (
          <div style={{ padding: '16px', background: 'rgba(255,255,255,0.025)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 14 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
              <div>
                <div style={{ fontSize: 11, fontWeight: 600, color: 'rgba(255,255,255,0.35)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Inspection</div>
                <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.6)', marginTop: 2 }}>Phase: {PHASE_LABELS[currentPhase] ?? currentPhase}</div>
              </div>
              <span style={{ fontSize: 22, fontWeight: 800, color: '#22d3ee', letterSpacing: '-0.5px' }}>{progress}%</span>
            </div>
            <div style={{ height: 5, background: 'rgba(255,255,255,0.06)', borderRadius: 5, overflow: 'hidden', marginBottom: 10 }}>
              <div style={{ height: '100%', width: `${progress}%`, background: 'linear-gradient(90deg, #22d3ee, #818cf8)', borderRadius: 5, transition: 'width 0.5s ease' }} />
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 6 }}>
              {[
                { label: 'Total',     value: total },
                { label: 'Done',      value: checked },
                { label: 'Left',      value: total - checked },
              ].map(item => (
                <div key={item.label} style={{ padding: '8px 10px', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.05)', borderRadius: 9, textAlign: 'center' }}>
                  <div style={{ fontSize: 16, fontWeight: 700, color: '#fff', lineHeight: 1 }}>{item.value}</div>
                  <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.3)', marginTop: 2 }}>{item.label}</div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── AI signals ── */}
        {latestAI && latestAI.findings.length > 0 && (
          <div style={{ padding: '16px', background: 'rgba(255,255,255,0.025)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 14 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
              <span style={{ fontSize: 11, fontWeight: 600, color: 'rgba(255,255,255,0.35)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>AI Risk Signals</span>
              <Link href="/report" style={{ fontSize: 11, color: 'rgba(34,211,238,0.65)', textDecoration: 'none' }}>Full Report →</Link>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              {latestAI.findings.slice(0, 4).map(f => (
                <div key={f.id ?? f.title ?? f.area} style={{ display: 'flex', alignItems: 'flex-start', gap: 10, padding: '9px 0', borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                  <SeverityDot s={f.severity} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13, fontWeight: 500, color: 'rgba(255,255,255,0.75)', lineHeight: 1.3 }}>{f.title ?? f.area}</div>
                    {f.description && (
                      <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.35)', marginTop: 2, lineHeight: 1.4 }}>{f.description}</div>
                    )}
                  </div>
                  <span style={{ fontSize: 9, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', color: f.severity === 'critical' ? '#ef4444' : f.severity === 'warning' ? '#f59e0b' : '#22c55e', flexShrink: 0 }}>
                    {f.severity}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── Quick actions grid ── */}
        <div>
          <div style={{ fontSize: 11, fontWeight: 600, color: 'rgba(255,255,255,0.3)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 10 }}>Quick Actions</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
            {[
              { label: 'View Report',    sub: 'Confidence verdict',      href: '/report',    color: '#22d3ee' },
              { label: 'Add Vehicle',    sub: 'Track a new car',          href: '/vehicle',   color: '#818cf8' },
              { label: 'Premium',        sub: 'Unlock history data',      href: '/premium',   color: '#a855f7' },
              { label: 'Community',      sub: 'Advice from buyers',       href: '/community', color: '#22d3ee' },
            ].map(action => (
              <Link
                key={action.href}
                href={action.href}
                style={{
                  padding: '14px 14px',
                  background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.07)',
                  borderRadius: 12, textDecoration: 'none',
                  display: 'flex', flexDirection: 'column', gap: 3,
                }}
              >
                <div style={{ fontSize: 14, fontWeight: 600, color: '#fff' }}>{action.label}</div>
                <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.35)' }}>{action.sub}</div>
              </Link>
            ))}
          </div>
        </div>

        {/* ── Vehicles list ── */}
        {vehicles.length > 0 && (
          <div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
              <div style={{ fontSize: 11, fontWeight: 600, color: 'rgba(255,255,255,0.3)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>All Vehicles</div>
              <Link href="/vehicle" style={{ fontSize: 11, color: 'rgba(34,211,238,0.65)', textDecoration: 'none' }}>Manage →</Link>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {vehicles.slice(0, 3).map(v => (
                <div key={v.id} style={{
                  padding: '14px 16px',
                  background: v.id === activeVehicle?.id ? 'rgba(34,211,238,0.04)' : 'rgba(255,255,255,0.02)',
                  border: `1px solid ${v.id === activeVehicle?.id ? 'rgba(34,211,238,0.15)' : 'rgba(255,255,255,0.07)'}`,
                  borderRadius: 12,
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12,
                }}>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontSize: 14, fontWeight: 600, color: '#fff', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {v.year} {v.make} {v.model}
                    </div>
                    <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.3)', marginTop: 2 }}>
                      {v.mileage != null ? `${v.mileage.toLocaleString()} km` : 'No mileage recorded'}
                    </div>
                  </div>
                  {v.id === activeVehicle?.id && (
                    <span style={{ fontSize: 9, fontWeight: 700, padding: '2px 8px', background: 'rgba(34,211,238,0.1)', border: '1px solid rgba(34,211,238,0.2)', borderRadius: 5, color: '#22d3ee', textTransform: 'uppercase', letterSpacing: '0.06em', flexShrink: 0 }}>
                      Active
                    </span>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── Premium upsell ── */}
        {paidCount === 0 && activeVehicle && (
          <div style={{
            padding: '16px 18px',
            background: 'linear-gradient(135deg, rgba(168,85,247,0.06), rgba(34,211,238,0.04))',
            border: '1px solid rgba(168,85,247,0.2)',
            borderRadius: 14,
            display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16,
          }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 10, fontWeight: 700, color: '#a855f7', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 3 }}>Optional Add-on</div>
              <div style={{ fontSize: 14, fontWeight: 600, color: '#fff', marginBottom: 3 }}>Unlock vehicle history</div>
              <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.38)', lineHeight: 1.5 }}>Ownership, accidents, service logs.</div>
            </div>
            <Link href="/premium" style={{
              flexShrink: 0, padding: '10px 16px',
              background: 'rgba(168,85,247,0.12)', border: '1px solid rgba(168,85,247,0.25)',
              borderRadius: 10, fontSize: 12, fontWeight: 600, color: '#a855f7', textDecoration: 'none',
            }}>
              Explore →
            </Link>
          </div>
        )}

      </div>
    </AppShell>
  )
}
