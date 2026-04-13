import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/config/prisma'
import { requireAuth } from '@/utils/auth.middleware'
import { apiError, logApiError } from '@/utils/api-response'

const SendSchema = z.object({
  content: z.string().min(1),
  messageType: z.enum(['TEXT', 'IMAGE', 'VEHICLE_CARD', 'REPORT_SHARE']).default('TEXT'),
  attachmentUrl: z.string().url().optional(),
})

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requireAuth(req)
  if (!auth.success) return apiError(auth.reason, { status: 401, code: 'UNAUTHORIZED' })

  try {
    // Verify user is participant
    const participant = await prisma.conversationParticipant.findFirst({
      where: { conversationId: params.id, userId: auth.userId },
    })
    if (!participant) return apiError('Not found', { status: 404, code: 'NOT_FOUND' })

  const { searchParams } = new URL(req.url)
  const cursor = searchParams.get('cursor')

  const messages = await prisma.message.findMany({
    where: { conversationId: params.id },
    include: { sender: { select: { id: true, name: true, avatarUrl: true } } },
    orderBy: { createdAt: 'asc' },
    ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
    take: 50,
  })

  const shaped = messages.map((m) => ({
    id: m.id,
    conversationId: m.conversationId,
    senderId: m.senderId,
    sender: m.sender,
    content: m.content,
    messageType: m.messageType,
    attachmentUrl: m.attachmentUrl ?? null,
    readAt: m.readAt?.toISOString() ?? null,
    createdAt: m.createdAt.toISOString(),
  }))

    return NextResponse.json({ data: shaped })
  } catch (err) {
    logApiError('messaging/conversations/[id]/messages', 'listMessages', err, { conversationId: params.id })
    return apiError('Failed to fetch messages', { status: 500, code: 'INTERNAL_ERROR' })
  }
}

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requireAuth(req)
  if (!auth.success) return apiError(auth.reason, { status: 401, code: 'UNAUTHORIZED' })

  try {
    const participant = await prisma.conversationParticipant.findFirst({
      where: { conversationId: params.id, userId: auth.userId },
    })
    if (!participant) return apiError('Not found', { status: 404, code: 'NOT_FOUND' })

    let body: unknown
    try {
      body = await req.json()
    } catch {
      return apiError('Invalid JSON', { status: 400, code: 'BAD_REQUEST' })
    }
    const parsed = SendSchema.safeParse(body)
    if (!parsed.success) {
      return apiError('Validation failed', { status: 400, code: 'VALIDATION_ERROR', details: parsed.error.flatten() })
    }

    const message = await prisma.message.create({
    data: {
      conversationId: params.id,
      senderId: auth.userId,
      ...parsed.data,
    },
    include: { sender: { select: { id: true, name: true, avatarUrl: true } } },
  })

  // Bump conversation updatedAt
    await prisma.conversation.update({
      where: { id: params.id },
      data: { updatedAt: new Date() },
    })

    return NextResponse.json(
      {
        data: {
          id: message.id,
          conversationId: message.conversationId,
          senderId: message.senderId,
          sender: message.sender,
          content: message.content,
          messageType: message.messageType,
          attachmentUrl: message.attachmentUrl ?? null,
          readAt: message.readAt?.toISOString() ?? null,
          createdAt: message.createdAt.toISOString(),
        },
      },
      { status: 201 }
    )
  } catch (err) {
    logApiError('messaging/conversations/[id]/messages', 'sendMessage', err, { conversationId: params.id })
    return apiError('Failed to send message', { status: 500, code: 'INTERNAL_ERROR' })
  }
}
