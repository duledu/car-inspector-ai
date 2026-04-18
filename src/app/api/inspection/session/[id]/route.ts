import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/config/prisma'
import { reconcileInspectionChecklist } from '@/lib/inspection/checklist.server'
import { requireAuth } from '@/utils/auth.middleware'
import { apiError, logApiError } from '@/utils/api-response'

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requireAuth(req)
  if (!auth.success) return apiError(auth.reason, { status: 401, code: 'UNAUTHORIZED' })

  try {
    const session = await prisma.inspectionSession.findFirst({
      where: { id: params.id, userId: auth.userId },
      include: { checklistItems: { orderBy: { createdAt: 'asc' } } },
    })

    if (!session) return apiError('Not found', { status: 404, code: 'NOT_FOUND' })

    const reconciled = await reconcileInspectionChecklist(session.id, session.checklistItems)
    return NextResponse.json({ data: reconciled ?? session })
  } catch (err) {
    logApiError('inspection/session/[id]', 'getSession', err, { sessionId: params.id })
    return apiError('Failed to fetch inspection session', { status: 500, code: 'INTERNAL_ERROR' })
  }
}
