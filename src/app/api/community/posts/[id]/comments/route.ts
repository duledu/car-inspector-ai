import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/config/prisma'
import { requireAuth } from '@/utils/auth.middleware'

const CreateSchema = z.object({ content: z.string().min(1) })

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const comments = await prisma.comment.findMany({
    where: { postId: params.id },
    include: { author: { select: { id: true, name: true, avatarUrl: true } } },
    orderBy: { createdAt: 'asc' },
  })

  const shaped = comments.map((c) => ({
    id: c.id,
    postId: c.postId,
    authorId: c.authorId,
    author: c.author,
    content: c.content,
    createdAt: c.createdAt.toISOString(),
  }))

  return NextResponse.json({ data: shaped })
}

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requireAuth(req)
  if (!auth.success) return NextResponse.json({ message: auth.reason }, { status: 401 })

  const body = await req.json()
  const parsed = CreateSchema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ message: 'content is required' }, { status: 400 })

  const comment = await prisma.comment.create({
    data: {
      postId: params.id,
      authorId: auth.userId,
      content: parsed.data.content,
    },
    include: { author: { select: { id: true, name: true, avatarUrl: true } } },
  })

  return NextResponse.json({
    data: {
      id: comment.id,
      postId: comment.postId,
      authorId: comment.authorId,
      author: comment.author,
      content: comment.content,
      createdAt: comment.createdAt.toISOString(),
    },
  }, { status: 201 })
}
