import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/config/prisma'
import { requireAdmin } from '@/lib/admin/admin-guard'
import { apiError, logApiError } from '@/utils/api-response'

export async function GET(req: NextRequest) {
  const guard = await requireAdmin(req)
  if (!guard.success) return guard.response

  try {
    const [total, verified] = await Promise.all([
      prisma.user.count(),
      prisma.user.count({ where: { emailVerified: { not: null } } }),
    ])

    const recentUsers = await prisma.user.findMany({
      orderBy: { createdAt: 'desc' },
      take: 20,
      select: {
        id:            true,
        email:         true,
        name:          true,
        emailVerified: true,
        createdAt:     true,
        role:          true,
      },
    })

    return NextResponse.json({
      data: {
        stats: {
          total,
          verified,
          unverified: total - verified,
        },
        recentUsers,
      },
    })
  } catch (error) {
    logApiError('admin/users', 'GET', error)
    return apiError('Failed to load user stats', { status: 500, code: 'INTERNAL_ERROR' })
  }
}
