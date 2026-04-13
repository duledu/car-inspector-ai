import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/config/prisma'
import { requireAuth } from '@/utils/auth.middleware'
import { apiError, logApiError } from '@/utils/api-response'

const CreateSchema = z.object({ recipientId: z.string() })

export async function GET(req: NextRequest) {
  const auth = await requireAuth(req)
  if (!auth.success) return apiError(auth.reason, { status: 401, code: 'UNAUTHORIZED' })

  try {
    const conversations = await prisma.conversation.findMany({
    where: {
      participants: { some: { userId: auth.userId } },
    },
    include: {
      participants: { include: { user: { select: { id: true, name: true, avatarUrl: true } } } },
      messages: {
        orderBy: { createdAt: 'desc' },
        take: 1,
        include: { sender: { select: { id: true, name: true, avatarUrl: true } } },
      },
    },
    orderBy: { updatedAt: 'desc' },
  })

  const shaped = conversations.map((conv) => {
    const myParticipant = conv.participants.find((p) => p.userId === auth.userId)
    const lastMsg = conv.messages[0] ?? null
    const unreadCount = 0 // Simplified — can be computed later with lastReadAt

    return {
      id: conv.id,
      participants: conv.participants.map((p) => ({
        userId: p.userId,
        user: p.user,
        lastReadAt: p.lastReadAt?.toISOString() ?? null,
      })),
      lastMessage: lastMsg
        ? {
            id: lastMsg.id,
            conversationId: lastMsg.conversationId,
            senderId: lastMsg.senderId,
            sender: lastMsg.sender,
            content: lastMsg.content,
            messageType: lastMsg.messageType,
            readAt: lastMsg.readAt?.toISOString() ?? null,
            createdAt: lastMsg.createdAt.toISOString(),
          }
        : null,
      unreadCount,
      createdAt: conv.createdAt.toISOString(),
      updatedAt: conv.updatedAt.toISOString(),
    }
  })

    return NextResponse.json({ data: shaped })
  } catch (err) {
    logApiError('messaging/conversations', 'listConversations', err)
    return apiError('Failed to fetch conversations', { status: 500, code: 'INTERNAL_ERROR' })
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
  if (!parsed.success) return apiError('recipientId is required', { status: 400, code: 'VALIDATION_ERROR' })

  const { recipientId } = parsed.data
  if (recipientId === auth.userId) {
    return apiError('Cannot start conversation with yourself', { status: 400, code: 'VALIDATION_ERROR' })
  }

  try {
    // Check for existing conversation between these two users
    const existing = await prisma.conversation.findFirst({
    where: {
      participants: { every: { userId: { in: [auth.userId, recipientId] } } },
    },
    include: {
      participants: { include: { user: { select: { id: true, name: true, avatarUrl: true } } } },
      messages: { orderBy: { createdAt: 'desc' }, take: 1, include: { sender: { select: { id: true, name: true, avatarUrl: true } } } },
    },
  })

    if (existing) return NextResponse.json({ data: existing })

    const conv = await prisma.conversation.create({
    data: {
      participants: {
        create: [{ userId: auth.userId }, { userId: recipientId }],
      },
    },
    include: {
      participants: { include: { user: { select: { id: true, name: true, avatarUrl: true } } } },
      messages: { take: 1 },
    },
  })

    return NextResponse.json({ data: { ...conv, lastMessage: null, unreadCount: 0 } }, { status: 201 })
  } catch (err) {
    logApiError('messaging/conversations', 'createConversation', err)
    return apiError('Failed to create conversation', { status: 500, code: 'INTERNAL_ERROR' })
  }
}
