// =============================================================================
// Credit Store — Zustand
// Wallet balance caching + Google Play purchase/redeem flow state.
// Mirrors usePaymentStore.ts's pattern for the Stripe flow.
// =============================================================================

import { create } from 'zustand'
import { immer } from 'zustand/middleware/immer'
import type { PremiumProduct } from '@/types'
import { creditsApi } from '@/services/api/credits.api'
import { purchaseProduct, consumePurchase } from '@/lib/billing/google-play-client'

interface CreditState {
  balance: number
  lifetimePurchased: number
  lifetimeSpent: number
  isLoadingBalance: boolean
  isPurchasing: boolean
  isRedeeming: boolean
  error: string | null
}

interface CreditActions {
  fetchBalance: () => Promise<void>
  buyCredits: (productId: string) => Promise<void>
  redeem: (vehicleId: string, productType: PremiumProduct) => Promise<boolean>
  clearError: () => void
}

type CreditStore = CreditState & CreditActions

export const useCreditStore = create<CreditStore>()(
  immer((set, get) => ({
    balance: 0,
    lifetimePurchased: 0,
    lifetimeSpent: 0,
    isLoadingBalance: false,
    isPurchasing: false,
    isRedeeming: false,
    error: null,

    fetchBalance: async () => {
      set(state => { state.isLoadingBalance = true; state.error = null })
      try {
        const wallet = await creditsApi.getBalance()
        set(state => {
          state.balance = wallet.balance
          state.lifetimePurchased = wallet.lifetimePurchased
          state.lifetimeSpent = wallet.lifetimeSpent
          state.isLoadingBalance = false
        })
      } catch (err: any) {
        set(state => { state.isLoadingBalance = false; state.error = err.message })
      }
    },

    buyCredits: async (productId: string) => {
      set(state => { state.isPurchasing = true; state.error = null })
      try {
        const purchase = await purchaseProduct(productId)
        const result = await creditsApi.verifyPurchase(purchase.productId, purchase.purchaseToken)

        if (result.status === 'GRANTED' || result.status === 'ALREADY_GRANTED') {
          // Server has granted credits and already consumed the purchase
          // server-side; this client-side consume call is a best-effort
          // mirror so Play's local cache reflects it immediately too.
          try { await consumePurchase(purchase.purchaseToken) } catch { /* server already consumed; safe to ignore */ }
        }

        set(state => {
          state.isPurchasing = false
          if (typeof result.balance === 'number') state.balance = result.balance
        })

        await get().fetchBalance()
      } catch (err: any) {
        set(state => { state.isPurchasing = false; state.error = err.message ?? 'Purchase failed' })
        throw err
      }
    },

    redeem: async (vehicleId: string, productType: PremiumProduct) => {
      set(state => { state.isRedeeming = true; state.error = null })
      try {
        const result = await creditsApi.redeem(vehicleId, productType)
        set(state => {
          state.isRedeeming = false
          state.balance = result.balance
        })
        return true
      } catch (err: any) {
        set(state => { state.isRedeeming = false; state.error = err.message ?? 'Redemption failed' })
        return false
      }
    },

    clearError: () => set(state => { state.error = null }),
  })),
)
