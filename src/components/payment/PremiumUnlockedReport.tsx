'use client'

import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import type { VehicleHistoryResult } from '@/types'
import { apiClient } from '@/services/api/client'

interface Props {
  vehicleId: string
}

export function PremiumUnlockedReport({ vehicleId }: Props) {
  const { t, i18n } = useTranslation()
  const [report, setReport] = useState<VehicleHistoryResult | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!vehicleId) return
    setLoading(true)
    apiClient
      .get<{ data: VehicleHistoryResult }>(`/premium/report/${vehicleId}`)
      .then((res) => {
        setReport(res.data.data)
        setLoading(false)
      })
      .catch((err) => {
        setError(err?.message ?? t('premiumPage.unlocked.loadError'))
        setLoading(false)
      })
  }, [vehicleId, t])

  if (loading) {
    return (
      <div style={{ textAlign: 'center', padding: '60px 24px' }}>
        <div
          style={{
            width: 36,
            height: 36,
            border: '3px solid rgba(34,211,238,0.2)',
            borderTopColor: '#22d3ee',
            borderRadius: '50%',
            animation: 'spin 0.8s linear infinite',
            margin: '0 auto 16px',
          }}
        />
        <div style={{ fontSize: 14, color: 'rgba(255,255,255,0.4)' }}>{t('premiumPage.unlocked.loading')}</div>
      </div>
    )
  }

  if (error || !report) {
    return (
      <div
        style={{
          padding: '40px 24px',
          textAlign: 'center',
          background: 'rgba(239,68,68,0.05)',
          border: '1px solid rgba(239,68,68,0.15)',
          borderRadius: 16,
        }}
      >
        <div style={{ width: 48, height: 48, margin: '0 auto 12px', display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: '50%', background: 'rgba(239,68,68,0.07)', border: '1px solid rgba(239,68,68,0.15)' }}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#ef4444" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
        </div>
        <div style={{ fontSize: 15, fontWeight: 600, color: 'rgba(255,255,255,0.8)', marginBottom: 6 }}>
          {t('premiumPage.unlocked.unableTitle')}
        </div>
        <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.4)' }}>{error ?? t('premiumPage.unlocked.unavailable')}</div>
      </div>
    )
  }

  const riskFlagLabels: Record<string, string> = {
    MILEAGE_ROLLBACK: t('premiumPage.unlocked.risk.mileageRollback'),
    ACCIDENT_HISTORY: t('premiumPage.unlocked.risk.accidentHistory'),
    TOTAL_LOSS: t('premiumPage.unlocked.risk.totalLoss'),
    STOLEN: t('premiumPage.unlocked.risk.stolen'),
    OUTSTANDING_FINANCE: t('premiumPage.unlocked.risk.outstandingFinance'),
    IMPORT: t('premiumPage.unlocked.risk.import'),
    TAXI_USE: t('premiumPage.unlocked.risk.taxiUse'),
    FLOOD_DAMAGE: t('premiumPage.unlocked.risk.floodDamage'),
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* Header */}
      <div
        style={{
          padding: '20px 24px',
          background: 'linear-gradient(135deg, rgba(34,211,238,0.06), rgba(99,102,241,0.04))',
          border: '1px solid rgba(34,211,238,0.14)',
          borderRadius: 16,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        <div>
          <div style={{ fontSize: 11, color: '#22d3ee', fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: 4 }}>
            {t('premiumPage.unlocked.header')}
          </div>
          <div style={{ fontSize: 18, fontWeight: 700, color: '#fff' }}>
            {report.year} {report.make} {report.model}
          </div>
          <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.35)', marginTop: 2, fontFamily: 'var(--font-mono)' }}>
            {t('premiumPage.unlocked.vin')}: {report.vin}
          </div>
        </div>
        <div style={{ textAlign: 'right' }}>
          <div
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              padding: '4px 12px',
              background: report.riskFlags.length === 0 ? 'rgba(34,197,94,0.1)' : 'rgba(239,68,68,0.1)',
              border: `1px solid ${report.riskFlags.length === 0 ? 'rgba(34,197,94,0.2)' : 'rgba(239,68,68,0.2)'}`,
              borderRadius: 8,
              fontSize: 12,
              fontWeight: 600,
              color: report.riskFlags.length === 0 ? '#22c55e' : '#ef4444',
            }}
          >
            <span
              style={{
                width: 6,
                height: 6,
                borderRadius: '50%',
                background: report.riskFlags.length === 0 ? '#22c55e' : '#ef4444',
              }}
            />
            {report.riskFlags.length === 0 ? t('premiumPage.unlocked.noRiskFlags') : t('premiumPage.unlocked.riskFlagCount', { count: report.riskFlags.length })}
          </div>
          <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.3)', marginTop: 6 }}>
            {t('premiumPage.unlocked.source')}: {report.dataSource} · {new Date(report.fetchedAt).toLocaleDateString(i18n.language)}
          </div>
        </div>
      </div>

      {/* Risk flags */}
      {report.riskFlags.length > 0 && (
        <div
          style={{
            padding: '16px 20px',
            background: 'rgba(239,68,68,0.05)',
            border: '1px solid rgba(239,68,68,0.15)',
            borderRadius: 14,
          }}
        >
          <div style={{ fontSize: 11, fontWeight: 600, color: '#ef4444', letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: 10 }}>
            {t('premiumPage.unlocked.riskFlags')}
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
            {report.riskFlags.map((flag) => (
              <div key={flag} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: 'rgba(255,255,255,0.7)' }}>
                <span style={{ color: '#ef4444', fontSize: 11 }}>●</span>
                {riskFlagLabels[flag] ?? flag}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Overview grid */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10 }}>
        {[
          { label: t('premiumPage.unlocked.overview.accidents'), value: report.accidentCount.toString(), alert: report.accidentCount > 0 },
          { label: t('premiumPage.unlocked.overview.owners'), value: report.ownershipHistory.length.toString(), alert: false },
          { label: t('premiumPage.unlocked.overview.theftStatus'), value: report.theftStatus === 'clean' ? t('premiumPage.unlocked.value.clean') : t('premiumPage.unlocked.value.reportedStolen'), alert: report.theftStatus !== 'clean' },
          { label: t('premiumPage.unlocked.overview.finance'), value: report.outstandingFinance ? t('premiumPage.unlocked.value.outstanding') : t('premiumPage.unlocked.value.clear'), alert: report.outstandingFinance },
          { label: t('premiumPage.unlocked.overview.totalLoss'), value: report.totalLoss ? t('premiumPage.unlocked.value.yes') : t('premiumPage.unlocked.value.no'), alert: report.totalLoss },
          { label: t('premiumPage.unlocked.overview.recalls'), value: report.recalls.length.toString(), alert: report.recalls.some((r) => r.status === 'incomplete') },
        ].map((item) => (
          <div
            key={item.label}
            style={{
              padding: '14px 16px',
              background: item.alert ? 'rgba(239,68,68,0.05)' : 'rgba(255,255,255,0.02)',
              border: `1px solid ${item.alert ? 'rgba(239,68,68,0.15)' : 'rgba(255,255,255,0.06)'}`,
              borderRadius: 12,
            }}
          >
            <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.35)', marginBottom: 6 }}>{item.label}</div>
            <div style={{ fontSize: 16, fontWeight: 700, color: item.alert ? '#ef4444' : '#fff' }}>{item.value}</div>
          </div>
        ))}
      </div>

      {/* Ownership history */}
      {report.ownershipHistory.length > 0 && (
        <div
          style={{
            padding: '16px 20px',
            background: 'rgba(255,255,255,0.02)',
            border: '1px solid rgba(255,255,255,0.06)',
            borderRadius: 14,
          }}
        >
          <div style={{ fontSize: 11, fontWeight: 600, color: 'rgba(255,255,255,0.4)', letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: 12 }}>
            {t('premiumPage.unlocked.ownershipHistory')}
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {report.ownershipHistory.map((owner, idx) => (
              <div
                key={`${owner.fromDate}-${owner.ownerType}`}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '10px 0',
                  borderBottom: idx < report.ownershipHistory.length - 1 ? '1px solid rgba(255,255,255,0.04)' : 'none',
                }}
              >
                <div>
                  <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.7)', fontWeight: 500 }}>
                    {t(`premiumPage.unlocked.ownerType.${owner.ownerType}`, { defaultValue: owner.ownerType.charAt(0).toUpperCase() + owner.ownerType.slice(1) })} {t('premiumPage.unlocked.owner')}
                  </div>
                  <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.3)', marginTop: 2 }}>{owner.country}</div>
                </div>
                <div style={{ textAlign: 'right', fontSize: 12, color: 'rgba(255,255,255,0.4)' }}>
                  {owner.fromDate} → {owner.toDate ?? t('premiumPage.unlocked.now')}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Mileage history */}
      {report.mileageHistory.length > 0 && (
        <div
          style={{
            padding: '16px 20px',
            background: 'rgba(255,255,255,0.02)',
            border: '1px solid rgba(255,255,255,0.06)',
            borderRadius: 14,
          }}
        >
          <div style={{ fontSize: 11, fontWeight: 600, color: 'rgba(255,255,255,0.4)', letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: 12 }}>
            {t('premiumPage.unlocked.mileageRecords')}
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {report.mileageHistory.slice(0, 6).map((rec) => (
              <div
                key={`${rec.year}-${rec.km}`}
                style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, padding: '6px 0', borderBottom: '1px solid rgba(255,255,255,0.03)' }}
              >
                <span style={{ color: 'rgba(255,255,255,0.4)' }}>{rec.year}</span>
                <span style={{ color: 'rgba(255,255,255,0.7)', fontFamily: 'var(--font-mono)', fontWeight: 500 }}>
                  {rec.km.toLocaleString()} km
                </span>
                <span style={{ color: 'rgba(255,255,255,0.3)', fontSize: 11 }}>{rec.source}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
