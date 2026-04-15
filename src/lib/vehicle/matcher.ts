// =============================================================================
// Vehicle Matching Engine
// Deterministic issue matching: VehicleIdentity → ranked MatchedIssue[]
// =============================================================================

import type { VehicleIdentity, VehicleIssue, MatchedIssue } from './types'

// ── Specificity weights ───────────────────────────────────────────────────────

const W = {
  model:         25,
  engineFamily:  50,
  generation:    30,
  yearRange:     20,
  fuelType:      15,
  transmission:  10,
  bodyType:       5,
  drivetrain:     8,
  mileageWindow:  5,  // advisory bonus — never excludes
} as const

// ── Per-field scorers (null = exclude, 0 = not applicable, N = add to score) ──

function scoreModel(issue: VehicleIssue, id: VehicleIdentity): number | null {
  if (issue.model === null) return 0
  return issue.model === id.model ? W.model : null
}

function scoreGeneration(issue: VehicleIssue, id: VehicleIdentity): number | null {
  if (issue.generation === null) return 0
  if (id.generation === null) return null
  return issue.generation === id.generation ? W.generation : null
}

function scoreYearRange(issue: VehicleIssue, id: VehicleIdentity): number | null {
  if (issue.yearRange === null) return 0
  const [from, to] = issue.yearRange
  return (id.yearFrom > to || id.yearTo < from) ? null : W.yearRange
}

/** Generic array-field scorer: null identity value → exclude (identity must be known). */
function scoreArrayField<T>(issueVals: T[] | null, idVal: T | null, weight: number): number | null {
  if (issueVals === null) return 0
  if (idVal === null || !issueVals.includes(idVal)) return null
  return weight
}

function scoreTransmission(issue: VehicleIssue, id: VehicleIdentity): number | null {
  if (issue.transmission === null) return 0
  if (id.transmission === null) return null
  if (issue.transmission.includes(id.transmission)) return W.transmission

  // DCT and CVT are automatic gearboxes at runtime, but the KB can be more specific.
  // Let broad automatic issues apply to specific automatic subtypes without making
  // a generic "automatic" vehicle match DCT/CVT-only issues.
  if (
    issue.transmission.includes('automatic')
    && (id.transmission === 'dct' || id.transmission === 'cvt')
  ) {
    return W.transmission
  }

  return null
}

/**
 * MileageWindow is advisory — gives a score bonus when id.mileage falls within the
 * issue's expected mileage window, but NEVER excludes (returns 0, not null).
 * Unknown mileage (null) also returns 0 safely.
 */
function scoreMileageWindow(issue: VehicleIssue, id: VehicleIdentity): number {
  if (!issue.mileageWindow || id.mileage === null) return 0
  const [from, to] = issue.mileageWindow
  return id.mileage >= from && id.mileage <= to ? W.mileageWindow : 0
}

/** Drivetrain: unknown identity (null) doesn't exclude but gets no bonus. */
function scoreDrivetrain(issue: VehicleIssue, id: VehicleIdentity): number | null {
  if (issue.drivetrain === null) return 0
  if (id.drivetrain === null) return 0
  return issue.drivetrain.includes(id.drivetrain) ? W.drivetrain : null
}

// ── Scoring ───────────────────────────────────────────────────────────────────

function scoreIssue(issue: VehicleIssue, id: VehicleIdentity): number | null {
  if (issue.make !== id.make) return null

  const checks = [
    scoreModel(issue, id),
    scoreGeneration(issue, id),
    scoreYearRange(issue, id),
    scoreArrayField(issue.fuelType,     id.fuelType,     W.fuelType),
    scoreArrayField(issue.engineFamily, id.engineFamily, W.engineFamily),
    scoreTransmission(issue, id),
    scoreArrayField(issue.bodyType,     id.bodyType,     W.bodyType),
    scoreDrivetrain(issue, id),
  ]

  let score = 0
  for (const delta of checks) {
    if (delta === null) return null
    score += delta
  }

  // Mileage window is an advisory bonus — applied after exclusion checks
  score += scoreMileageWindow(issue, id)

  return score
}

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Match a VehicleIdentity against a flat list of VehicleIssues.
 * Returns issues sorted by specificity (highest first), deduplicated by id.
 * @param identity  Normalized vehicle identity from normalizeVehicle()
 * @param allIssues Full issue list from data/vehicle-issues/index
 * @param limit     Max issues to return (default: 15)
 */
export function matchIssues(
  identity: VehicleIdentity,
  allIssues: VehicleIssue[],
  limit = 15,
): MatchedIssue[] {
  const seen = new Set<string>()
  const results: MatchedIssue[] = []

  for (const issue of allIssues) {
    if (seen.has(issue.id)) continue

    const score = scoreIssue(issue, identity)
    if (score === null) continue

    seen.add(issue.id)
    results.push({ ...issue, specificityScore: score })
  }

  results.sort((a, b) => {
    // Sort by specificity desc, then severity (critical > major > minor > cosmetic)
    if (b.specificityScore !== a.specificityScore) return b.specificityScore - a.specificityScore
    return SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity]
  })

  return results.slice(0, limit)
}

const SEVERITY_ORDER: Record<string, number> = {
  critical: 0,
  major:    1,
  minor:    2,
  cosmetic: 3,
}
