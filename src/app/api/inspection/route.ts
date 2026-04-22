// =============================================================================
// Inspection Score API Route — POST /api/inspection/score
// Triggers score calculation for the authenticated user's vehicle.
// =============================================================================

import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { scoringService } from '@/modules/scoring'
import { requireAuth } from '@/utils/auth.middleware'
import { apiError, logApiError } from '@/utils/api-response'
import { isDatabaseUnavailableError } from '@/config/prisma'

const schema = z.object({ vehicleId: z.string().min(1) })

export async function POST(req: NextRequest) {
  const authResult = await requireAuth(req)
  if (!authResult.success) {
    return apiError('Unauthorized', { status: 401, code: 'UNAUTHORIZED' })
  }

  const parsed = schema.safeParse(await req.json().catch(() => ({})))
  if (!parsed.success) {
    return apiError('vehicleId is required', { status: 422, code: 'VALIDATION_ERROR' })
  }

  try {
    const score = await scoringService.computeAndPersist(parsed.data.vehicleId, authResult.userId)
    return NextResponse.json({ data: score })
  } catch (err: any) {
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
    logApiError('inspection', 'computeAndPersist', err, { vehicleId: parsed.data.vehicleId })
    return apiError('Score calculation failed', { status: 500, code: 'INTERNAL_ERROR' })
  }
}

export async function GET(req: NextRequest) {
  const authResult = await requireAuth(req)
  if (!authResult.success) {
    return apiError('Unauthorized', { status: 401, code: 'UNAUTHORIZED' })
  }

  const vehicleId = req.nextUrl.searchParams.get('vehicleId')
  if (!vehicleId) {
    return apiError('vehicleId query param required', { status: 422, code: 'VALIDATION_ERROR' })
  }

  try {
    const score = await scoringService.getLatest(vehicleId)
    return NextResponse.json({ data: score })
  } catch (err) {
    if (isDatabaseUnavailableError(err)) {
      return apiError('Database unavailable', { status: 503, code: 'DATABASE_UNAVAILABLE' })
    }
    logApiError('inspection', 'getLatest', err, { vehicleId })
    return apiError('Failed to fetch score', { status: 500, code: 'INTERNAL_ERROR' })
  }
}
