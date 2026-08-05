// =============================================================================
// GooglePlayCreditPurchase
// Credit-pack picker + purchase/redeem flow for Android/TWA. Shown by
// PremiumLockedState and the report-page access gate in place of the Stripe
// checkout button when isRunningInTwa() is true.
//
// Credits are never granted here — buyCredits()/redeem() (useCreditStore)
// only ever call the server, which is the sole authority on what's granted.
// =============================================================================

'use client'

import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useCreditStore } from '@/store/useCreditStore'
import { isPlayBillingAvailable } from '@/lib/billing/google-play-client'
import { GOOGLE_PLAY_PRODUCTS } from '@/lib/payments/google-play-products'
import type { PremiumProduct } from '@/types'

interface Props {
  vehicleId: string
  productType: PremiumProduct
  requiredCredits: number
  onUnlocked: () => void
}

const PACKAGE_IDS = Object.entries(GOOGLE_PLAY_PRODUCTS)
  .sort((a, b) => a[1] - b[1])
  .map(([productId, credits]) => ({ productId, credits }))

export function GooglePlayCreditPurchase({ vehicleId, productType, requiredCredits, onUnlocked }: Props) {
  const { t } = useTranslation()
  const { balance, isPurchasing, isRedeeming, error, fetchBalance, buyCredits, redeem, clearError } = useCreditStore()
  const [billingSupported, setBillingSupported] = useState(true)

  useEffect(() => {
    setBillingSupported(isPlayBillingAvailable())
    void fetchBalance()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const hasEnough = balance >= requiredCredits
  const busy = isPurchasing || isRedeeming

  const handleBuy = async (productId: string) => {
    clearError()
    try {
      await buyCredits(productId)
    } catch {
      // error is already surfaced via the store's `error` field
    }
  }

  const handleRedeem = async () => {
    clearError()
    const ok = await redeem(vehicleId, productType)
    if (ok) onUnlocked()
  }

  if (!billingSupported) {
    return (
      <div style={{
        padding: '13px 14px', background: 'rgba(251,191,36,0.07)', border: '1px solid rgba(251,191,36,0.22)',
        borderRadius: 10, fontSize: 12.5, color: 'rgba(255,255,255,0.62)', lineHeight: 1.6, textAlign: 'center',
      }}>
        {t('premiumPage.locked.googlePlayUnavailable', 'Purchases are temporarily unavailable in this app. Please try again after updating the app.')}
      </div>
    )
  }

  return (
    <div>
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '10px 14px', marginBottom: 14,
        background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 10,
        fontSize: 13, color: 'rgba(255,255,255,0.72)',
      }}>
        <span>{t('premiumPage.locked.creditBalance', 'Your credits')}</span>
        <strong style={{ color: '#fff' }}>{balance}</strong>
      </div>

      {hasEnough ? (
        <button
          onClick={handleRedeem}
          disabled={busy}
          style={{
            width: '100%', padding: '16px', background: 'linear-gradient(135deg,#22d3ee,#06b6d4)',
            color: '#041014', border: 'none', borderRadius: 12, fontSize: 15, fontWeight: 800,
            cursor: busy ? 'not-allowed' : 'pointer', opacity: busy ? 0.7 : 1,
          }}
        >
          {isRedeeming
            ? t('premiumPage.locked.redeeming', 'Unlocking…')
            : t('premiumPage.locked.redeemWithCredits', 'Unlock with {{count}} credits', { count: requiredCredits })}
        </button>
      ) : (
        <>
          <div style={{ fontSize: 12.5, color: 'rgba(255,255,255,0.5)', marginBottom: 10, textAlign: 'center' }}>
            {t('premiumPage.locked.needMoreCredits', 'You need {{count}} credits to unlock this. Buy a credit pack:', { count: requiredCredits })}
          </div>
          <div style={{ display: 'grid', gap: 8 }}>
            {PACKAGE_IDS.map(({ productId, credits }) => (
              <button
                key={productId}
                onClick={() => handleBuy(productId)}
                disabled={busy}
                style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  padding: '13px 16px', background: 'rgba(168,85,247,0.1)', border: '1px solid rgba(168,85,247,0.3)',
                  borderRadius: 10, color: '#fff', fontSize: 14, fontWeight: 700,
                  cursor: busy ? 'not-allowed' : 'pointer', opacity: busy ? 0.7 : 1,
                }}
              >
                <span>{t('premiumPage.locked.creditPack', '{{count}} credits', { count: credits })}</span>
                <span style={{ color: '#a855f7' }}>{isPurchasing ? '…' : '›'}</span>
              </button>
            ))}
          </div>
        </>
      )}

      {error && (
        <div style={{
          marginTop: 12, padding: '8px 12px', background: 'rgba(255,71,87,0.1)',
          border: '1px solid rgba(255,71,87,0.25)', borderRadius: 8, fontSize: 12, color: '#ff4757',
        }}>
          {error}
        </div>
      )}
    </div>
  )
}
