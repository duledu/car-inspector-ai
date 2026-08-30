// =============================================================================
// Photo coverage — single source of truth
//
// Photos are recommended, not mandatory: an inspection/report may proceed
// with fewer than the full 8-angle set. But coverage quality (how many
// angles were actually captured and usable) must never be confused with
// workflow completion, and low coverage must never be presented as a
// positive result ("no issues", "all clear"). This module owns:
//   - the count -> tier mapping (INSUFFICIENT / PARTIAL / COMPLETE) used by
//     the live inspection page (tab status, the continue-confirmation gate),
//     the on-screen report, and the PDF — so the three surfaces can't drift
//     apart on what counts as "enough" photos.
//   - what counts as a "valid" photo for that count (excludes placeholders,
//     pending/in-flight analysis, failed uploads, unusable images, and
//     anything not belonging to the vehicle being counted).
// =============================================================================

import { AI_TOTAL_EXPECTED_PHOTOS } from '@/modules/scoring'

/** Full expected angle set — kept in lockstep with the scoring engine's own constant rather than a second hardcoded "8". */
export const FULL_PHOTO_COUNT = AI_TOTAL_EXPECTED_PHOTOS

/** Below this, the user must be explicitly warned and asked to confirm before continuing. */
export const MIN_PHOTOS_BEFORE_WARNING = 3

export type PhotoCoverageTier = 'INSUFFICIENT' | 'PARTIAL' | 'COMPLETE'

/** 0–2 valid photos -> INSUFFICIENT (blocking warning). 3–7 -> PARTIAL (non-blocking notice). 8+ -> COMPLETE. */
export function getPhotoCoverageTier(validPhotoCount: number): PhotoCoverageTier {
  if (validPhotoCount >= FULL_PHOTO_COUNT) return 'COMPLETE'
  if (validPhotoCount >= MIN_PHOTOS_BEFORE_WARNING) return 'PARTIAL'
  return 'INSUFFICIENT'
}

/** True only for the 0–2 tier — the tier that requires an explicit "continue anyway" confirmation. */
export function requiresLowCoverageConfirmation(validPhotoCount: number): boolean {
  return getPhotoCoverageTier(validPhotoCount) === 'INSUFFICIENT'
}

export const PHOTO_COVERAGE_COLOR: Record<PhotoCoverageTier, string> = {
  INSUFFICIENT: '#ef4444',
  PARTIAL: '#f59e0b',
  COMPLETE: '#22c55e',
}

// ─── Per-photo usability ──────────────────────────────────────────────────────
// Moved from src/app/inspection/page.tsx so the live inspection page and the
// on-screen report page (which reads the same localStorage photo drafts, but
// from a different component) share one definition of "usable" instead of
// each re-deriving it from the raw AI result independently.

export interface AIResultLike {
  signal?: string
  imageQuality?: 'good' | 'medium' | 'poor' | 'unusable'
  confidenceScore?: number
  failureReason?: string
  isUsable?: boolean
  usabilityReason?: 'NOT_VEHICLE' | 'LOW_QUALITY' | 'UNCERTAIN' | 'OK'
}

/**
 * Derives usability from the AI result.
 * Trusts the server-supplied `isUsable` field when present (new responses);
 * falls back to local inference for photos restored from localStorage cache.
 */
export function deriveUsability(result: AIResultLike): { isUsable: boolean; usabilityReason: string } {
  if (result.isUsable !== undefined) {
    return { isUsable: result.isUsable, usabilityReason: result.usabilityReason ?? 'OK' }
  }
  if (result.failureReason) return { isUsable: false, usabilityReason: 'LOW_QUALITY' }
  if (result.imageQuality === 'unusable') {
    const sig = (result.signal ?? '').toLowerCase()
    // Only classify as NOT_VEHICLE when the signal unambiguously describes absence
    // of a vehicle — not merely mentions the car ("no car issues", "the car's ...").
    const isVehicleAbsent =
      sig.includes('not inspectable') ||
      sig.includes('no vehicle') ||
      sig.includes('not a vehicle') ||
      /\bno\s+car\s+(?:visible|in\b|is\b|detected|present|found)\b/.test(sig) ||
      /\bcar\s+(?:is\s+)?(?:not|isn't|isnt)\s+(?:visible|present|detected|found)\b/.test(sig) ||
      /\bvehicle\s+(?:is\s+)?(?:not|isn't|isnt)\s+(?:visible|present|detected|found|clearly)\b/.test(sig)
    return {
      isUsable: false,
      usabilityReason: isVehicleAbsent ? 'NOT_VEHICLE' : 'LOW_QUALITY',
    }
  }
  const conf = result.confidenceScore ?? 100
  if (conf < 40) return { isUsable: false, usabilityReason: 'UNCERTAIN' }
  return { isUsable: true, usabilityReason: 'OK' }
}

export function isUsablePhotoResult(result: AIResultLike): boolean {
  return deriveUsability(result).isUsable
}

// ─── Counting ─────────────────────────────────────────────────────────────────

export interface CoveragePhotoLike {
  /** The vehicle/inspection this photo entry belongs to. */
  vehicleId: string
  /** Analysis still in flight — never counts as valid regardless of any stale prior result. */
  isPending: boolean
  /** Absent (not yet analyzed) or present-but-unusable/failed — either way, not valid. */
  aiResult?: AIResultLike | null
}

/**
 * Counts photos that are: for the given vehicle/inspection (guards against
 * stale localStorage from a different vehicle, or a caller passing the wrong
 * scope), not currently pending analysis, and usable per deriveUsability().
 * Placeholders (no aiResult yet), failed uploads, and unusable images are
 * all excluded by construction — there is no separate "isValid" flag to
 * spoof, only the same isPending/aiResult data every other coverage display
 * already reads.
 */
export function countValidPhotos(photos: readonly CoveragePhotoLike[], currentVehicleId: string): number {
  return photos.filter((p) => {
    if (p.vehicleId !== currentVehicleId) return false
    if (p.isPending) return false
    if (!p.aiResult) return false
    return isUsablePhotoResult(p.aiResult)
  }).length
}

// ─── Lightweight "continued with low coverage" acknowledgement ────────────────
// Deliberately NOT server-persisted / NOT a schema change: this is a UX nicety
// (avoid re-nagging the same session), not legal consent evidence. Mirrors the
// existing uci-ai-consent localStorage pattern (see legal-config.ts's
// CURRENT_INSPECTION_START_ACK_VERSION) rather than inventing a new mechanism.

const LOW_PHOTO_COVERAGE_ACK_KEY = 'uci-low-photo-coverage-ack'

export interface LowPhotoCoverageAck {
  vehicleId: string
  photoCoverageAcknowledgedAt: string
  validPhotoCountAtAck: number
}

function readAckList(): LowPhotoCoverageAck[] {
  try {
    const raw = localStorage.getItem(LOW_PHOTO_COVERAGE_ACK_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []
    return parsed.filter((e): e is LowPhotoCoverageAck =>
      !!e && typeof e === 'object' && typeof e.vehicleId === 'string' && typeof e.photoCoverageAcknowledgedAt === 'string',
    )
  } catch {
    return []
  }
}

export function readLowPhotoCoverageAck(vehicleId: string): LowPhotoCoverageAck | null {
  return readAckList().find((e) => e.vehicleId === vehicleId) ?? null
}

export function writeLowPhotoCoverageAck(vehicleId: string, validPhotoCountAtAck: number): void {
  try {
    const list = readAckList().filter((e) => e.vehicleId !== vehicleId)
    list.push({ vehicleId, photoCoverageAcknowledgedAt: new Date().toISOString(), validPhotoCountAtAck })
    localStorage.setItem(LOW_PHOTO_COVERAGE_ACK_KEY, JSON.stringify(list))
  } catch {
    /* non-critical — worst case the user is asked to confirm again */
  }
}
