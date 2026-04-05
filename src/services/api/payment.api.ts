// =============================================================================
// Payment API Service
// =============================================================================

import { apiClient } from './client'
import type {
  CreateCheckoutPayload,
  CheckoutSession,
  PaymentStatus,
  PremiumPurchase,
  PremiumProduct,
  ApiResponse,
} from '@/types'

export const paymentApi = {
  createCheckout: async (payload: CreateCheckoutPayload): Promise<CheckoutSession> => {
    const { data } = await apiClient.post<ApiResponse<CheckoutSession>>(
      '/payment/checkout',
      payload
    )
    return data.data
  },

  getStatus: async (vehicleId: string, productType: PremiumProduct): Promise<PaymentStatus> => {
    const { data } = await apiClient.get<ApiResponse<{ status: PaymentStatus }>>(
      `/payment/status?vehicleId=${vehicleId}&productType=${productType}`
    )
    return data.data.status
  },

  verifyAccess: async (vehicleId: string, productType: PremiumProduct): Promise<boolean> => {
    const { data } = await apiClient.get<ApiResponse<{ hasAccess: boolean }>>(
      `/payment/access?vehicleId=${vehicleId}&productType=${productType}`
    )
    return data.data.hasAccess
  },

  getPurchaseHistory: async (): Promise<PremiumPurchase[]> => {
    const { data } = await apiClient.get<ApiResponse<PremiumPurchase[]>>('/payment/history')
    return data.data
  },
}
