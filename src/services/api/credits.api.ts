// =============================================================================
// Credits API Service
// =============================================================================

import { apiClient } from './client'
import type { PremiumProduct, ApiResponse } from '@/types'

export interface WalletBalanceDto {
  balance: number
  lifetimePurchased: number
  lifetimeSpent: number
}

export interface VerifyPurchaseResult {
  status: 'GRANTED' | 'ALREADY_GRANTED' | 'PENDING' | 'CANCELLED'
  creditsGranted: number
  balance?: number
}

export interface RedeemResult {
  status: 'GRANTED'
  productType: PremiumProduct
  vehicleId: string
  creditsSpent: number
  balance: number
}

export interface GooglePlayPurchaseHistoryDto {
  id: string
  productId: string
  orderId: string | null
  status: string
  creditsGranted: number
  createdAt: string
  updatedAt: string
}

export const creditsApi = {
  getBalance: async (): Promise<WalletBalanceDto> => {
    const { data } = await apiClient.get<ApiResponse<WalletBalanceDto>>('/credits/balance')
    return data.data
  },

  verifyPurchase: async (productId: string, purchaseToken: string): Promise<VerifyPurchaseResult> => {
    const { data } = await apiClient.post<ApiResponse<VerifyPurchaseResult>>('/credits/google-play/verify', {
      productId,
      purchaseToken,
    })
    return data.data
  },

  redeem: async (vehicleId: string, productType: PremiumProduct): Promise<RedeemResult> => {
    const { data } = await apiClient.post<ApiResponse<RedeemResult>>('/credits/redeem', { vehicleId, productType })
    return data.data
  },

  getPurchaseHistory: async (): Promise<GooglePlayPurchaseHistoryDto[]> => {
    const { data } = await apiClient.get<ApiResponse<GooglePlayPurchaseHistoryDto[]>>('/credits/google-play/purchases')
    return data.data
  },
}
