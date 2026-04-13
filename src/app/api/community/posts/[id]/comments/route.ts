import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/config/prisma'
import { requireAuth } from '@/utils/auth.middleware'
import { apiError, logApiError } from '@/utils/api-response'

const CreateSchema = z.object({ content: z.string().min(1) })

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  try {
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
  } catch (err) {
    logApiError('community/posts/[id]/comments', 'listComments', err, { postId: params.id })
    return apiError('Failed to fetch comments', { status: 500, code: 'INTERNAL_ERROR' })
  }
}

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requireAuth(req)
  if (!auth.success) return apiError(auth.reason, { status: 401, code: 'UNAUTHORIZED' })

  let body: unknown
  try {
    body = await req.json()
  } catch {
    return apiError('Invalid JSON', { status: 400, code: 'BAD_REQUEST' })
  }
  const parsed = CreateSchema.safeParse(body)
  if (!parsed.success) return apiError('content is required', { status: 400, code: 'VALIDATION_ERROR' })

  try {
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
  } catch (err) {
    logApiError('community/posts/[id]/comments', 'createComment', err, { postId: params.id })
    return apiError('Failed to create comment', { status: 500, code: 'INTERNAL_ERROR' })
  }
}
