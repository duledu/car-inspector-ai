// =============================================================================
// Inspection Score API Route — POST /api/inspection/score
// Triggers score calculation for the authenticated user's vehicle.
// =============================================================================

import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { scoringService } from '@/modules/scoring'
import { requireAuth } from '@/utils/auth.middleware'

const schema = z.object({ vehicleId: z.string().min(1) })

export async function POST(req: NextRequest) {
  const authResult = await requireAuth(req)
  if (!authResult.success) {
    return NextResponse.json({ message: 'Unauthorized', code: 'UNAUTHORIZED' }, { status: 401 })
  }

  const parsed = schema.safeParse(await req.json().catch(() => ({})))
  if (!parsed.success) {
    return NextResponse.json({ message: 'vehicleId is required', code: 'VALIDATION_ERROR' }, { status: 422 })
  }

  try {
    const score = await scoringService.computeAndPersist(parsed.data.vehicleId, authResult.userId)
    return NextResponse.json({ data: score })
  } catch (err: any) {
    console.error('[inspection/score] Error:', err)
    return NextResponse.json({ message: 'Score calculation failed', code: 'INTERNAL_ERROR' }, { status: 500 })
  }
}

export async function GET(req: NextRequest) {
  const authResult = await requireAuth(req)
  if (!authResult.success) {
    return NextResponse.json({ message: 'Unauthorized', code: 'UNAUTHORIZED' }, { status: 401 })
  }

  const vehicleId = req.nextUrl.searchParams.get('vehicleId')
  if (!vehicleId) {
    return NextResponse.json({ message: 'vehicleId query param required', code: 'VALIDATION_ERROR' }, { status: 422 })
  }

  const score = await scoringService.getLatest(vehicleId)
  return NextResponse.json({ data: score })
}
