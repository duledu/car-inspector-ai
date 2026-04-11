'use client'

import { useEffect } from 'react'
import Link from 'next/link'
import { useTranslation } from 'react-i18next'
import { useVehicleStore, useInspectionStore, usePaymentStore } from '@/store'
import AppShell from '../AppShell'

function severityColor(s: string) {
  if (s === 'critical') return '#ef4444'
  if (s === 'warning')  return '#f59e0b'
  return '#22c55e'
}

/* ── Score ring ─────────────────────────────────────────────── */
function ScoreRing({ score }: Readonly<{ score: number }>) {
  const r    = 28
  const circ = 2 * Math.PI * r
  const off  = circ - (circ * score) / 100
  return (
    <div style={{ position: 'relative', width: 72, height: 72, flexShrink: 0 }}>
      <svg width="72" height="72" viewBox="0 0 72 72" style={{ display: 'block' }}>
        <defs>
          <linearGradient id="ring-grad" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#22d3ee"/>
            <stop offset="100%" stopColor="#818cf8"/>
          </linearGradient>
        </defs>
        <circle cx="36" cy="36" r={r} fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="5"/>
        <circle cx="36" cy="36" r={r} fill="none"
          stroke="url(#ring-grad)" strokeWidth="5"
          strokeLinecap="round"
          strokeDasharray={circ}
          strokeDashoffset={off}
          transform="rotate(-90 36 36)"
          style={{ transition: 'stroke-dashoffset 1s cubic-bezier(0.4,0,0.2,1)' }}
        />
      </svg>
      <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 1 }}>
        <span style={{ fontSize: 17, fontWeight: 900, color: '#fff', letterSpacing: '-0.5px', lineHeight: 1 }}>{score}</span>
        <span style={{ fontSize: 8, fontWeight: 700, color: 'rgba(255,255,255,0.28)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>AI</span>
      </div>
    </div>
  )
}

/* ── Section label ──────────────────────────────────────────── */
function SectionLabel({ text, action, actionHref }: Readonly<{ text: string; action?: string; actionHref?: string }>) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
      <span style={{ fontSize: 10, fontWeight: 800, color: 'rgba(255,255,255,0.52)', textTransform: 'uppercase', letterSpacing: '0.12em' }}>
        {text}
      </span>
      {action && actionHref && (
        <Link href={actionHref} style={{ fontSize: 11, fontWeight: 600, color: 'rgba(34,211,238,0.6)', textDecoration: 'none', letterSpacing: '-0.1px' }}>
          {action} →
        </Link>
      )}
    </div>
  )
}

/* ── Page ───────────────────────────────────────────────────── */
export default function DashboardPage() {
  const { t } = useTranslation()
  const { activeVehicle, vehicles, fetchVehicles }                        = useVehicleStore()
  const { session, currentPhase, checklistItems, aiResults, initSession } = useInspectionStore()
  const { fetchPurchaseHistory, purchaseHistory }                         = usePaymentStore()

  useEffect(() => { fetchVehicles(); fetchPurchaseHistory() }, [])
  useEffect(() => {
    if (activeVehicle?.id && session === null) initSession(activeVehicle.id)
  }, [activeVehicle?.id])

  const hasActiveSession = !!session && currentPhase !== 'FINAL_REPORT'

  const pending   = checklistItems.filter(i => i.status === 'PENDING').length
  const total     = checklistItems.length
  const checked   = total - pending
  const progress  = total > 0 ? Math.round((checked / total) * 100) : 0
  const latestAI  = aiResults[0] ?? null
  const aiScore   = latestAI?.overallScore ?? null
  const paidCount = purchaseHistory.filter(p => p.status === 'PAID').length

  return (
    <AppShell>
      <div style={{ maxWidth: 680, display: 'flex', flexDirection: 'column', gap: 20 }}>

        {/* ══ Resume inspection banner ═══════════════════════════ */}
        {hasActiveSession && (
          <Link href="/inspection" style={{ textDecoration: 'none' }}>
            <div style={{
              padding: '14px 16px',
              background: 'linear-gradient(135deg, rgba(34,211,238,0.10) 0%, rgba(129,140,248,0.06) 100%)',
              border: '1px solid rgba(34,211,238,0.28)',
              borderRadius: 16,
              display: 'flex', alignItems: 'center', gap: 14,
              boxShadow: '0 0 24px rgba(34,211,238,0.08)',
            }}>
              <div style={{
                width: 40, height: 40, borderRadius: 12, flexShrink: 0,
                background: 'rgba(34,211,238,0.12)', border: '1px solid rgba(34,211,238,0.25)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#22d3ee" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                  <polygon points="5 3 19 12 5 21 5 3"/>
                </svg>
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 10, fontWeight: 800, color: '#22d3ee', textTransform: 'uppercase', letterSpacing: '0.12em', marginBottom: 3 }}>
                  {t('dashboard.resumeBadge')}
                </div>
                <div style={{ fontSize: 14, fontWeight: 700, color: '#fff', letterSpacing: '-0.2px' }}>
                  {t('dashboard.resumeTitle')}
                </div>
                <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.4)', marginTop: 2 }}>
                  {t(`phase.${currentPhase}`, { defaultValue: currentPhase })} · {progress}% {t('dashboard.resumeComplete')}
                </div>
              </div>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="rgba(34,211,238,0.5)" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
                <polyline points="9 18 15 12 9 6"/>
              </svg>
            </div>
          </Link>
        )}

        {/* ══ Hero card — 3D glass ════════════════════════════════ */}
        <div className="glass-card-wrap">
          <div className="glass-card-glow" />
          <div
            className="premium-glass-card"
            style={{
              padding: '22px 20px 20px',
              background: 'linear-gradient(135deg, rgba(34,211,238,0.07) 0%, rgba(129,140,248,0.04) 55%, rgba(168,85,247,0.03) 100%)',
              border: '1px solid rgba(34,211,238,0.18)',
            }}
          >

          {/* Top row */}
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 14, position: 'relative', marginBottom: 18 }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              {activeVehicle ? (
                <>
                  <div style={{ fontSize: 10, fontWeight: 800, color: '#22d3ee', textTransform: 'uppercase', letterSpacing: '0.12em', marginBottom: 5 }}>
                    {t('dashboard.activeVehicle')}
                  </div>
                  <div style={{ fontSize: 20, fontWeight: 900, color: '#fff', letterSpacing: '-0.7px', lineHeight: 1.15, marginBottom: 6 }}>
                    {activeVehicle.year} {activeVehicle.make} {activeVehicle.model}
                  </div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12 }}>
                    {activeVehicle.mileage && (
                      <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.62)' }}>{activeVehicle.mileage.toLocaleString()} km</span>
                    )}
                    {activeVehicle.askingPrice && (
                      <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.62)' }}>
                        {activeVehicle.askingPrice.toLocaleString()} {activeVehicle.currency}
                      </span>
                    )}
                    {activeVehicle.vin && (
                      <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.48)', fontFamily: 'var(--font-mono)' }}>
                        {activeVehicle.vin.slice(0, 8)}…
                      </span>
                    )}
                  </div>
                </>
              ) : (
                <>
                  <div style={{ fontSize: 19, fontWeight: 800, color: '#fff', marginBottom: 7, letterSpacing: '-0.5px' }}>
                    {t('dashboard.getStarted')}
                  </div>
                  <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.62)', lineHeight: 1.6, maxWidth: 280 }}>
                    {t('dashboard.getStartedSub')}
                  </div>
                </>
              )}
            </div>

            {/* Score / vehicle count */}
            {aiScore ? (
              <ScoreRing score={aiScore} />
            ) : (
              <div style={{
                width: 60, height: 60, borderRadius: 18, flexShrink: 0,
                background: 'rgba(34,211,238,0.07)', border: '1px solid rgba(34,211,238,0.15)',
                display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 2,
              }}>
                <div style={{ fontSize: 22, fontWeight: 900, color: '#22d3ee', lineHeight: 1, letterSpacing: '-1px' }}>
                  {vehicles.length}
                </div>
                <div style={{ fontSize: 9, color: 'rgba(255,255,255,0.55)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                  {t('common.cars')}
                </div>
              </div>
            )}
          </div>

          {/* Progress */}
          {session && (
            <div style={{ marginBottom: 16 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 7 }}>
                <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.52)' }}>
                  {t('dashboard.phase')}: <span style={{ color: 'rgba(255,255,255,0.82)', fontWeight: 500 }}>{t(`phase.${currentPhase}`, { defaultValue: currentPhase })}</span>
                </span>
                <span style={{ fontSize: 12, fontWeight: 700, color: '#22d3ee' }}>{progress}%</span>
              </div>
              <div style={{ height: 4, background: 'rgba(255,255,255,0.06)', borderRadius: 4, overflow: 'hidden' }}>
                <div style={{
                  height: '100%', width: `${progress}%`,
                  background: 'linear-gradient(90deg, #22d3ee, #818cf8)',
                  borderRadius: 4, transition: 'width 0.7s cubic-bezier(0.4,0,0.2,1)',
                  boxShadow: '0 0 8px rgba(34,211,238,0.4)',
                }}/>
              </div>
            </div>
          )}

          {/* CTAs */}
          <div style={{ display: 'flex', gap: 8, position: 'relative' }}>
            <Link href="/inspection" style={{
              flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7,
              padding: '13px 16px',
              background: 'linear-gradient(135deg, #22d3ee 0%, #06b6d4 100%)',
              color: '#040d14', borderRadius: 14,
              fontSize: 13, fontWeight: 800, textDecoration: 'none',
              boxShadow: '0 4px 20px rgba(34,211,238,0.3), 0 1px 3px rgba(0,0,0,0.3)',
              letterSpacing: '-0.1px',
            }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
              </svg>
              {session ? t('dashboard.continueInspection') : t('dashboard.startInspection')}
            </Link>
            <Link href="/vehicle" style={{
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              padding: '13px 15px',
              background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)',
              borderRadius: 14, textDecoration: 'none', color: 'rgba(255,255,255,0.55)',
            }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
              </svg>
            </Link>
          </div>
          </div>{/* /premium-glass-card */}
        </div>{/* /glass-card-wrap */}

        {/* ══ Stats row ══════════════════════════════════════════ */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10 }}>
          {[
            {
              value: vehicles.length, labelKey: 'dashboard.vehicles', href: '/vehicle', color: '#22d3ee',
              icon: <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M5 17H3a2 2 0 0 1-2-2V9a2 2 0 0 1 2-2h13l4 4v4a2 2 0 0 1-2 2h-2"/><circle cx="7.5" cy="17.5" r="2.5"/><circle cx="17.5" cy="17.5" r="2.5"/></svg>,
            },
            {
              value: progress > 0 ? `${progress}%` : '—', labelKey: 'dashboard.progress', href: '/inspection', color: '#818cf8',
              icon: <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg>,
            },
            {
              value: paidCount, labelKey: 'dashboard.reports', href: '/premium', color: '#a855f7',
              icon: <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>,
            },
          ].map(s => (
            <Link key={s.href} href={s.href} style={{ textDecoration: 'none' }} className="card-hover">
              <div style={{
                padding: '14px 12px',
                background: 'rgba(255,255,255,0.03)',
                border: '1px solid rgba(255,255,255,0.07)',
                borderRadius: 16,
                display: 'flex', flexDirection: 'column', gap: 10,
              }}>
                <div style={{
                  width: 30, height: 30, borderRadius: 9,
                  background: `${s.color}14`, border: `1px solid ${s.color}28`,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  color: s.color,
                }}>
                  {s.icon}
                </div>
                <div>
                  <div style={{ fontSize: 22, fontWeight: 900, color: '#fff', letterSpacing: '-1px', lineHeight: 1 }}>{s.value}</div>
                  <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.3)', marginTop: 3, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em' }}>{t(s.labelKey)}</div>
                </div>
              </div>
            </Link>
          ))}
        </div>

        {/* ══ Checklist breakdown ════════════════════════════════ */}
        {session && total > 0 && (
          <div>
            <SectionLabel text={t('dashboard.inspectionBreakdown')} action={t('dashboard.continue')} actionHref="/inspection" />
            <div style={{ background: 'rgba(255,255,255,0.025)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 16, padding: '14px', display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
              {[
                { labelKey: 'dashboard.total', value: total,           color: 'rgba(255,255,255,0.5)' },
                { labelKey: 'dashboard.done',  value: checked,         color: '#22c55e' },
                { labelKey: 'dashboard.left',  value: total - checked, color: '#f59e0b' },
              ].map(item => (
                <div key={item.labelKey} style={{ textAlign: 'center', padding: '11px 8px', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.05)', borderRadius: 12 }}>
                  <div style={{ fontSize: 20, fontWeight: 900, color: item.color, lineHeight: 1, letterSpacing: '-0.5px' }}>{item.value}</div>
                  <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.28)', marginTop: 4, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em' }}>{t(item.labelKey)}</div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ══ AI signals ═════════════════════════════════════════ */}
        {latestAI && latestAI.findings.length > 0 && (
          <div>
            <SectionLabel text={t('dashboard.aiRiskSignals')} action={t('dashboard.fullReport')} actionHref="/report" />
            <div style={{ background: 'rgba(255,255,255,0.025)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 16, overflow: 'hidden' }}>
              {latestAI.findings.slice(0, 4).map((f, i, arr) => (
                <div key={f.id ?? `f-${i}`} style={{
                  display: 'flex', alignItems: 'flex-start', gap: 12,
                  padding: '13px 16px',
                  borderBottom: i < arr.length - 1 ? '1px solid rgba(255,255,255,0.05)' : 'none',
                }}>
                  <div style={{
                    width: 7, height: 7, borderRadius: '50%', flexShrink: 0, marginTop: 5,
                    background: severityColor(f.severity),
                    boxShadow: `0 0 6px ${severityColor(f.severity)}70`,
                  }} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13, fontWeight: 600, color: 'rgba(255,255,255,0.82)', lineHeight: 1.3 }}>{f.title ?? f.area}</div>
                    {f.description && (
                      <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.33)', marginTop: 2, lineHeight: 1.5 }}>{f.description}</div>
                    )}
                  </div>
                  <span style={{
                    fontSize: 9, fontWeight: 800, letterSpacing: '0.07em', textTransform: 'uppercase',
                    padding: '3px 7px', borderRadius: 5, flexShrink: 0,
                    color: severityColor(f.severity),
                    background: `${severityColor(f.severity)}14`,
                    border: `1px solid ${severityColor(f.severity)}28`,
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
          <SectionLabel text={t('dashboard.quickActions')} />
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            {([
              { labelKey: 'dashboard.viewReport',  subKey: 'dashboard.viewReportSub',  href: '/report',    color: '#22d3ee',
                icon: <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg> },
              { labelKey: 'dashboard.addVehicle',  subKey: 'dashboard.addVehicleSub',  href: '/vehicle',   color: '#818cf8',
                icon: <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><path d="M5 17H3a2 2 0 0 1-2-2V9a2 2 0 0 1 2-2h13l4 4v4a2 2 0 0 1-2 2h-2"/><circle cx="7.5" cy="17.5" r="2.5"/><circle cx="17.5" cy="17.5" r="2.5"/></svg> },
              { labelKey: 'dashboard.premium',     subKey: 'dashboard.premiumSub',     href: '/premium',   color: '#a855f7',
                icon: <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg> },
              { labelKey: 'dashboard.community',   subKey: 'dashboard.communitySub',   href: '/community', color: '#22c55e',
                icon: <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg> },
            ] as const).map(action => (
              <Link key={action.href} href={action.href} style={{ textDecoration: 'none' }} className="card-hover">
                <div style={{
                  background: 'rgba(255,255,255,0.025)', border: '1px solid rgba(255,255,255,0.07)',
                  borderRadius: 16, padding: '16px 14px',
                  display: 'flex', flexDirection: 'column', gap: 10, minHeight: 96,
                }}>
                  <div style={{
                    width: 34, height: 34, borderRadius: 11,
                    background: `${action.color}12`, border: `1px solid ${action.color}25`,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    color: action.color,
                  }}>
                    {action.icon}
                  </div>
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 700, color: '#fff', marginBottom: 3, letterSpacing: '-0.1px' }}>{t(action.labelKey)}</div>
                    <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.3)' }}>{t(action.subKey)}</div>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </div>

        {/* ══ Vehicles list ══════════════════════════════════════ */}
        {vehicles.length > 0 && (
          <div>
            <SectionLabel text={t('dashboard.yourVehicles')} action={t('common.manage')} actionHref="/vehicle" />
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {vehicles.slice(0, 3).map(v => {
                const isActive = v.id === activeVehicle?.id
                return (
                  <div key={v.id} style={{
                    padding: '14px 16px', borderRadius: 14,
                    background: isActive ? 'rgba(34,211,238,0.05)' : 'rgba(255,255,255,0.025)',
                    border: `1px solid ${isActive ? 'rgba(34,211,238,0.18)' : 'rgba(255,255,255,0.07)'}`,
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12,
                  }}>
                    <div style={{ minWidth: 0, flex: 1 }}>
                      <div style={{ fontSize: 14, fontWeight: 700, color: '#fff', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', letterSpacing: '-0.2px' }}>
                        {v.year} {v.make} {v.model}
                      </div>
                      <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.3)', marginTop: 2 }}>
                        {v.mileage ? `${v.mileage.toLocaleString()} km` : t('common.noMileage')}
                        {v.askingPrice ? ` · ${v.askingPrice.toLocaleString()} ${v.currency}` : ''}
                      </div>
                    </div>
                    {isActive && (
                      <span style={{
                        fontSize: 9, fontWeight: 800, padding: '3px 8px',
                        background: 'rgba(34,211,238,0.1)', border: '1px solid rgba(34,211,238,0.22)',
                        borderRadius: 6, color: '#22d3ee', textTransform: 'uppercase', letterSpacing: '0.08em', flexShrink: 0,
                      }}>
                        {t('common.active')}
                      </span>
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {/* ══ Premium upsell ═════════════════════════════════════ */}
        {paidCount === 0 && activeVehicle && (
          <div style={{
            padding: '18px', borderRadius: 18,
            background: 'linear-gradient(135deg, rgba(168,85,247,0.08), rgba(34,211,238,0.04))',
            border: '1px solid rgba(168,85,247,0.2)',
            display: 'flex', alignItems: 'center', gap: 14,
          }}>
            <div style={{
              width: 44, height: 44, borderRadius: 13, flexShrink: 0,
              background: 'rgba(168,85,247,0.1)', border: '1px solid rgba(168,85,247,0.22)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#a855f7" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
              </svg>
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 10, fontWeight: 800, color: '#a855f7', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 3 }}>
                {t('dashboard.optionalAddOn')}
              </div>
              <div style={{ fontSize: 14, fontWeight: 700, color: '#fff', marginBottom: 3, letterSpacing: '-0.2px' }}>{t('dashboard.unlockHistory')}</div>
              <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.38)', lineHeight: 1.5 }}>{t('dashboard.unlockHistorySub')}</div>
            </div>
            <Link href="/premium" style={{
              flexShrink: 0, padding: '10px 14px',
              background: 'rgba(168,85,247,0.12)', border: '1px solid rgba(168,85,247,0.28)',
              borderRadius: 11, fontSize: 12, fontWeight: 700, color: '#a855f7', textDecoration: 'none',
              whiteSpace: 'nowrap',
            }}>
              {t('common.explore')}
            </Link>
          </div>
        )}

        <div style={{ height: 4 }} />
      </div>
    </AppShell>
  )
}
