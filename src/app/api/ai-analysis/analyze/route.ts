// =============================================================================
// AI Analysis — POST /api/ai-analysis/analyze
// Receives per-photo AI results, aggregates them into an AIResult record,
// persists to DB so the scoring service can read findings.
// =============================================================================

import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/config/prisma'
import { requireAuth } from '@/utils/auth.middleware'
import { apiError, logApiError } from '@/utils/api-response'
import { clampScore } from '@/modules/scoring/scoring.logic'
import { generateRequestId, pipelineLog } from '@/lib/logger'

const photoResultSchema = z.object({
  angle:          z.string().min(1),
  label:          z.string().min(1),
  signal:         z.string().min(1),
  severity:       z.enum(['ok', 'warn', 'flag']),
  detail:         z.string(),
  confidence:     z.number().finite().int().min(0).max(100).optional().default(80),
  recommendation: z.string().optional().default(''),
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

  pipelineLog({ step: 'ai-aggregate:start', requestId, vehicleId, userId: auth.userId, success: true, durationMs: 0, meta: { photoCount: photoResults.length } })

  const analyzedCount = photoResults.length
  const failedCount   = photoResults.filter(r => r.severity === 'warn' && r.signal.toLowerCase().includes('unavailable')).length

  // Convert per-photo results → AIFinding[] (skip "ok" ones to reduce noise)
  const findings = photoResults
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

  const overallPenalty = findings.reduce((sum, finding) => {
    const confidenceFactor = clampScore(finding.confidence, 0, 100, 0) / 100
    const basePenalty = finding.severity === 'critical' ? 16 : 5
    return sum + basePenalty * Math.max(0.45, confidenceFactor)
  }, 0)
  const overallScore = clampScore(100 - overallPenalty, 0, 100, 100)

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

    pipelineLog({ step: 'ai-aggregate:complete', requestId, vehicleId, durationMs: Date.now() - reqStart, success: true, meta: { photoCount: analyzedCount, failedCount, findingsCount: findings.length, overallScore: result.overallScore, dbWriteMs: Date.now() - dbStart } })

    return NextResponse.json({
      data: {
        id:            result.id,
        vehicleId:     result.vehicleId,
        findings,
        overallScore:  result.overallScore,
        modelVersion:  result.modelVersion,
        createdAt:     result.createdAt.toISOString(),
        analyzedCount,
        failedCount,
      },
    })
  } catch (err: any) {
    pipelineLog({ step: 'ai-aggregate:failed', requestId, vehicleId, durationMs: Date.now() - reqStart, success: false, meta: { error: err instanceof Error ? err.message : String(err) } })
    logApiError('ai-analysis/analyze', 'saveAnalysis', err, { vehicleId })
    return apiError('Failed to save analysis', { status: 500, code: 'INTERNAL_ERROR' })
  }
}
