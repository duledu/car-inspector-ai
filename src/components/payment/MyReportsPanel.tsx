'use client'

import { useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { usePaymentStore } from '@/store'

export function MyReportsPanel() {
  const { t, i18n } = useTranslation()
  const { purchaseHistory, fetchPurchaseHistory } = usePaymentStore()

  useEffect(() => {
    fetchPurchaseHistory()
  }, [])

  const STATUS_COLOR: Record<string, string> = {
    PAID: '#22c55e',
    PENDING: '#f59e0b',
    FAILED: '#ef4444',
    REFUNDED: '#6b7280',
    EXPIRED: '#6b7280',
    NOT_PURCHASED: '#6b7280',
  }

  const STATUS_LABEL: Record<string, string> = {
    PAID: t('premiumPage.reports.status.active'),
    PENDING: t('premiumPage.reports.status.pending'),
    FAILED: t('premiumPage.reports.status.failed'),
    REFUNDED: t('premiumPage.reports.status.refunded'),
    EXPIRED: t('premiumPage.reports.status.expired'),
    NOT_PURCHASED: '—',
  }

  return (
    <div
      style={{
        background: 'rgba(255,255,255,0.02)',
        border: '1px solid rgba(255,255,255,0.06)',
        borderRadius: 16,
        padding: 20,
      }}
    >
      <div style={{ fontSize: 12, fontWeight: 600, color: 'rgba(255,255,255,0.4)', letterSpacing: '0.05em', textTransform: 'uppercase', marginBottom: 14 }}>
        {t('premiumPage.reports.title')}
      </div>

      {purchaseHistory.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '24px 0' }}>
          <div style={{ width: 40, height: 40, margin: '0 auto 10px', display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: 10, background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)' }}>
            <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.3)" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>
          </div>
          <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.3)', lineHeight: 1.6 }}>
            {t('premiumPage.reports.empty')}
          </div>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {purchaseHistory.map((p) => (
            <div
              key={p.id}
              style={{
                padding: '12px 14px',
                background: 'rgba(255,255,255,0.02)',
                border: '1px solid rgba(255,255,255,0.05)',
                borderRadius: 10,
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
                <div style={{ fontSize: 12, fontWeight: 600, color: 'rgba(255,255,255,0.7)' }}>
                  {p.productType === 'CARVERTICAL_REPORT' ? t('premiumPage.reports.carverticalReport') : p.productType}
                </div>
                <div
                  style={{
                    fontSize: 10,
                    fontWeight: 600,
                    color: STATUS_COLOR[p.status] ?? '#6b7280',
                    background: `${STATUS_COLOR[p.status] ?? '#6b7280'}18`,
                    border: `1px solid ${STATUS_COLOR[p.status] ?? '#6b7280'}30`,
                    borderRadius: 6,
                    padding: '2px 7px',
                  }}
                >
                  {STATUS_LABEL[p.status] ?? p.status}
                </div>
              </div>
              <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.25)' }}>
                {p.amountCents / 100} {p.currency} ·{' '}
                {p.purchasedAt ? new Date(p.purchasedAt).toLocaleDateString(i18n.language) : t('premiumPage.reports.notCompleted')}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
