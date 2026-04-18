import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/config/prisma'
import { COMPACT_INSPECTION_CHECKLIST } from '@/lib/inspection/checklist'
import { reconcileInspectionChecklist } from '@/lib/inspection/checklist.server'
import { requireAuth } from '@/utils/auth.middleware'
import { apiError, logApiError } from '@/utils/api-response'

const BodySchema = z.object({ vehicleId: z.string() })

export async function POST(req: NextRequest) {
  const auth = await requireAuth(req)
  if (!auth.success) return apiError(auth.reason, { status: 401, code: 'UNAUTHORIZED' })

  let body: unknown
  try {
    body = await req.json()
  } catch {
    return apiError('Invalid JSON', { status: 400, code: 'BAD_REQUEST' })
  }
  const parsed = BodySchema.safeParse(body)
  if (!parsed.success) {
    return apiError('vehicleId is required', { status: 400, code: 'VALIDATION_ERROR' })
  }

  const { vehicleId } = parsed.data

  try {
    // Verify vehicle belongs to user
    const vehicle = await prisma.vehicle.findFirst({ where: { id: vehicleId, userId: auth.userId } })
    if (!vehicle) return apiError('Vehicle not found', { status: 404, code: 'NOT_FOUND' })

    // Return existing session if found
    const existing = await prisma.inspectionSession.findFirst({
      where: { userId: auth.userId, vehicleId },
      include: { checklistItems: { orderBy: { createdAt: 'asc' } } },
      orderBy: { createdAt: 'desc' },
    })

    if (existing) {
      const reconciled = await reconcileInspectionChecklist(existing.id, existing.checklistItems)
      return NextResponse.json({ data: reconciled ?? existing })
    }

    // Create new session with seeded checklist items
    const session = await prisma.inspectionSession.create({
      data: {
        userId: auth.userId,
        vehicleId,
        phase: 'PRE_SCREENING',
        checklistItems: {
          create: COMPACT_INSPECTION_CHECKLIST.map((item) => ({
            ...item,
            status: 'PENDING',
          })),
        },
      },
      include: { checklistItems: { orderBy: { createdAt: 'asc' } } },
    })

    return NextResponse.json({ data: session }, { status: 201 })
  } catch (err) {
    logApiError('inspection/session', 'getOrCreateSession', err, { vehicleId })
    return apiError('Failed to load inspection session', { status: 500, code: 'INTERNAL_ERROR' })
  }
}
