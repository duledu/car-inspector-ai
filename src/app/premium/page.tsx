// =============================================================================
// Premium Page — /premium
// Payment portal for CarVertical report. Handles all payment states.
// =============================================================================

'use client'

import { useEffect } from 'react'
import { useSearchParams } from 'next/navigation'
import { useVehicleStore, usePaymentStore } from '@/store'
import { PremiumLockedState } from '@/components/payment/PremiumLockedState'
import { PremiumUnlockedReport } from '@/components/payment/PremiumUnlockedReport'
import { PaymentPendingState } from '@/components/payment/PaymentPendingState'
import { PaymentSuccessState } from '@/components/payment/PaymentSuccessState'
import { PaymentFailedState } from '@/components/payment/PaymentFailedState'
import { MyReportsPanel } from '@/components/payment/MyReportsPanel'
import AppShell from '../AppShell'

export default function PremiumPage() {
  const searchParams = useSearchParams()
  const { activeVehicle } = useVehicleStore()
  const { getStatus, hasAccess, pollPurchaseStatus } = usePaymentStore()

  const urlStatus = searchParams.get('status')
  const purchaseId = searchParams.get('purchaseId')

  const vehicleId = activeVehicle?.id ?? ''
  const productType = 'CARVERTICAL_REPORT' as const
  const paymentStatus = getStatus(vehicleId, productType)

  // When returning from Stripe with ?status=success, poll to confirm
  useEffect(() => {
    if (urlStatus === 'success' && purchaseId && vehicleId) {
      pollPurchaseStatus(purchaseId, vehicleId, productType)
    }
  }, [urlStatus, purchaseId, vehicleId])

  const renderContent = () => {
    if (!activeVehicle) {
      return (
        <div style={{ textAlign: 'center', padding: '80px 0' }}>
          <div style={{ width: 56, height: 56, borderRadius: 16, background: 'rgba(34,211,238,0.07)', border: '1px solid rgba(34,211,238,0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 20px' }}>
            <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="#22d3ee" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
              <path d="M5 17H3a2 2 0 0 1-2-2V9a2 2 0 0 1 2-2h13l4 4v4a2 2 0 0 1-2 2h-2" />
              <circle cx="7.5" cy="17.5" r="2.5" /><circle cx="17.5" cy="17.5" r="2.5" />
            </svg>
          </div>
          <div style={{ fontSize: 16, fontWeight: 600, color: '#fff', marginBottom: 8 }}>No vehicle selected</div>
          <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.38)', marginBottom: 20 }}>
            Add a vehicle first to purchase its history report
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
        <h1 style={{ margin: '0 0 6px', fontSize: 22, fontWeight: 800, color: '#fff', letterSpacing: '-0.5px' }}>Premium Reports</h1>
        <p style={{ margin: '0 0 24px', fontSize: 13, color: 'rgba(255,255,255,0.38)' }}>
          CarVertical full vehicle history — separately paid premium add-on
        </p>

        <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 20 }}>
          <div>{renderContent()}</div>
          <MyReportsPanel />
        </div>
      </div>
    </AppShell>
  )
}
