import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/config/prisma'
import { requireAuth } from '@/utils/auth.middleware'

const SendSchema = z.object({
  content: z.string().min(1),
  messageType: z.enum(['TEXT', 'IMAGE', 'VEHICLE_CARD', 'REPORT_SHARE']).default('TEXT'),
  attachmentUrl: z.string().url().optional(),
})

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requireAuth(req)
  if (!auth.success) return NextResponse.json({ message: auth.reason }, { status: 401 })

  // Verify user is participant
  const participant = await prisma.conversationParticipant.findFirst({
    where: { conversationId: params.id, userId: auth.userId },
  })
  if (!participant) return NextResponse.json({ message: 'Not found' }, { status: 404 })

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
}

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requireAuth(req)
  if (!auth.success) return NextResponse.json({ message: auth.reason }, { status: 401 })

  const participant = await prisma.conversationParticipant.findFirst({
    where: { conversationId: params.id, userId: auth.userId },
  })
  if (!participant) return NextResponse.json({ message: 'Not found' }, { status: 404 })

  const body = await req.json()
  const parsed = SendSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ message: 'Validation failed', details: parsed.error.flatten() }, { status: 400 })
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
}
