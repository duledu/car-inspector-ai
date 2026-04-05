// =============================================================================
// CarVertical Integration — Raw API Types
// These types match CarVertical's actual API response shapes.
// Never leak these into the rest of the app — use the mapper to normalize.
// =============================================================================

export interface CarVerticalApiResponse {
  vin: string
  vehicle: {
    make: string
    model: string
    year: number
    engine_displacement: number
    engine_power_kw: number
    fuel_type: string
    body_type: string
    color: string
  }
  report: {
    mileage_records: CarVerticalMileageRecord[]
    damage_records: CarVerticalDamageRecord[]
    ownership_records: CarVerticalOwnerRecord[]
    theft_check: { status: 'clear' | 'stolen' }
    finance_check: { outstanding: boolean; amount?: number }
    total_loss: boolean
    recalls: CarVerticalRecall[]
    risk_indicators: CarVerticalRiskIndicator[]
  }
  metadata: {
    report_id: string
    generated_at: string
    data_sources: string[]
    confidence_score: number
  }
}

export interface CarVerticalMileageRecord {
  date: string              // ISO date
  mileage_km: number
  source: string
  country: string
}

export interface CarVerticalDamageRecord {
  date: string
  damage_type: string        // "collision" | "hail" | "flood" | "fire" etc
  severity: number           // 1 (minor) to 5 (severe)
  repair_cost_eur?: number
  description: string
}

export interface CarVerticalOwnerRecord {
  registration_from: string
  registration_to?: string
  country_code: string
  owner_type: 'private' | 'fleet' | 'dealer'
}

export interface CarVerticalRecall {
  recall_id: string
  description: string
  status: 'completed' | 'pending' | 'unknown'
  recall_date?: string
}

export interface CarVerticalRiskIndicator {
  code: string               // "MILEAGE_ROLLBACK" | "FLOOD" | "TAXI" etc
  severity: 'low' | 'medium' | 'high'
  description: string
}

export interface CarVerticalErrorResponse {
  error: string
  code: string
  message: string
}
