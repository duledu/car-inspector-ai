import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/config/prisma'
import { requireAuth } from '@/utils/auth.middleware'

const BodySchema = z.object({
  status: z.enum(['PENDING', 'OK', 'WARNING', 'PROBLEM']),
  notes: z.string().optional(),
  photoUrl: z.string().url().optional(),
})

export async function PATCH(req: NextRequest, { params }: { params: { itemId: string } }) {
  const auth = await requireAuth(req)
  if (!auth.success) return NextResponse.json({ message: auth.reason }, { status: 401 })

  // Verify item belongs to a session owned by the user
  const item = await prisma.checklistItem.findFirst({
    where: {
      id: params.itemId,
      session: { userId: auth.userId },
    },
  })
  if (!item) return NextResponse.json({ message: 'Not found' }, { status: 404 })

  const body = await req.json()
  const parsed = BodySchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ message: 'Validation failed', details: parsed.error.flatten() }, { status: 400 })
  }

  const updated = await prisma.checklistItem.update({
    where: { id: params.itemId },
    data: parsed.data,
  })

  return NextResponse.json({ data: updated })
}
