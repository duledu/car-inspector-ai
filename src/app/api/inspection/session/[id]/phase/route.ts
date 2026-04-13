import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/config/prisma'
import { requireAuth } from '@/utils/auth.middleware'
import { apiError, logApiError } from '@/utils/api-response'

const PHASES = [
  'PRE_SCREENING', 'AI_PHOTOS', 'EXTERIOR', 'INTERIOR',
  'MECHANICAL', 'TEST_DRIVE', 'VIN_DOCS', 'RISK_ANALYSIS', 'FINAL_REPORT',
] as const

const BodySchema = z.object({ phase: z.enum(PHASES) })

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requireAuth(req)
  if (!auth.success) return apiError(auth.reason, { status: 401, code: 'UNAUTHORIZED' })

  try {
    const session = await prisma.inspectionSession.findFirst({
      where: { id: params.id, userId: auth.userId },
    })
    if (!session) return apiError('Not found', { status: 404, code: 'NOT_FOUND' })

    let body: unknown
    try {
      body = await req.json()
    } catch {
      return apiError('Invalid JSON', { status: 400, code: 'BAD_REQUEST' })
    }
    const parsed = BodySchema.safeParse(body)
    if (!parsed.success) {
      return apiError('Invalid phase', { status: 400, code: 'VALIDATION_ERROR' })
    }

    const updated = await prisma.inspectionSession.update({
      where: { id: params.id },
      data: {
        phase: parsed.data.phase,
        completedAt: parsed.data.phase === 'FINAL_REPORT' ? new Date() : undefined,
      },
    })

    return NextResponse.json({ data: updated })
  } catch (err) {
    logApiError('inspection/session/[id]/phase', 'updatePhase', err, { sessionId: params.id })
    return apiError('Failed to update inspection phase', { status: 500, code: 'INTERNAL_ERROR' })
  }
}
