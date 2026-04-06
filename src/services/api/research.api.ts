// =============================================================================
// Vehicle Research API Service
// =============================================================================

import { apiClient } from './client'
import type { VehicleResearchResult, ApiResponse } from '@/types'

export interface ResearchRequestPayload {
  make: string
  model: string
  year: number
  engine?: string
  trim?: string
}

export const researchApi = {
  getModelGuide: async (payload: ResearchRequestPayload): Promise<VehicleResearchResult> => {
    const { data } = await apiClient.post<ApiResponse<VehicleResearchResult>>(
      '/vehicle/research',
      payload
    )
    return data.data
  },
}
