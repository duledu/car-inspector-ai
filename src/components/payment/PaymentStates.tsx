// =============================================================================
// Payment State Components
// Shown based on the current payment lifecycle state.
// =============================================================================

'use client'

import { useRouter } from 'next/navigation'
import { usePaymentStore } from '@/store'
import type { Vehicle, PremiumProduct } from '@/types'

// ─── Pending ─────────────────────────────────────────────────────────────────

export function PaymentPendingState() {
  return (
    <div
      style={{
        textAlign: 'center',
        padding: '80px 24px',
        background: 'rgba(255,255,255,0.02)',
        border: '1px solid rgba(255,255,255,0.08)',
        borderRadius: 18,
      }}
    >
      <div style={{ width: 56, height: 56, margin: '0 auto 16px', display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: '50%', background: 'rgba(34,211,238,0.06)', border: '1px solid rgba(34,211,238,0.15)' }}>
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#22d3ee" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
      </div>
      <div style={{ fontSize: 22, fontWeight: 800, marginBottom: 8 }}>Confirming Payment</div>
      <div
        style={{
          fontSize: 14,
          color: 'var(--color-text-secondary)',
          lineHeight: 1.7,
          maxWidth: 360,
          margin: '0 auto',
        }}
      >
        Your payment is being confirmed with Stripe. This usually takes a few seconds. Do not
        close this page.
      </div>
      <div
        style={{
          width: 32,
          height: 32,
          border: '3px solid rgba(0,212,255,0.2)',
          borderTopColor: '#00d4ff',
          borderRadius: '50%',
          animation: 'spin 0.8s linear infinite',
          margin: '24px auto 0',
        }}
      />
    </div>
  )
}

// ─── Success ─────────────────────────────────────────────────────────────────

interface SuccessProps {
  vehicle: Vehicle
}

export function PaymentSuccessState({ vehicle }: SuccessProps) {
  const router = useRouter()

  return (
    <div
      style={{
        textAlign: 'center',
        padding: '60px 24px',
        background: 'linear-gradient(135deg,rgba(0,230,118,0.08),rgba(0,212,255,0.04))',
        border: '1px solid rgba(0,230,118,0.25)',
        borderRadius: 18,
      }}
    >
      <div style={{ width: 56, height: 56, margin: '0 auto 16px', display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: '50%', background: 'rgba(34,197,94,0.08)', border: '1px solid rgba(34,197,94,0.2)' }}>
        <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="#22c55e" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
      </div>
      <div style={{ fontSize: 22, fontWeight: 800, color: '#00e676', marginBottom: 8 }}>
        Payment Successful!
      </div>
      <div
        style={{
          fontSize: 14,
          color: 'var(--color-text-secondary)',
          lineHeight: 1.8,
          maxWidth: 380,
          margin: '0 auto 28px',
        }}
      >
        Your CarVertical report is now permanently unlocked for{' '}
        <strong style={{ color: 'var(--color-text-primary)' }}>
          {vehicle.year} {vehicle.make} {vehicle.model}
        </strong>
        . Access is tied to your account and never expires.
      </div>
      <button
        onClick={() => router.refresh()}
        style={{
          padding: '14px 32px',
          background: 'linear-gradient(135deg,#7c3aed,#a855f7)',
          color: '#fff',
          border: 'none',
          borderRadius: 12,
          fontSize: 14,
          fontWeight: 700,
          fontFamily: 'var(--font-sans)',
          cursor: 'pointer',
        }}
      >
        View Full Report →
      </button>
    </div>
  )
}

// ─── Failed ───────────────────────────────────────────────────────────────────

interface FailedProps {
  vehicleId: string
  productType: PremiumProduct
}

export function PaymentFailedState({ vehicleId, productType }: FailedProps) {
  const { startCheckout, isCreatingCheckout } = usePaymentStore()
  const router = useRouter()

  const handleRetry = async () => {
    try {
      const checkout = await startCheckout(vehicleId, productType)
      window.location.href = checkout.checkoutUrl
    } catch {
      // Error shown via store
    }
  }

  return (
    <div
      style={{
        textAlign: 'center',
        padding: '60px 24px',
        background: 'rgba(255,71,87,0.06)',
        border: '1px solid rgba(255,71,87,0.2)',
        borderRadius: 18,
      }}
    >
      <div style={{ width: 56, height: 56, margin: '0 auto 16px', display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: '50%', background: 'rgba(239,68,68,0.07)', border: '1px solid rgba(239,68,68,0.18)' }}>
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#ef4444" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>
      </div>
      <div style={{ fontSize: 22, fontWeight: 800, color: '#ff4757', marginBottom: 8 }}>
        Payment Failed
      </div>
      <div
        style={{
          fontSize: 14,
          color: 'var(--color-text-secondary)',
          lineHeight: 1.8,
          maxWidth: 360,
          margin: '0 auto 28px',
        }}
      >
        Your payment could not be processed. No charge was made. Please check your card details
        and try again.
      </div>
      <div style={{ display: 'flex', gap: 12, justifyContent: 'center' }}>
        <button
          onClick={() => router.push('/premium')}
          style={{
            padding: '12px 24px',
            background: 'rgba(255,255,255,0.04)',
            color: 'var(--color-text-primary)',
            border: '1px solid rgba(255,255,255,0.08)',
            borderRadius: 10,
            fontSize: 13,
            fontWeight: 600,
            fontFamily: 'var(--font-sans)',
            cursor: 'pointer',
          }}
        >
          ← Back
        </button>
        <button
          onClick={handleRetry}
          disabled={isCreatingCheckout}
          style={{
            padding: '12px 24px',
            background: 'linear-gradient(135deg,#7c3aed,#a855f7)',
            color: '#fff',
            border: 'none',
            borderRadius: 10,
            fontSize: 13,
            fontWeight: 700,
            fontFamily: 'var(--font-sans)',
            cursor: 'pointer',
            opacity: isCreatingCheckout ? 0.7 : 1,
          }}
        >
          {isCreatingCheckout ? 'Loading…' : 'Retry Payment'}
        </button>
      </div>
    </div>
  )
}
