// =============================================================================
// CarVertical Provider — Live API Implementation
// Implements VehicleHistoryProviderInterface using CarVertical's REST API.
// =============================================================================

import axios, { AxiosInstance } from 'axios'
import { BaseVehicleHistoryProvider } from '../base/vehicle-history.provider'
import { mapCarVerticalToInternal } from './carvertical.mapper'
import { carVerticalConfig } from './carvertical.config'
import type { CarVerticalApiResponse } from './carvertical.types'
import type { VehicleHistoryResult, MileageRecord, DamageRecord, OwnershipRecord } from '@/types'

export class CarVerticalProvider extends BaseVehicleHistoryProvider {
  readonly providerId = 'carvertical'
  readonly providerName = 'carVertical'

  private client: AxiosInstance

  constructor() {
    super()
    this.client = axios.create({
      baseURL: carVerticalConfig.baseUrl,
      timeout: carVerticalConfig.timeoutMs,
      headers: {
        'Authorization': `Bearer ${carVerticalConfig.apiKey}`,
        'Content-Type': 'application/json',
        'X-API-Version': carVerticalConfig.apiVersion,
      },
    })
  }

  async getVehicleHistory(vin: string): Promise<VehicleHistoryResult> {
    this.validateVIN(vin)

    try {
      const response = await this.client.get<CarVerticalApiResponse>(
        `/reports/${vin}`
      )
      return mapCarVerticalToInternal(response.data)
    } catch (error: any) {
      if (error.response?.status === 402) {
        throw new Error('CarVertical: Insufficient credits. Please top up your account.')
      }
      if (error.response?.status === 404) {
        throw new Error(`CarVertical: No data found for VIN ${vin}.`)
      }
      if (error.code === 'ECONNABORTED') {
        throw new Error(`CarVertical: Request timed out after ${carVerticalConfig.timeoutMs}ms.`)
      }
      throw new Error(`CarVertical API error: ${error.message}`)
    }
  }

  async getMileageHistory(vin: string): Promise<MileageRecord[]> {
    const history = await this.getVehicleHistory(vin)
    return history.mileageHistory
  }

  async getDamageHistory(vin: string): Promise<DamageRecord[]> {
    const history = await this.getVehicleHistory(vin)
    return history.damageHistory
  }

  async getOwnershipHistory(vin: string): Promise<OwnershipRecord[]> {
    const history = await this.getVehicleHistory(vin)
    return history.ownershipHistory
  }

  async isAvailable(): Promise<boolean> {
    try {
      await this.client.get('/health', { timeout: 3000 })
      return true
    } catch {
      return false
    }
  }
}
