// =============================================================================
// Vehicle Research API Service
// =============================================================================

import { apiClient } from './client'
import type { VehicleResearchResult, ApiResponse } from '@/types'

export interface ResearchRequestPayload {
  make: string
  model: string
  year: number
  engineCc?: number
  powerKw?: number
  engine?: string
  trim?: string
  askingPrice?: number
  currency?: string
  fuelType?: string
  transmission?: string
  drivetrain?: string
  bodyType?: string
  mileage?: number
  locale?: string
}

export const researchApi = {
  getModelGuide: async (payload: ResearchRequestPayload): Promise<VehicleResearchResult> => {
    const { data } = await apiClient.post<ApiResponse<VehicleResearchResult> & { limitedMode?: boolean }>(
      '/vehicle/research',
      payload
    )
    // Merge limitedMode from the wrapper into the result object
    const result = data.data
    if (data.limitedMode) result.limitedMode = true
    return result
  },
}
