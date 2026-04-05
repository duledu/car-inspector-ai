// =============================================================================
// Vehicle History Provider — Base Interface
// All VIN/history integrations must implement this contract.
// CarVertical, HPI, mock providers — all plug in here.
// =============================================================================

import type {
  VehicleHistoryProviderInterface,
  VehicleHistoryResult,
  MileageRecord,
  DamageRecord,
  OwnershipRecord,
} from '@/types'

export abstract class BaseVehicleHistoryProvider implements VehicleHistoryProviderInterface {
  abstract readonly providerId: string
  abstract readonly providerName: string

  abstract getVehicleHistory(vin: string): Promise<VehicleHistoryResult>
  abstract getMileageHistory(vin: string): Promise<MileageRecord[]>
  abstract getDamageHistory(vin: string): Promise<DamageRecord[]>
  abstract getOwnershipHistory(vin: string): Promise<OwnershipRecord[]>
  abstract isAvailable(): Promise<boolean>

  /**
   * validateVIN
   * Basic 17-char VIN structural validation used by all providers.
   */
  protected validateVIN(vin: string): void {
    if (!vin || vin.length !== 17) {
      throw new Error(`Invalid VIN: must be 17 characters. Received: "${vin}"`)
    }
    if (!/^[A-HJ-NPR-Z0-9]{17}$/i.test(vin)) {
      throw new Error(`Invalid VIN: contains illegal characters. Received: "${vin}"`)
    }
  }
}
