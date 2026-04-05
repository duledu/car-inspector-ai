import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/config/prisma'
import { requireAuth } from '@/utils/auth.middleware'

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requireAuth(req)
  if (!auth.success) return NextResponse.json({ message: auth.reason }, { status: 401 })

  const session = await prisma.inspectionSession.findFirst({
    where: { id: params.id, userId: auth.userId },
    include: { checklistItems: { orderBy: { createdAt: 'asc' } } },
  })

  if (!session) return NextResponse.json({ message: 'Not found' }, { status: 404 })

  return NextResponse.json({ data: session })
}
