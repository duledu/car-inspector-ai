// =============================================================================
// AIResult.findings JSON payload — backward-compatible shape
//
// AIResult is one AGGREGATE row per analysis run (created once when all of a
// vehicle's photo results are batched and posted to /api/ai-analysis/analyze
// — see that route's own docstring). Its `findings` Json column has always
// stored a bare AIFinding[] array. That array only ever contains ACTIONABLE
// findings (severity != 'ok' && confidence >= 45) — a clean, fully-usable
// photo contributes ZERO entries — so neither `findings.length` nor the
// number of AIResult ROWS (almost always 0 or 1 per vehicle) can ever recover
// how many photos were actually analyzed/usable. That count (`usableCount`)
// WAS already computed correctly server-side at write time, but was
// historically discarded rather than persisted, and is exactly what the
// scoring engine's visualCoverage (see scoring.logic.ts) needs to avoid
// misclassifying coverage.
//
// Fix: store an object wrapper carrying the counts alongside the findings,
// instead of the bare array — no Prisma schema change (Json accepts any
// shape). Every reader MUST go through parseAIResultPayload so old
// (pre-fix) rows — which still hold the bare-array shape — keep working,
// just without count metadata (treated as unknown, never guessed).
// =============================================================================

import type { AIFinding } from '@/types'

export interface AIResultPayload {
  items: AIFinding[]
  analyzedCount: number
  usableCount: number
  unusableCount: number
}

export function buildAIResultPayload(
  items: AIFinding[],
  analyzedCount: number,
  usableCount: number,
  unusableCount: number
): AIResultPayload {
  return { items, analyzedCount, usableCount, unusableCount }
}

export interface ParsedAIResult {
  findings: AIFinding[]
  /** null when this row predates the count fix (bare-array legacy shape) — genuinely unknown, never guessed. */
  usableCount: number | null
}

/**
 * Reads AIResult.findings in either shape:
 *   - legacy: a bare AIFinding[] array (usableCount unrecoverable -> null)
 *   - current: { items, analyzedCount, usableCount, unusableCount }
 */
export function parseAIResultPayload(raw: unknown): ParsedAIResult {
  if (Array.isArray(raw)) {
    return { findings: raw as AIFinding[], usableCount: null }
  }
  if (raw && typeof raw === 'object' && Array.isArray((raw as { items?: unknown }).items)) {
    const obj = raw as Partial<AIResultPayload>
    const usableCount = typeof obj.usableCount === 'number' && Number.isFinite(obj.usableCount) ? obj.usableCount : null
    return { findings: (obj.items as AIFinding[]) ?? [], usableCount }
  }
  return { findings: [], usableCount: null }
}
