import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/config/prisma'
import { requireAuth } from '@/utils/auth.middleware'

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requireAuth(req)
  if (!auth.success) return NextResponse.json({ message: auth.reason }, { status: 401 })

  await prisma.conversationParticipant.updateMany({
    where: { conversationId: params.id, userId: auth.userId },
    data: { lastReadAt: new Date() },
  })

  return NextResponse.json({ data: { ok: true } })
}
