import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/config/prisma'
import { requireAuth } from '@/utils/auth.middleware'
import { scoringService } from '@/modules/scoring'

export async function GET(req: NextRequest, { params }: { params: { vehicleId: string } }) {
  const auth = await requireAuth(req)
  if (!auth.success) return NextResponse.json({ message: auth.reason }, { status: 401 })

  // Verify vehicle belongs to user
  const vehicle = await prisma.vehicle.findFirst({
    where: { id: params.vehicleId, userId: auth.userId },
  })
  if (!vehicle) return NextResponse.json({ message: 'Vehicle not found' }, { status: 404 })

  const score = await scoringService.getLatest(params.vehicleId)
  return NextResponse.json({ data: score })
}
