import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/config/prisma'
import { requireAuth } from '@/utils/auth.middleware'
import { apiError, logApiError } from '@/utils/api-response'

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requireAuth(req)
  if (!auth.success) return apiError(auth.reason, { status: 401, code: 'UNAUTHORIZED' })

  try {
    await prisma.conversationParticipant.updateMany({
      where: { conversationId: params.id, userId: auth.userId },
      data: { lastReadAt: new Date() },
    })

    return NextResponse.json({ data: { ok: true } })
  } catch (err) {
    logApiError('messaging/conversations/[id]/read', 'markRead', err, { conversationId: params.id })
    return apiError('Failed to mark conversation as read', { status: 500, code: 'INTERNAL_ERROR' })
  }
}
