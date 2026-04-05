// =============================================================================
// Vehicle API Service
// =============================================================================

import { apiClient } from './client'
import type { Vehicle, CreateVehiclePayload, ApiResponse, PaginatedResponse } from '@/types'

export const vehicleApi = {
  create: async (payload: CreateVehiclePayload): Promise<Vehicle> => {
    const { data } = await apiClient.post<ApiResponse<Vehicle>>('/vehicle', payload)
    return data.data
  },

  list: async (): Promise<Vehicle[]> => {
    const { data } = await apiClient.get<ApiResponse<Vehicle[]>>('/vehicle')
    return data.data
  },

  getById: async (id: string): Promise<Vehicle> => {
    const { data } = await apiClient.get<ApiResponse<Vehicle>>(`/vehicle/${id}`)
    return data.data
  },

  update: async (id: string, updates: Partial<CreateVehiclePayload>): Promise<Vehicle> => {
    const { data } = await apiClient.patch<ApiResponse<Vehicle>>(`/vehicle/${id}`, updates)
    return data.data
  },

  delete: async (id: string): Promise<void> => {
    await apiClient.delete(`/vehicle/${id}`)
  },
}
