import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/config/prisma'
import { requireAuth } from '@/utils/auth.middleware'
import { apiError, logApiError } from '@/utils/api-response'

const BodySchema = z.object({
  status: z.enum(['PENDING', 'OK', 'WARNING', 'PROBLEM']),
  notes: z.string().optional(),
  photoUrl: z.string().url().optional(),
})

export async function PATCH(req: NextRequest, { params }: { params: { itemId: string } }) {
  const auth = await requireAuth(req)
  if (!auth.success) return apiError(auth.reason, { status: 401, code: 'UNAUTHORIZED' })

  try {
    // Verify item belongs to a session owned by the user
    const item = await prisma.checklistItem.findFirst({
      where: {
        id: params.itemId,
        session: { userId: auth.userId },
      },
    })
    if (!item) return apiError('Not found', { status: 404, code: 'NOT_FOUND' })

    let body: unknown
    try {
      body = await req.json()
    } catch {
      return apiError('Invalid JSON', { status: 400, code: 'BAD_REQUEST' })
    }
    const parsed = BodySchema.safeParse(body)
    if (!parsed.success) {
      return apiError('Validation failed', { status: 400, code: 'VALIDATION_ERROR', details: parsed.error.flatten() })
    }

    const updated = await prisma.checklistItem.update({
      where: { id: params.itemId },
      data: parsed.data,
    })

    return NextResponse.json({ data: updated })
  } catch (err) {
    logApiError('inspection/checklist/[itemId]', 'updateChecklistItem', err, { itemId: params.itemId })
    return apiError('Failed to update checklist item', { status: 500, code: 'INTERNAL_ERROR' })
  }
}
