import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/config/prisma'
import { requireAuth } from '@/utils/auth.middleware'
import { apiError, logApiError } from '@/utils/api-response'

const CreateSchema = z.object({
  title: z.string().min(1).max(200),
  content: z.string().min(1),
  tags: z.array(z.string()).default([]),
  vehicleId: z.string().optional(),
  images: z.array(z.string()).default([]),
})

const POST_SELECT = {
  id: true,
  title: true,
  content: true,
  tags: true,
  images: true,
  published: true,
  viewCount: true,
  createdAt: true,
  updatedAt: true,
  author: { select: { id: true, name: true, avatarUrl: true } },
  vehicleId: true,
  _count: { select: { comments: true, likes: true } },
} as const

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const page = Math.max(1, parseInt(searchParams.get('page') ?? '1'))
  const limit = 20
  const tag = searchParams.get('tag')

  const where = {
    published: true,
    ...(tag ? { tags: { has: tag } } : {}),
  }

  try {
    const [posts, total] = await Promise.all([
      prisma.post.findMany({
        where,
        select: POST_SELECT,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.post.count({ where }),
    ])

  // Try to get current user for isLikedByMe
  let userId: string | null = null
  try {
    const auth = await requireAuth(req)
    if (auth.success) userId = auth.userId
  } catch {}

  let likedIds = new Set<string>()
  if (userId && posts.length > 0) {
    const likes = await prisma.like.findMany({
      where: { userId, postId: { in: posts.map((p) => p.id) } },
      select: { postId: true },
    })
    likedIds = new Set(likes.map((l) => l.postId))
  }

  const shaped = posts.map((p) => ({
    id: p.id,
    title: p.title,
    content: p.content,
    tags: p.tags,
    images: p.images,
    published: p.published,
    viewCount: p.viewCount,
    likeCount: p._count.likes,
    commentCount: p._count.comments,
    isLikedByMe: likedIds.has(p.id),
    author: p.author,
    vehicleId: p.vehicleId,
    createdAt: p.createdAt.toISOString(),
    updatedAt: p.updatedAt.toISOString(),
  }))

    return NextResponse.json({
      data: {
        data: shaped,
        total,
        page,
        limit,
        hasMore: page * limit < total,
      },
    })
  } catch (err) {
    logApiError('community/posts', 'listPosts', err)
    return apiError('Failed to fetch posts', { status: 500, code: 'INTERNAL_ERROR' })
  }
}

export async function POST(req: NextRequest) {
  const auth = await requireAuth(req)
  if (!auth.success) return apiError(auth.reason, { status: 401, code: 'UNAUTHORIZED' })

  let body: unknown
  try {
    body = await req.json()
  } catch {
    return apiError('Invalid JSON', { status: 400, code: 'BAD_REQUEST' })
  }
  const parsed = CreateSchema.safeParse(body)
  if (!parsed.success) {
    return apiError('Validation failed', { status: 400, code: 'VALIDATION_ERROR', details: parsed.error.flatten() })
  }

  try {
    const post = await prisma.post.create({
      data: {
        authorId: auth.userId,
        ...parsed.data,
      },
      select: POST_SELECT,
    })

    return NextResponse.json({
      data: {
        ...post,
        likeCount: post._count.likes,
        commentCount: post._count.comments,
        isLikedByMe: false,
        createdAt: post.createdAt.toISOString(),
        updatedAt: post.updatedAt.toISOString(),
      },
    }, { status: 201 })
  } catch (err) {
    logApiError('community/posts', 'createPost', err)
    return apiError('Failed to create post', { status: 500, code: 'INTERNAL_ERROR' })
  }
}
