// =============================================================================
// Premium Page — /premium
// Payment portal for CarVertical report. Handles all payment states.
// COMING_SOON flag: flip to false when CarVertical integration is live.
// =============================================================================

'use client'

import { useEffect, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import { useTranslation } from 'react-i18next'
import { useVehicleStore, usePaymentStore } from '@/store'
import { PremiumLockedState } from '@/components/payment/PremiumLockedState'
import { PremiumUnlockedReport } from '@/components/payment/PremiumUnlockedReport'
import { PaymentPendingState } from '@/components/payment/PaymentPendingState'
import { PaymentSuccessState } from '@/components/payment/PaymentSuccessState'
import { PaymentFailedState } from '@/components/payment/PaymentFailedState'
import { MyReportsPanel } from '@/components/payment/MyReportsPanel'
import AppShell from '../AppShell'

// ─── Feature flag ─────────────────────────────────────────────────────────────
// Set to false when CarVertical is integrated and payment is enabled.
const COMING_SOON = true

export default function PremiumPage() {
  return (
    <Suspense>
      <PremiumPageContent />
    </Suspense>
  )
}

function PremiumPageContent() {
  const searchParams = useSearchParams()
  const { t } = useTranslation()
  const { activeVehicle } = useVehicleStore()
  const { getStatus, hasAccess, pollPurchaseStatus } = usePaymentStore()

  const urlStatus = searchParams.get('status')
  const purchaseId = searchParams.get('purchaseId')

  const vehicleId = activeVehicle?.id ?? ''
  const productType = 'CARVERTICAL_REPORT' as const
  const paymentStatus = getStatus(vehicleId, productType)

  useEffect(() => {
    if (!COMING_SOON && urlStatus === 'success' && purchaseId && vehicleId) {
      pollPurchaseStatus(purchaseId, vehicleId, productType)
    }
  }, [urlStatus, purchaseId, vehicleId])

  const renderContent = () => {
    // While coming soon, always show the locked state (with purchase disabled)
    if (COMING_SOON) {
      return <PremiumLockedState vehicle={activeVehicle ?? undefined} productType={productType} comingSoon />
    }

    if (!activeVehicle) {
      return (
        <div style={{ textAlign: 'center', padding: '80px 0' }}>
          <div style={{
            width: 56, height: 56, borderRadius: 16,
            background: 'rgba(34,211,238,0.07)', border: '1px solid rgba(34,211,238,0.12)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 20px',
          }}>
            <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="#22d3ee" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
              <path d="M5 17H3a2 2 0 0 1-2-2V9a2 2 0 0 1 2-2h13l4 4v4a2 2 0 0 1-2 2h-2" />
              <circle cx="7.5" cy="17.5" r="2.5" /><circle cx="17.5" cy="17.5" r="2.5" />
            </svg>
          </div>
          <div style={{ fontSize: 16, fontWeight: 600, color: '#fff', marginBottom: 8 }}>
            {t('premiumPage.noVehicleTitle')}
          </div>
          <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.38)', marginBottom: 20 }}>
            {t('premiumPage.noVehicleDesc')}
          </div>
        </div>
      )
    }

    if (urlStatus === 'success' && paymentStatus !== 'PAID') {
      return <PaymentPendingState />
    }

    if (paymentStatus === 'PAID' || hasAccess(vehicleId, productType)) {
      return <PremiumUnlockedReport vehicleId={vehicleId} />
    }

    if (paymentStatus === 'FAILED') {
      return <PaymentFailedState vehicleId={vehicleId} productType={productType} />
    }

    if (urlStatus === 'success') {
      return <PaymentSuccessState vehicle={activeVehicle} />
    }

    return <PremiumLockedState vehicle={activeVehicle} productType={productType} />
  }

  return (
    <AppShell>
      <div style={{ maxWidth: 1100 }}>

        {/* ── Page header ─────────────────────────────────────── */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', marginBottom: 6 }}>
          <h1 style={{ margin: 0, fontSize: 22, fontWeight: 800, color: '#fff', letterSpacing: '-0.5px' }}>
            {t('premiumPage.title')}
          </h1>
          {COMING_SOON && (
            <span style={{
              display: 'inline-flex', alignItems: 'center', gap: 5,
              padding: '3px 10px', borderRadius: 99,
              fontSize: 11, fontWeight: 700, letterSpacing: '0.05em', textTransform: 'uppercase',
              background: 'rgba(251,191,36,0.12)',
              border: '1px solid rgba(251,191,36,0.35)',
              color: '#fbbf24',
            }}>
              <span style={{ width: 5, height: 5, borderRadius: '50%', background: '#fbbf24', flexShrink: 0 }} />
              {t('premiumPage.comingSoon')}
            </span>
          )}
        </div>

        <p style={{ margin: '0 0 20px', fontSize: 13, color: 'rgba(255,255,255,0.38)' }}>
          {t('premiumPage.subtitle')}
        </p>

        {/* ── Coming Soon banner ──────────────────────────────── */}
        {COMING_SOON && (
          <div style={{
            display: 'flex', alignItems: 'flex-start', gap: 14,
            padding: '16px 18px',
            background: 'rgba(251,191,36,0.06)',
            border: '1px solid rgba(251,191,36,0.22)',
            borderRadius: 14,
            marginBottom: 24,
          }}>
            {/* Clock icon */}
            <div style={{
              flexShrink: 0, width: 36, height: 36, borderRadius: 10,
              background: 'rgba(251,191,36,0.1)', border: '1px solid rgba(251,191,36,0.2)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="#fbbf24" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>
              </svg>
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: '#fbbf24', marginBottom: 4 }}>
                {t('premiumPage.comingSoon')}
              </div>
              <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.5)', lineHeight: 1.65 }}>
                {t('premiumPage.comingSoonDesc')}
              </div>
            </div>
          </div>
        )}

        {/* ── Main grid — single col mobile, 2-col desktop ───── */}
        <div className="premium-layout">
          <div>{renderContent()}</div>
          <MyReportsPanel />
        </div>
      </div>

      <style>{`
        .premium-layout {
          display: flex;
          flex-direction: column;
          gap: 20px;
        }
        @media (min-width: 1024px) {
          .premium-layout {
            display: grid;
            grid-template-columns: 2fr 1fr;
            gap: 20px;
          }
        }
      `}</style>
    </AppShell>
  )
}
