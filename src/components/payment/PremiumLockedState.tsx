// =============================================================================
// PremiumLockedState Component
// Shown when user has NOT purchased the CarVertical report.
// Handles the full purchase initiation flow.
// =============================================================================

'use client'

import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { usePaymentStore } from '@/store'
import type { Vehicle, PremiumProduct } from '@/types'

interface Props {
  vehicle?: Vehicle
  productType: PremiumProduct
  comingSoon?: boolean
}

const PRODUCT_FEATURES: Record<PremiumProduct, string[]> = {
  CARVERTICAL_REPORT: [
    'premiumPage.locked.features.carvertical.accident',
    'premiumPage.locked.features.carvertical.mileage',
    'premiumPage.locked.features.carvertical.ownership',
    'premiumPage.locked.features.carvertical.totalLoss',
    'premiumPage.locked.features.carvertical.theft',
    'premiumPage.locked.features.carvertical.importExport',
    'premiumPage.locked.features.carvertical.finance',
    'premiumPage.locked.features.carvertical.scoring',
  ],
  AI_DEEP_SCAN: [
    'premiumPage.locked.features.aiDeepScan.paint',
    'premiumPage.locked.features.aiDeepScan.symmetry',
    'premiumPage.locked.features.aiDeepScan.frame',
    'premiumPage.locked.features.aiDeepScan.damage',
  ],
  FULL_INSPECTION_BUNDLE: [
    'premiumPage.locked.features.bundle.carvertical',
    'premiumPage.locked.features.bundle.aiDeepScan',
    'premiumPage.locked.features.bundle.support',
  ],
}

const PRODUCT_PRICES: Record<PremiumProduct, string> = {
  CARVERTICAL_REPORT: '€14.99',
  AI_DEEP_SCAN: '€9.99',
  FULL_INSPECTION_BUNDLE: '€24.99',
}

export function PremiumLockedState({ vehicle, productType, comingSoon = false }: Props) {
  const { t } = useTranslation()
  const { startCheckout, isCreatingCheckout, error } = usePaymentStore()
  const [clicked, setClicked] = useState(false)

  const handlePurchase = async () => {
    if (!vehicle) return
    setClicked(true)
    try {
      const checkout = await startCheckout(vehicle.id, productType)
      // Redirect to Stripe-hosted checkout page
      window.location.href = checkout.checkoutUrl
    } catch (err) {
      setClicked(false)
    }
  }

  const features = PRODUCT_FEATURES[productType]
  const price = PRODUCT_PRICES[productType]

  return (
    <div>
      {/* Notice Banner */}
      <div
        style={{
          background: 'linear-gradient(135deg,rgba(168,85,247,0.1),rgba(0,128,255,0.06))',
          border: '1px solid rgba(168,85,247,0.3)',
          borderRadius: 18,
          padding: 24,
          marginBottom: 16,
          position: 'relative',
          overflow: 'hidden',
        }}
      >
        <div
          style={{
            fontSize: 11,
            color: '#a855f7',
            fontWeight: 700,
            textTransform: 'uppercase',
            letterSpacing: '1px',
            marginBottom: 8,
          }}
        >
          {t('premiumPage.locked.badge')}
        </div>
        <div style={{ fontSize: 18, fontWeight: 700, marginBottom: 8 }}>
          {t('premiumPage.locked.title')}
        </div>
        <div
          style={{
            fontSize: 13,
            color: 'var(--color-text-secondary)',
            lineHeight: 1.8,
            marginBottom: 12,
          }}
        >
          {t('premiumPage.locked.noticePrefix')}{' '}
          <strong style={{ color: 'var(--color-text-primary)' }}>{t('premiumPage.locked.noticeFreeTools')}</strong>.
          {' '}{t('premiumPage.locked.noticeMiddle')}{' '}
          <strong style={{ color: '#a855f7' }}>{t('premiumPage.locked.noticeAddOn')}</strong>{' '}
          {t('premiumPage.locked.noticeSuffix')}
        </div>
        {vehicle && (
          <div
            style={{
              padding: '10px 14px',
              background: 'rgba(255,170,0,0.08)',
              border: '1px solid rgba(255,170,0,0.2)',
              borderRadius: 8,
              fontSize: 12,
              color: '#ffaa00',
              lineHeight: 1.7,
            }}
          >
            {t('premiumPage.locked.accessPrefix')}{' '}
            <strong>
              {vehicle.year} {vehicle.make} {vehicle.model}
            </strong>{' '}
            {t('premiumPage.locked.accessSuffix')}
          </div>
        )}
      </div>

      {/* Pricing Card */}
      <div
        style={{
          background: 'linear-gradient(135deg,rgba(168,85,247,0.1),rgba(79,70,229,0.06))',
          border: '1px solid rgba(168,85,247,0.3)',
          borderRadius: 18,
          padding: 28,
          position: 'relative',
          overflow: 'hidden',
        }}
      >
        {/* Top gradient bar */}
        <div
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            height: 2,
            background: 'linear-gradient(90deg,#a855f7,#00d4ff)',
          }}
        />

        <div style={{ textAlign: 'center', marginBottom: 24 }}>
          <div
            style={{
              display: 'inline-block',
              padding: '4px 12px',
              borderRadius: 20,
              fontSize: 11,
              fontWeight: 700,
              background: 'rgba(168,85,247,0.15)',
              color: '#a855f7',
              border: '1px solid rgba(168,85,247,0.3)',
              marginBottom: 14,
            }}
          >
            {t('premiumPage.locked.reportBadge')}
          </div>
          <div
            style={{
              fontSize: 44,
              fontWeight: 800,
              fontFamily: 'var(--font-mono)',
              background: 'linear-gradient(135deg,#a855f7,#00d4ff)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
            }}
          >
            {price}
          </div>
          <div style={{ fontSize: 12, color: 'var(--color-text-secondary)', marginTop: 4 }}>
            {t('premiumPage.locked.purchaseTerms')}
          </div>
        </div>

        {/* Feature list */}
        <div style={{ marginBottom: 24 }}>
          {features.map((feat) => (
            <div
              key={feat}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 10,
                padding: '8px 0',
                fontSize: 13,
                color: 'var(--color-text-secondary)',
                borderBottom: '1px solid rgba(255,255,255,0.04)',
              }}
            >
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#22c55e" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}><polyline points="20 6 9 17 4 12"/></svg>
              {t(feat)}
            </div>
          ))}
        </div>

        {/* CTA Button */}
        <button
          onClick={comingSoon ? undefined : handlePurchase}
          disabled={comingSoon || isCreatingCheckout || clicked}
          style={{
            width: '100%',
            padding: '16px',
            background: 'linear-gradient(135deg,#7c3aed,#a855f7)',
            color: '#fff',
            border: 'none',
            borderRadius: 12,
            fontSize: 15,
            fontWeight: 700,
            fontFamily: 'var(--font-sans)',
            cursor: comingSoon || isCreatingCheckout ? 'not-allowed' : 'pointer',
            boxShadow: '0 0 24px rgba(168,85,247,0.3)',
            opacity: comingSoon ? 0.45 : isCreatingCheckout ? 0.7 : 1,
            transition: 'all 0.2s ease',
          }}
        >
          {comingSoon
            ? t('premiumPage.comingSoon')
            : isCreatingCheckout
              ? t('premiumPage.locked.preparingCheckout')
              : t('premiumPage.locked.purchaseReport', { price })}
        </button>

        {error && (
          <div
            style={{
              marginTop: 12,
              padding: '8px 12px',
              background: 'rgba(255,71,87,0.1)',
              border: '1px solid rgba(255,71,87,0.25)',
              borderRadius: 8,
              fontSize: 12,
              color: '#ff4757',
            }}
          >
            {error}
          </div>
        )}

        <div
          style={{
            textAlign: 'center',
            fontSize: 11,
            color: 'var(--color-text-secondary)',
            marginTop: 12,
            opacity: 0.6,
          }}
        >
          {t('premiumPage.locked.securityNote')}
        </div>
      </div>
    </div>
  )
}
