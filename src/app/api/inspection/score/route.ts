import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { scoringService } from '@/modules/scoring'
import { requireAuth } from '@/utils/auth.middleware'
import { apiError, logApiError } from '@/utils/api-response'

const BodySchema = z.object({ vehicleId: z.string().min(1) })

export async function POST(req: NextRequest) {
  const auth = await requireAuth(req)
  if (!auth.success) return apiError(auth.reason, { status: 401, code: 'UNAUTHORIZED' })

  const parsed = BodySchema.safeParse(await req.json().catch(() => ({})))
  if (!parsed.success) {
    return apiError('vehicleId is required', { status: 400, code: 'VALIDATION_ERROR' })
  }

  try {
    const score = await scoringService.computeAndPersist(parsed.data.vehicleId, auth.userId)
    return NextResponse.json({ data: score })
  } catch (err: any) {
    if (err?.message === 'VEHICLE_NOT_FOUND') {
      return apiError('Vehicle not found', { status: 404, code: 'NOT_FOUND' })
    }
    logApiError('inspection/score', 'computeAndPersist', err, { vehicleId: parsed.data.vehicleId })
    return apiError('Score calculation failed', { status: 500, code: 'INTERNAL_ERROR' })
  }
}
