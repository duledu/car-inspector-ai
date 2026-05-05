// =============================================================================
// AI Analysis — POST /api/ai-analysis/analyze
// Receives per-photo AI results, aggregates them into an AIResult record,
// persists to DB so the scoring service can read findings.
//
// Pipeline steps (T5):
//   1. Auth
//   2. JSON parse + Zod validation
//   3. Vehicle ownership check
//   4. Classify photos as usable vs. unusable
//   5. Convert usable photo results → AIFinding[]
//   6. Calculate overallScore (guarded against all-unusable case)
//   7. Persist AIResult to DB
//   8. Return response with usable/unusable counts
// =============================================================================

import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/config/prisma'
import { requireAuth } from '@/utils/auth.middleware'
import { apiError, logApiError } from '@/utils/api-response'
import { clampScore } from '@/modules/scoring/scoring.logic'
import { generateRequestId, pipelineLog } from '@/lib/logger'
import { env } from '@/config/env'
import { hasActiveAccess } from '@/lib/inspection/access'

const photoResultSchema = z.object({
  angle:          z.string().min(1),
  label:          z.string().min(1),
  signal:         z.string().min(1),
  severity:       z.enum(['ok', 'warn', 'flag']),
  detail:         z.string(),
  confidence:     z.number().finite().int().min(0).max(100).optional().default(80),
  recommendation: z.string().optional().default(''),
  // Explicit usability flag forwarded from the per-photo analysis step (T4/T5).
  // When false the photo must never contribute findings regardless of severity.
  isUsable:       z.boolean().optional(),
})

const bodySchema = z.object({
  vehicleId:    z.string().min(1),
  photoResults: z.array(photoResultSchema).min(1),
})

function mapSeverity(s: 'ok' | 'warn' | 'flag', confidence: number): 'critical' | 'warning' | 'info' {
  if (confidence < 45) return 'info'
  if (s === 'flag') return confidence >= 78 ? 'critical' : 'warning'
  if (s === 'warn') return confidence >= 55 ? 'warning' : 'info'
  return 'info'
}

/**
 * A photo is unusable when the caller has explicitly marked it so OR when
 * its confidence was zeroed (the sentinel value set by the client for unusable
 * images so they can't contribute false findings).
 */
function isPhotoUnusable(r: z.infer<typeof photoResultSchema>): boolean {
  return r.isUsable === false || r.confidence === 0
}

export async function POST(req: NextRequest) {
  const auth = await requireAuth(req)
  if (!auth.success) {
    return apiError(auth.reason, { status: 401, code: 'UNAUTHORIZED' })
  }

  let body: unknown
  try { body = await req.json() } catch {
    return apiError('Invalid JSON', { status: 400, code: 'BAD_REQUEST' })
  }

  const parsed = bodySchema.safeParse(body)
  if (!parsed.success) {
    return apiError('Validation failed', { status: 422, code: 'VALIDATION_ERROR' })
  }

  const requestId = generateRequestId()
  const reqStart  = Date.now()
  const { vehicleId, photoResults } = parsed.data

  // Step 3: Vehicle ownership check
  try {
    const vehicle = await prisma.vehicle.findFirst({
      where: { id: vehicleId, userId: auth.userId },
      select: { id: true },
    })
    if (!vehicle) {
      return apiError('Vehicle not found', { status: 404, code: 'NOT_FOUND' })
    }
  } catch (err) {
    logApiError('ai-analysis/analyze', 'findVehicle', err, { vehicleId })
    return apiError('Failed to verify vehicle', { status: 500, code: 'INTERNAL_ERROR' })
  }

  // Step 3b: Access gate (only enforced when FEATURE_INSPECTION_ACCESS_GATE=true)
  if (env.features.inspectionAccessGate) {
    const allowed = await hasActiveAccess(auth.userId, vehicleId)
    if (!allowed) {
      return apiError('Inspection access required', { status: 403, code: 'ACCESS_REQUIRED' })
    }
  }

  // Step 4: Classify photos as usable vs. unusable
  const analyzedCount  = photoResults.length
  const unusablePhotos = photoResults.filter(isPhotoUnusable)
  const usablePhotos   = photoResults.filter(r => !isPhotoUnusable(r))
  const usableCount    = usablePhotos.length
  const unusableCount  = unusablePhotos.length

  pipelineLog({
    step: 'ai-aggregate:start',
    requestId,
    vehicleId,
    userId: auth.userId,
    success: true,
    durationMs: 0,
    meta: { photoCount: analyzedCount, usableCount, unusableCount },
  })

  if (unusableCount > 0) {
    pipelineLog({
      step: 'ai-aggregate:unusable-photos',
      requestId,
      vehicleId,
      success: unusableCount < analyzedCount, // false only when ALL photos unusable
      durationMs: Date.now() - reqStart,
      meta: {
        unusableCount,
        usableCount,
        unusableAngles: unusablePhotos.map(r => r.angle),
        allUnusable: usableCount === 0,
      },
    })
  }

  // Step 5: Convert usable photo results → AIFinding[]
  // Unusable photos are excluded entirely — they must never appear as findings.
  const findings = usablePhotos
    .filter(r => r.severity !== 'ok' && r.confidence >= 45)
    .map((r, i) => ({
      id:             `${r.angle}-${i}`,
      area:           r.label,
      title:          r.signal,
      description:    r.detail,
      severity:       mapSeverity(r.severity, r.confidence),
      confidence:     clampScore(r.confidence, 0, 100, 80),
      recommendation: r.recommendation ?? '',
    }))
    .filter(f => f.severity !== 'info')

  // Step 6: Calculate overallScore
  // Guard: if no photos were usable the batch produced zero signal — use a
  // neutral 50 rather than 100 so the DB record is not misleadingly "perfect".
  let overallScore: number
  if (usableCount === 0) {
    overallScore = 50
  } else {
    const overallPenalty = findings.reduce((sum, finding) => {
      const confidenceFactor = clampScore(finding.confidence, 0, 100, 0) / 100
      const basePenalty = finding.severity === 'critical' ? 16 : 5
      return sum + basePenalty * Math.max(0.45, confidenceFactor)
    }, 0)
    overallScore = clampScore(100 - overallPenalty, 0, 100, 100)
  }

  // Step 7: Persist AIResult to DB
  try {
    const dbStart = Date.now()
    const result = await prisma.aIResult.create({
      data: {
        vehicleId,
        analysisType: 'PAINT_ANALYSIS',
        findings:     findings as object[],
        overallScore,
        modelVersion: 'gpt-4o-v1',
      },
    })

    pipelineLog({
      step: 'ai-aggregate:complete',
      requestId,
      vehicleId,
      durationMs: Date.now() - reqStart,
      success: true,
      meta: {
        photoCount:    analyzedCount,
        usableCount,
        unusableCount,
        findingsCount: findings.length,
        overallScore:  result.overallScore,
        dbWriteMs:     Date.now() - dbStart,
      },
    })

    // Step 8: Return response
    return NextResponse.json({
      data: {
        id:            result.id,
        vehicleId:     result.vehicleId,
        findings,
        overallScore:  result.overallScore,
        modelVersion:  result.modelVersion,
        createdAt:     result.createdAt.toISOString(),
        analyzedCount,
        usableCount,
        unusableCount,
        // Kept for backward compatibility — callers that only check failedCount still work.
        failedCount: unusableCount,
      },
    })
  } catch (err: unknown) {
    pipelineLog({
      step: 'ai-aggregate:failed',
      requestId,
      vehicleId,
      durationMs: Date.now() - reqStart,
      success: false,
      meta: { error: err instanceof Error ? err.message : String(err) },
    })
    logApiError('ai-analysis/analyze', 'saveAnalysis', err, { vehicleId })
    return apiError('Failed to save analysis', { status: 500, code: 'INTERNAL_ERROR' })
  }
}
