import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/config/prisma'
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

    return NextResponse.json({ data: session })
  } catch (err) {
    logApiError('inspection/session/[id]', 'getSession', err, { sessionId: params.id })
    return apiError('Failed to fetch inspection session', { status: 500, code: 'INTERNAL_ERROR' })
  }
}
