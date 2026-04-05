// =============================================================================
// Payment Store — Zustand
// Premium purchase state, checkout flow, and access grants.
// =============================================================================

import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'
import { immer } from 'zustand/middleware/immer'
import type { PaymentStatus, PremiumProduct, CheckoutSession, PremiumPurchase } from '@/types'
import { paymentApi } from '@/services/api/payment.api'

interface PurchaseRecord {
  vehicleId: string
  productType: PremiumProduct
  status: PaymentStatus
  purchaseId?: string
  purchasedAt?: string
}

interface PaymentState {
  // Map of `${vehicleId}:${productType}` → PurchaseRecord
  purchases: Record<string, PurchaseRecord>
  activeCheckout: CheckoutSession | null
  purchaseHistory: PremiumPurchase[]
  isCreatingCheckout: boolean
  isFetchingStatus: boolean
  error: string | null
}

interface PaymentActions {
  getStatus: (vehicleId: string, productType: PremiumProduct) => PaymentStatus
  hasAccess: (vehicleId: string, productType: PremiumProduct) => boolean
  startCheckout: (vehicleId: string, productType: PremiumProduct) => Promise<CheckoutSession>
  pollPurchaseStatus: (purchaseId: string, vehicleId: string, productType: PremiumProduct) => Promise<void>
  fetchPurchaseHistory: () => Promise<void>
  clearCheckout: () => void
  clearError: () => void
}

type PaymentStore = PaymentState & PaymentActions

const purchaseKey = (vehicleId: string, productType: string) => `${vehicleId}:${productType}`

export const usePaymentStore = create<PaymentStore>()(
  persist(
    immer((set, get) => ({
      // ─── State ──────────────────────────────────────────────────────────────
      purchases: {},
      activeCheckout: null,
      purchaseHistory: [],
      isCreatingCheckout: false,
      isFetchingStatus: false,
      error: null,

      // ─── Actions ────────────────────────────────────────────────────────────

      getStatus: (vehicleId, productType) => {
        const record = get().purchases[purchaseKey(vehicleId, productType)]
        return record?.status ?? 'NOT_PURCHASED'
      },

      hasAccess: (vehicleId, productType) => {
        return get().getStatus(vehicleId, productType) === 'PAID'
      },

      startCheckout: async (vehicleId, productType) => {
        set((state) => { state.isCreatingCheckout = true; state.error = null })
        try {
          const checkout = await paymentApi.createCheckout({ vehicleId, productType })
          set((state) => {
            state.activeCheckout = checkout
            state.isCreatingCheckout = false
            // Set to pending immediately
            state.purchases[purchaseKey(vehicleId, productType)] = {
              vehicleId,
              productType,
              status: 'PENDING',
              purchaseId: checkout.purchaseId,
            }
          })
          return checkout
        } catch (err: any) {
          set((state) => { state.isCreatingCheckout = false; state.error = err.message })
          throw err
        }
      },

      pollPurchaseStatus: async (purchaseId, vehicleId, productType) => {
        set((state) => { state.isFetchingStatus = true })
        try {
          const status = await paymentApi.getStatus(vehicleId, productType)
          set((state) => {
            state.isFetchingStatus = false
            const key = purchaseKey(vehicleId, productType)
            if (state.purchases[key]) {
              state.purchases[key].status = status
            } else {
              state.purchases[key] = { vehicleId, productType, status, purchaseId }
            }
          })
        } catch {
          set((state) => { state.isFetchingStatus = false })
        }
      },

      fetchPurchaseHistory: async () => {
        try {
          const history = await paymentApi.getPurchaseHistory()
          set((state) => {
            state.purchaseHistory = history
            // Sync purchase status map from server truth
            history.forEach((p) => {
              const key = purchaseKey(p.vehicleId, p.productType)
              state.purchases[key] = {
                vehicleId: p.vehicleId,
                productType: p.productType,
                status: p.status,
                purchaseId: p.id,
                purchasedAt: p.purchasedAt ?? undefined,
              }
            })
          })
        } catch (err: any) {
          set((state) => { state.error = err.message })
        }
      },

      clearCheckout: () => set((state) => { state.activeCheckout = null }),
      clearError: () => set((state) => { state.error = null }),
    })),
    {
      name: 'uci-payment-store',
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({ purchases: state.purchases }),
    }
  )
)
