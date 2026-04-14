// =============================================================================
// Vehicle Matching Engine
// Deterministic issue matching: VehicleIdentity → ranked MatchedIssue[]
// =============================================================================

import type { VehicleIdentity, VehicleIssue, MatchedIssue } from './types'

// ── Specificity weights ───────────────────────────────────────────────────────

const W = {
  model:        25,
  engineFamily: 50,
  generation:   30,
  yearRange:    20,
  fuelType:     15,
  transmission: 10,
  bodyType:      5,
  drivetrain:    8,
} as const

// ── Scoring ───────────────────────────────────────────────────────────────────

function scoreIssue(issue: VehicleIssue, id: VehicleIdentity): number | null {
  // Make must match (baseline — required)
  if (issue.make !== id.make) return null

  let score = 0

  // Model
  if (issue.model !== null) {
    if (issue.model !== id.model) return null   // model specified but doesn't match → exclude
    score += W.model
  }

  // Generation
  if (issue.generation !== null) {
    if (id.generation === null || issue.generation !== id.generation) return null
    score += W.generation
  }

  // Year range
  if (issue.yearRange !== null) {
    const [from, to] = issue.yearRange
    if (id.yearFrom < from || id.yearTo > to) {
      // Issue year range does not cover the vehicle year → exclude
      // (Be lenient: if vehicle year is within range, allow even partial overlap)
      if (id.yearFrom > to || id.yearTo < from) return null
    }
    score += W.yearRange
  }

  // Fuel type
  if (issue.fuelType !== null) {
    if (id.fuelType === null || !issue.fuelType.includes(id.fuelType)) return null
    score += W.fuelType
  }

  // Engine family
  if (issue.engineFamily !== null) {
    if (id.engineFamily === null || !issue.engineFamily.includes(id.engineFamily)) return null
    score += W.engineFamily
  }

  // Transmission
  if (issue.transmission !== null) {
    if (id.transmission === null || !issue.transmission.includes(id.transmission)) return null
    score += W.transmission
  }

  // Body type
  if (issue.bodyType !== null) {
    if (id.bodyType === null || !issue.bodyType.includes(id.bodyType)) return null
    score += W.bodyType
  }

  // Drivetrain
  if (issue.drivetrain !== null) {
    if (id.drivetrain === null || !issue.drivetrain.includes(id.drivetrain)) return null
    score += W.drivetrain
  }

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
