import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/config/prisma'
import { requireAuth } from '@/utils/auth.middleware'
import { apiError, logApiError } from '@/utils/api-response'

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requireAuth(req)
  if (!auth.success) return apiError(auth.reason, { status: 401, code: 'UNAUTHORIZED' })

  try {
    const existing = await prisma.like.findUnique({
      where: { postId_userId: { postId: params.id, userId: auth.userId } },
    })

    let liked: boolean
    if (existing) {
      await prisma.like.delete({ where: { postId_userId: { postId: params.id, userId: auth.userId } } })
      liked = false
    } else {
      await prisma.like.create({ data: { postId: params.id, userId: auth.userId } })
      liked = true
    }

    const count = await prisma.like.count({ where: { postId: params.id } })
    return NextResponse.json({ data: { liked, count } })
  } catch (err) {
    logApiError('community/posts/[id]/like', 'toggleLike', err, { postId: params.id })
    return apiError('Failed to update like', { status: 500, code: 'INTERNAL_ERROR' })
  }
}
