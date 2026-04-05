import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/config/prisma'
import { requireAuth } from '@/utils/auth.middleware'

const PHASES = [
  'PRE_SCREENING', 'AI_PHOTOS', 'EXTERIOR', 'INTERIOR',
  'MECHANICAL', 'TEST_DRIVE', 'VIN_DOCS', 'RISK_ANALYSIS', 'FINAL_REPORT',
] as const

const BodySchema = z.object({ phase: z.enum(PHASES) })

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requireAuth(req)
  if (!auth.success) return NextResponse.json({ message: auth.reason }, { status: 401 })

  const session = await prisma.inspectionSession.findFirst({
    where: { id: params.id, userId: auth.userId },
  })
  if (!session) return NextResponse.json({ message: 'Not found' }, { status: 404 })

  const body = await req.json()
  const parsed = BodySchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ message: 'Invalid phase' }, { status: 400 })
  }

  const updated = await prisma.inspectionSession.update({
    where: { id: params.id },
    data: {
      phase: parsed.data.phase,
      completedAt: parsed.data.phase === 'FINAL_REPORT' ? new Date() : undefined,
    },
  })

  return NextResponse.json({ data: updated })
}
