// =============================================================================
// Inspection API Service
// =============================================================================

import { apiClient } from './client'
import type {
  InspectionSession,
  ChecklistItem,
  UpdateChecklistItemPayload,
  InspectionPhase,
  RiskScore,
  ApiResponse,
} from '@/types'

export const inspectionApi = {
  getAccess: async (vehicleId: string): Promise<{ status: 'DRAFT' | 'ACTIVE' | 'LOCKED' | 'NONE' }> => {
    const { data } = await apiClient.get<ApiResponse<{ status: 'DRAFT' | 'ACTIVE' | 'LOCKED' | 'NONE' }>>(
      `/inspection/access?vehicleId=${encodeURIComponent(vehicleId)}`
    )
    return data.data
  },

  redeemAccessCode: async (vehicleId: string, code: string): Promise<{ status: 'DRAFT' | 'ACTIVE' | 'LOCKED' | 'NONE' }> => {
    const { data } = await apiClient.post<ApiResponse<{ status: 'DRAFT' | 'ACTIVE' | 'LOCKED' | 'NONE' }>>(
      '/inspection/access',
      { vehicleId, code }
    )
    return data.data
  },

  getOrCreateSession: async (vehicleId: string): Promise<InspectionSession> => {
    const { data } = await apiClient.post<ApiResponse<InspectionSession>>(
      '/inspection/session',
      { vehicleId }
    )
    return data.data
  },

  getSession: async (sessionId: string): Promise<InspectionSession> => {
    const { data } = await apiClient.get<ApiResponse<InspectionSession>>(
      `/inspection/session/${sessionId}`
    )
    return data.data
  },

  updatePhase: async (sessionId: string, phase: InspectionPhase): Promise<void> => {
    await apiClient.patch(`/inspection/session/${sessionId}/phase`, { phase })
  },

  updateChecklistItem: async (
    itemId: string,
    payload: UpdateChecklistItemPayload
  ): Promise<ChecklistItem> => {
    const { data } = await apiClient.patch<ApiResponse<ChecklistItem>>(
      `/inspection/checklist/${itemId}`,
      payload
    )
    return data.data
  },

  calculateScore: async (vehicleId: string): Promise<RiskScore> => {
    const { data } = await apiClient.post<ApiResponse<RiskScore>>(
      `/inspection/score`,
      { vehicleId }
    )
    return data.data
  },

  getScore: async (vehicleId: string): Promise<RiskScore | null> => {
    const { data } = await apiClient.get<ApiResponse<RiskScore | null>>(
      `/inspection/score/${vehicleId}`
    )
    return data.data
  },
}
