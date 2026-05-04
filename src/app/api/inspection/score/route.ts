import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { isDatabaseUnavailableError } from '@/config/prisma'
import { scoringService } from '@/modules/scoring'
import { requireAuth } from '@/utils/auth.middleware'
import { apiError, logApiError } from '@/utils/api-response'
import { generateRequestId, pipelineLog } from '@/lib/logger'

const BodySchema = z.object({ vehicleId: z.string().min(1) })

export async function POST(req: NextRequest) {
  const auth = await requireAuth(req)
  if (!auth.success) return apiError(auth.reason, { status: 401, code: 'UNAUTHORIZED' })

  const parsed = BodySchema.safeParse(await req.json().catch(() => ({})))
  if (!parsed.success) {
    return apiError('vehicleId is required', { status: 400, code: 'VALIDATION_ERROR' })
  }

  const requestId = generateRequestId()
  const reqStart  = Date.now()
  const vehicleId = parsed.data.vehicleId
  pipelineLog({ step: 'score:start', requestId, vehicleId, userId: auth.userId, success: true, durationMs: 0 })

  try {
    const score = await scoringService.computeAndPersist(vehicleId, auth.userId)
    pipelineLog({ step: 'score:complete', requestId, vehicleId, durationMs: Date.now() - reqStart, success: true, meta: { buyScore: score.buyScore, verdict: score.verdict, hasPremiumData: score.hasPremiumData } })
    return NextResponse.json({ data: score })
  } catch (err: any) {
    pipelineLog({ step: 'score:failed', requestId, vehicleId, durationMs: Date.now() - reqStart, success: false, meta: { error: err?.message ?? 'unknown' } })
    if (isDatabaseUnavailableError(err)) {
      return apiError('Database unavailable', { status: 503, code: 'DATABASE_UNAVAILABLE' })
    }
    if (err?.message === 'VEHICLE_NOT_FOUND') {
      return apiError('Vehicle not found', { status: 404, code: 'NOT_FOUND' })
    }
    if (err?.message === 'INSPECTION_INCOMPLETE') {
      return apiError('Inspection is incomplete', {
        status: 409,
        code: 'INSPECTION_INCOMPLETE',
        details: (err as { details?: unknown })?.details,
      })
    }
    logApiError('inspection/score', 'computeAndPersist', err, { vehicleId })
    return apiError('Score calculation failed', { status: 500, code: 'INTERNAL_ERROR' })
  }
}
