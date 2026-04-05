import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/config/prisma'
import { requireAuth } from '@/utils/auth.middleware'

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requireAuth(req)
  if (!auth.success) return NextResponse.json({ message: auth.reason }, { status: 401 })

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
}
