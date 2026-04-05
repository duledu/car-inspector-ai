// =============================================================================
// CarVertical Mock Provider
// Used in development and testing. Returns deterministic realistic data.
// Swap to CarVerticalProvider in production via the registry.
// =============================================================================

import { BaseVehicleHistoryProvider } from '../base/vehicle-history.provider'
import type { VehicleHistoryResult, MileageRecord, DamageRecord, OwnershipRecord } from '@/types'

export class CarVerticalMockProvider extends BaseVehicleHistoryProvider {
  readonly providerId = 'carvertical-mock'
  readonly providerName = 'carVertical (Mock)'

  async getVehicleHistory(vin: string): Promise<VehicleHistoryResult> {
    this.validateVIN(vin)

    // Simulate network latency
    await new Promise((resolve) => setTimeout(resolve, 800))

    return {
      vin,
      make: 'BMW',
      model: '3 Series',
      year: 2019,
      engineSpec: '2.0L TwinPower Turbo',
      countryOfOrigin: 'Germany',
      accidentCount: 1,
      mileageHistory: await this.getMileageHistory(vin),
      damageHistory: await this.getDamageHistory(vin),
      ownershipHistory: await this.getOwnershipHistory(vin),
      theftStatus: 'clean',
      outstandingFinance: false,
      totalLoss: false,
      recalls: [
        {
          id: '21V-812',
          description: 'Fuel pump may fail, causing engine to stall',
          status: 'incomplete',
          date: '2021-08-15',
        },
      ],
      riskFlags: ['ACCIDENT_HISTORY'],
      dataSource: 'carvertical-mock',
      fetchedAt: new Date().toISOString(),
    }
  }

  async getMileageHistory(vin: string): Promise<MileageRecord[]> {
    return [
      { year: 2020, month: 3, km: 12000, source: 'service_record' },
      { year: 2021, month: 6, km: 28000, source: 'inspection' },
      { year: 2022, month: 9, km: 41000, source: 'service_record' },
      { year: 2023, month: 11, km: 54000, source: 'listing' },
    ]
  }

  async getDamageHistory(vin: string): Promise<DamageRecord[]> {
    return [
      {
        date: '2021-03-12',
        type: 'collision',
        severity: 'minor',
        repairCostEstimate: 1800,
        currency: 'EUR',
      },
    ]
  }

  async getOwnershipHistory(vin: string): Promise<OwnershipRecord[]> {
    return [
      { fromDate: '2019-04-01', toDate: '2021-06-30', country: 'DE', ownerType: 'private' },
      { fromDate: '2021-07-01', country: 'DE', ownerType: 'private' },
    ]
  }

  async isAvailable(): Promise<boolean> {
    return true
  }
}
