// =============================================================================
// CarVertical Mapper
// Transforms raw CarVertical API responses into VehicleHistoryResult.
// This is the ONLY place CarVertical-specific shapes touch our internal types.
// =============================================================================

import type { VehicleHistoryResult, MileageRecord, DamageRecord, OwnershipRecord, RecallItem, RiskFlag } from '@/types'
import type { CarVerticalApiResponse, CarVerticalRiskIndicator } from './carvertical.types'

const SEVERITY_MAP: Record<number, DamageRecord['severity']> = {
  1: 'minor',
  2: 'minor',
  3: 'moderate',
  4: 'severe',
  5: 'severe',
}

const RISK_FLAG_MAP: Record<string, RiskFlag> = {
  MILEAGE_ROLLBACK: 'MILEAGE_ROLLBACK',
  FLOOD: 'FLOOD_DAMAGE',
  TAXI: 'TAXI_USE',
  IMPORT: 'IMPORT',
  ACCIDENT: 'ACCIDENT_HISTORY',
  TOTAL_LOSS: 'TOTAL_LOSS',
  STOLEN: 'STOLEN',
  OUTSTANDING_FINANCE: 'OUTSTANDING_FINANCE',
}

export function mapCarVerticalToInternal(raw: CarVerticalApiResponse): VehicleHistoryResult {
  const report = raw.report

  const mileageHistory: MileageRecord[] = report.mileage_records.map((r) => {
    const date = new Date(r.date)
    return {
      year: date.getFullYear(),
      month: date.getMonth() + 1,
      km: r.mileage_km,
      source: r.source,
    }
  })

  const damageHistory: DamageRecord[] = report.damage_records.map((r) => ({
    date: r.date,
    type: r.damage_type,
    severity: SEVERITY_MAP[r.severity] ?? 'minor',
    repairCostEstimate: r.repair_cost_eur,
    currency: 'EUR',
  }))

  const ownershipHistory: OwnershipRecord[] = report.ownership_records.map((r) => ({
    fromDate: r.registration_from,
    toDate: r.registration_to,
    country: r.country_code,
    ownerType: r.owner_type,
  }))

  const recalls: RecallItem[] = report.recalls.map((r) => ({
    id: r.recall_id,
    description: r.description,
    status: r.status === 'completed' ? 'complete' : r.status === 'pending' ? 'incomplete' : 'unknown',
    date: r.recall_date,
  }))

  const riskFlags: RiskFlag[] = report.risk_indicators
    .map((ri: CarVerticalRiskIndicator) => RISK_FLAG_MAP[ri.code])
    .filter((flag): flag is RiskFlag => !!flag)

  return {
    vin: raw.vin,
    make: raw.vehicle.make,
    model: raw.vehicle.model,
    year: raw.vehicle.year,
    engineSpec: `${raw.vehicle.engine_displacement}L ${raw.vehicle.fuel_type}`,
    countryOfOrigin: raw.metadata.data_sources[0] ?? 'Unknown',
    accidentCount: report.damage_records.length,
    mileageHistory,
    damageHistory,
    ownershipHistory,
    theftStatus: report.theft_check.status === 'stolen' ? 'reported_stolen' : 'clean',
    outstandingFinance: report.finance_check.outstanding,
    totalLoss: report.total_loss,
    recalls,
    riskFlags,
    dataSource: 'carvertical',
    fetchedAt: raw.metadata.generated_at,
  }
}
