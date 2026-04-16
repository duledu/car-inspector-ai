'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useTranslation } from 'react-i18next'
import { useUserStore, useVehicleStore, usePaymentStore, useInspectionStore } from '@/store'
import AppShell from '../AppShell'

const STATUS_COLOR: Record<string, string> = {
  PAID:    '#22c55e',
  PENDING: '#f59e0b',
  FAILED:  '#ef4444',
}

function StatCard({ label, value, icon }: Readonly<{ label: string; value: string | number; icon: React.ReactNode }>) {
  return (
    <div style={{ padding: '16px 18px', background: 'rgba(255,255,255,0.025)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 13 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
        <div style={{ width: 32, height: 32, borderRadius: 9, background: 'rgba(34,211,238,0.07)', border: '1px solid rgba(34,211,238,0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          {icon}
        </div>
      </div>
      <div style={{ fontSize: 22, fontWeight: 800, color: '#fff', letterSpacing: '-0.5px', lineHeight: 1 }}>{value}</div>
      <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.35)', marginTop: 4 }}>{label}</div>
    </div>
  )
}

export default function ProfilePage() {
  const router          = useRouter()
  const { t }           = useTranslation()
  const { user, logout, updateProfile } = useUserStore()
  const { vehicles }    = useVehicleStore()
  const { purchaseHistory } = usePaymentStore()
  const { session, currentPhase, checklistItems } = useInspectionStore()

  const hasActiveSession = !!session && currentPhase !== 'FINAL_REPORT'
  const pending   = checklistItems.filter(i => i.status === 'PENDING').length
  const total     = checklistItems.length
  const progress  = total > 0 ? Math.round(((total - pending) / total) * 100) : 0

  const [editing,   setEditing]   = useState(false)
  const [name,      setName]      = useState(user?.name ?? '')
  const [saving,    setSaving]    = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)

  const handleLogout = async () => {
    await logout()
    router.push('/auth')
  }

  const handleSave = async () => {
    setSaving(true)
    setSaveError(null)
    try {
      await updateProfile({ name })
      setEditing(false)
    } catch {
      setSaveError(t('profile.failedToSave'))
    } finally {
      setSaving(false)
    }
  }

  const initials = user?.name
    ? user.name.split(' ').map((n: string) => n[0]).slice(0, 2).join('').toUpperCase()
    : 'U'

  const memberSince = user?.createdAt
    ? new Date(user.createdAt).toLocaleDateString(undefined, { year: 'numeric', month: 'long' })
    : 'Not available'

  const paidReports = purchaseHistory.filter(p => p.status === 'PAID').length

  return (
    <AppShell>
      <div style={{ maxWidth: 620, display: 'flex', flexDirection: 'column', gap: 14 }}>

        {/* ── Identity card ── */}
        <div style={{ padding: '24px', background: 'rgba(255,255,255,0.025)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 18 }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 18 }}>

            {/* Avatar */}
            <div style={{
              width: 64, height: 64, borderRadius: '50%', flexShrink: 0,
              background: 'linear-gradient(135deg, rgba(34,211,238,0.25), rgba(129,140,248,0.25))',
              border: '1.5px solid rgba(34,211,238,0.3)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 24, fontWeight: 800, color: '#22d3ee', letterSpacing: '-0.5px',
            }}>
              {initials}
            </div>

            {/* Info */}
            <div style={{ flex: 1, minWidth: 0 }}>
              {editing ? (
                <div>
                  <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 8 }}>
                    <input
                      value={name}
                      onChange={e => setName(e.target.value)}
                      autoFocus
                      style={{ maxWidth: 220 }}
                    />
                    <button
                      onClick={handleSave}
                      disabled={saving}
                      style={{ padding: '9px 16px', background: saving ? 'rgba(34,211,238,0.5)' : '#22d3ee', color: '#000', border: 'none', borderRadius: 8, fontSize: 12, fontWeight: 700, cursor: 'pointer', fontFamily: 'var(--font-sans)', flexShrink: 0 }}
                    >
                      {saving ? '…' : t('common.save')}
                    </button>
                    <button
                      onClick={() => { setEditing(false); setName(user?.name ?? '') }}
                      style={{ padding: '9px 12px', background: 'transparent', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 8, fontSize: 12, color: 'rgba(255,255,255,0.4)', cursor: 'pointer', fontFamily: 'var(--font-sans)', flexShrink: 0 }}
                    >
                      {t('common.cancel')}
                    </button>
                  </div>
                  {saveError && <div style={{ fontSize: 12, color: '#f87171' }}>{saveError}</div>}
                </div>
              ) : (
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
                  <div style={{ fontSize: 18, fontWeight: 700, color: '#fff', letterSpacing: '-0.3px' }}>
                    {user?.name}
                  </div>
                  <button
                    onClick={() => setEditing(true)}
                    style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '4px 10px', background: 'transparent', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 7, fontSize: 11, color: 'rgba(255,255,255,0.35)', cursor: 'pointer', fontFamily: 'var(--font-sans)' }}
                  >
                    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
                      <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
                    </svg>
                    {t('common.edit')}
                  </button>
                </div>
              )}

              <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.42)' }}>{user?.email}</div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 8 }}>
                <span style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', padding: '2px 8px', background: 'rgba(34,211,238,0.08)', border: '1px solid rgba(34,211,238,0.18)', borderRadius: 5, color: '#22d3ee' }}>
                  {user?.role ?? 'USER'}
                </span>
                <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.22)' }}>{t('profile.memberSince', { date: memberSince })}</span>
              </div>
            </div>
          </div>
        </div>

        {/* ── Active inspection ── */}
        {hasActiveSession && (
          <Link href="/inspection" style={{ textDecoration: 'none' }}>
            <div style={{
              padding: '14px 16px',
              background: 'linear-gradient(135deg, rgba(34,211,238,0.09) 0%, rgba(129,140,248,0.05) 100%)',
              border: '1px solid rgba(34,211,238,0.25)',
              borderRadius: 14,
              display: 'flex', alignItems: 'center', gap: 14,
            }}>
              <div style={{
                width: 38, height: 38, borderRadius: 11, flexShrink: 0,
                background: 'rgba(34,211,238,0.1)', border: '1px solid rgba(34,211,238,0.22)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#22d3ee" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                  <polygon points="5 3 19 12 5 21 5 3"/>
                </svg>
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 10, fontWeight: 800, color: '#22d3ee', textTransform: 'uppercase', letterSpacing: '0.12em', marginBottom: 2 }}>
                  {t('profile.activeInspection')}
                </div>
                <div style={{ fontSize: 13, fontWeight: 700, color: '#fff', letterSpacing: '-0.1px' }}>
                  {t(`phase.${currentPhase}`, { defaultValue: currentPhase })}
                </div>
                <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.38)', marginTop: 1 }}>
                  {progress}% {t('dashboard.resumeComplete')}
                </div>
              </div>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="rgba(34,211,238,0.45)" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
                <polyline points="9 18 15 12 9 6"/>
              </svg>
            </div>
          </Link>
        )}

        {/* ── Stats ── */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))', gap: 10 }}>
          <StatCard
            label={t('profile.vehiclesTracked')}
            value={vehicles.length || 0}
            icon={<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#22d3ee" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M5 17H3a2 2 0 0 1-2-2V9a2 2 0 0 1 2-2h13l4 4v4a2 2 0 0 1-2 2h-2"/><circle cx="7.5" cy="17.5" r="2.5"/><circle cx="17.5" cy="17.5" r="2.5"/></svg>}
          />
          <StatCard
            label={t('profile.premiumReports')}
            value={paidReports}
            icon={<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#22d3ee" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>}
          />
          <StatCard
            label={t('profile.accountRole')}
            value={user?.role === 'ADMIN' ? t('common.admin') : t('common.member')}
            icon={<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#22d3ee" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>}
          />
        </div>

        {/* ── Purchase history ── */}
        {purchaseHistory.length > 0 && (
          <div style={{ padding: '20px', background: 'rgba(255,255,255,0.025)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 16 }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: 'rgba(255,255,255,0.35)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 14 }}>
              {t('profile.purchaseHistory')}
            </div>
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              {purchaseHistory.map(p => (
                <div key={p.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '11px 0', borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                  <div>
                    <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.72)', fontWeight: 500 }}>
                      {p.productType === 'CARVERTICAL_REPORT' ? t('profile.carverticalReport') : p.productType}
                    </div>
                    <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.28)', marginTop: 2 }}>
                      {p.purchasedAt ? new Date(p.purchasedAt).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' }) : t('common.pending')}
                    </div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: 13, fontWeight: 600, color: '#fff' }}>
                      {(p.amountCents / 100).toFixed(2)} {p.currency}
                    </div>
                    <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: STATUS_COLOR[p.status] ?? 'rgba(255,255,255,0.3)', marginTop: 2 }}>
                      {p.status === 'PAID' ? t('common.paid') : p.status === 'PENDING' ? t('common.pending') : t('common.failed')}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Legal links */}
        <div style={{ padding: '18px 20px', background: 'rgba(255,255,255,0.025)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 14 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: 'rgba(255,255,255,0.35)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 12 }}>
            {t('profile.legal')}
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
            <Link href="/legal/privacy" style={{ fontSize: 13, color: '#22d3ee', textDecoration: 'none' }}>
              {t('nav.privacy')}
            </Link>
            <Link href="/legal/terms" style={{ fontSize: 13, color: '#22d3ee', textDecoration: 'none' }}>
              {t('nav.terms')}
            </Link>
            <Link href="/legal/account-deletion" style={{ fontSize: 13, color: '#22d3ee', textDecoration: 'none' }}>
              {t('nav.accountDeletion')}
            </Link>
          </div>
        </div>

        {/* ── Danger zone ── */}
        <div style={{ padding: '18px 20px', background: 'rgba(239,68,68,0.03)', border: '1px solid rgba(239,68,68,0.1)', borderRadius: 14, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16 }}>
          <div>
            <div style={{ fontSize: 14, fontWeight: 600, color: 'rgba(255,255,255,0.65)' }}>{t('profile.signOut')}</div>
            <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.28)', marginTop: 3 }}>
              {t('profile.signOutDesc')}
            </div>
          </div>
          <button
            onClick={handleLogout}
            style={{
              display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0,
              padding: '9px 18px', background: 'transparent',
              border: '1px solid rgba(239,68,68,0.25)', borderRadius: 9,
              fontSize: 13, fontWeight: 600, color: 'rgba(239,68,68,0.7)',
              cursor: 'pointer', fontFamily: 'var(--font-sans)',
            }}
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/>
              <polyline points="16 17 21 12 16 7"/>
              <line x1="21" y1="12" x2="9" y2="12"/>
            </svg>
            {t('profile.signOut')}
          </button>
        </div>

      </div>
    </AppShell>
  )
}
