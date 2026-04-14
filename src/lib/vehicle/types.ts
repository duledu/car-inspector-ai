// =============================================================================
// Vehicle Intelligence System — Core Types
// =============================================================================

export type BodyType =
  | 'sedan'
  | 'hatchback'
  | 'suv'
  | 'estate'
  | 'coupe'
  | 'van'
  | 'pickup'
  | 'convertible'
  | 'minivan'

export type FuelType =
  | 'petrol'
  | 'diesel'
  | 'hybrid'
  | 'electric'
  | 'lpg'
  | 'cng'

export type Transmission =
  | 'manual'
  | 'automatic'
  | 'dct'
  | 'cvt'

export type Drivetrain =
  | 'fwd'
  | 'rwd'
  | 'awd'
  | '4wd'

export type IssueCategory =
  | 'mechanical'
  | 'electrical'
  | 'body'
  | 'interior'
  | 'safety'
  | 'wear'
  | 'rust'

export type IssueSeverity = 'critical' | 'major' | 'minor' | 'cosmetic'
export type IssueFrequency = 'widespread' | 'common' | 'occasional' | 'rare'
export type IssueConfidence = 'high' | 'medium' | 'low'

// ── VehicleIdentity ───────────────────────────────────────────────────────────

/** Canonical, normalized vehicle identity. All strings lowercase + trimmed. */
export interface VehicleIdentity {
  make:         string
  model:        string
  generation:   string | null
  yearFrom:     number
  yearTo:       number
  bodyType:     BodyType | null
  fuelType:     FuelType | null
  transmission: Transmission | null
  drivetrain:   Drivetrain | null
  engineFamily: string | null
  engineCc:     number | null
  powerKw:      number | null
  mileage:      number | null
  locale:       string
}

// ── VehicleIssue ─────────────────────────────────────────────────────────────

export interface VehicleIssue {
  // Identity — null means "applies to all"
  id:           string
  make:         string
  model:        string | null
  generation:   string | null
  yearRange:    [number, number] | null
  bodyType:     BodyType[] | null
  fuelType:     FuelType[] | null
  engineFamily: string[] | null
  transmission: Transmission[] | null
  drivetrain:   Drivetrain[] | null

  // Issue description
  title:               string
  category:            IssueCategory
  severity:            IssueSeverity
  frequency:           IssueFrequency
  explanation:         string
  inspectionAdvice:    string
  estimatedRepairCost?: { min: number; max: number; currency: 'EUR' }
  mileageWindow?:      [number, number]

  // Meta
  confidence:          IssueConfidence
  source?:             string
  applicabilityNotes?: string
}

// ── MatchedIssue ─────────────────────────────────────────────────────────────

export interface MatchedIssue extends VehicleIssue {
  specificityScore: number
}
