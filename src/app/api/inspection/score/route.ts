import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { scoringService } from '@/modules/scoring'
import { requireAuth } from '@/utils/auth.middleware'

const BodySchema = z.object({ vehicleId: z.string().min(1) })

export async function POST(req: NextRequest) {
  const auth = await requireAuth(req)
  if (!auth.success) return NextResponse.json({ message: auth.reason }, { status: 401 })

  const parsed = BodySchema.safeParse(await req.json().catch(() => ({})))
  if (!parsed.success) {
    return NextResponse.json({ message: 'vehicleId is required' }, { status: 400 })
  }

  try {
    const score = await scoringService.computeAndPersist(parsed.data.vehicleId, auth.userId)
    return NextResponse.json({ data: score })
  } catch (err: any) {
    if (err?.message === 'VEHICLE_NOT_FOUND') {
      return NextResponse.json({ message: 'Vehicle not found', code: 'NOT_FOUND' }, { status: 404 })
    }
    return NextResponse.json({ message: err?.message ?? 'Score calculation failed' }, { status: 500 })
  }
}
