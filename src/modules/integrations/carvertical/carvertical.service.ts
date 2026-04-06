// =============================================================================
// CarVertical Service
// Orchestrates provider selection, DB caching, and purchase validation.
// The rest of the app uses THIS — never the provider directly.
// =============================================================================

import { prisma } from '@/config/prisma'
import { carVerticalConfig } from './carvertical.config'
import { CarVerticalProvider } from './carvertical.provider'
import { CarVerticalMockProvider } from './carvertical.mock'
import type { VehicleHistoryProviderInterface, VehicleHistoryResult } from '@/types'

export class CarVerticalService {
  private provider: VehicleHistoryProviderInterface

  constructor() {
    // Provider is resolved from config — swap here to change provider
    this.provider = carVerticalConfig.useMock
      ? new CarVerticalMockProvider()
      : new CarVerticalProvider()
  }

  /**
   * getReport
   * Returns the normalized vehicle history report.
   * Checks cache first (24h TTL). Validates premium access before fetching.
   */
  async getReport(vehicleId: string, userId: string): Promise<VehicleHistoryResult> {
    // 1. Verify the user has paid access
    const purchase = await prisma.premiumPurchase.findFirst({
      where: {
        vehicleId,
        userId,
        status: 'PAID',
        productType: 'CARVERTICAL_REPORT',
      },
    })

    if (!purchase) {
      throw new Error('PREMIUM_ACCESS_REQUIRED: User has not purchased this report.')
    }

    // 2. Get VIN from vehicle record
    const vehicle = await prisma.vehicle.findUnique({ where: { id: vehicleId } })
    if (!vehicle?.vin) {
      throw new Error('Vehicle has no VIN. Please enter the VIN before fetching history.')
    }

    // 3. Check DB cache
    const cached = await prisma.vINHistory.findUnique({ where: { vehicleId } })
    if (cached && new Date(cached.expiresAt) > new Date()) {
      return cached.normalizedData as unknown as VehicleHistoryResult
    }

    // 4. Fetch from provider
    const result = await this.provider.getVehicleHistory(vehicle.vin)

    // 5. Persist/update cache
    const expiresAt = new Date(Date.now() + carVerticalConfig.cacheTtlSeconds * 1000)
    await prisma.vINHistory.upsert({
      where: { vehicleId },
      update: {
        normalizedData: result as any,
        fetchedAt: new Date(),
        expiresAt,
        provider: this.provider.providerId,
      },
      create: {
        vehicleId,
        vin: vehicle.vin,
        provider: this.provider.providerId,
        normalizedData: result as any,
        expiresAt,
      },
    })

    return result
  }

  /**
   * decodeVINBasic
   * Free VIN decode — no purchase required. Returns make/model/year/recalls only.
   */
  async decodeVINBasic(vin: string): Promise<Pick<VehicleHistoryResult, 'vin' | 'make' | 'model' | 'year' | 'engineSpec' | 'recalls'>> {
    const result = await this.provider.getVehicleHistory(vin)
    return {
      vin: result.vin,
      make: result.make,
      model: result.model,
      year: result.year,
      engineSpec: result.engineSpec,
      recalls: result.recalls,
    }
  }
}

export const carVerticalService = new CarVerticalService()
