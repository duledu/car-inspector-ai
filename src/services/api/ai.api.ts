// =============================================================================
// AI Analysis API Service
// =============================================================================

import { apiClient } from './client'
import type { AIAnalysisResult, Photo, PhotoAngle, ApiResponse } from '@/types'

export const aiApi = {
  uploadPhoto: async (
    vehicleId: string,
    file: File,
    angle: PhotoAngle
  ): Promise<Photo> => {
    const formData = new FormData()
    formData.append('file', file)
    formData.append('vehicleId', vehicleId)
    formData.append('angle', angle)
    const { data } = await apiClient.post<ApiResponse<Photo>>('/ai-analysis/upload', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    })
    return data.data
  },

  runAnalysis: async (vehicleId: string, photoIds: string[]): Promise<AIAnalysisResult> => {
    const { data } = await apiClient.post<ApiResponse<AIAnalysisResult>>(
      '/ai-analysis/analyze',
      { vehicleId, photoIds }
    )
    return data.data
  },

  getResults: async (vehicleId: string): Promise<AIAnalysisResult[]> => {
    const { data } = await apiClient.get<ApiResponse<AIAnalysisResult[]>>(
      `/ai-analysis/${vehicleId}`
    )
    return data.data
  },
}
