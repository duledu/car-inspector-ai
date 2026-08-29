import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/config/prisma'
import { requireAdmin } from '@/lib/admin/admin-guard'
import { apiError, logApiError } from '@/utils/api-response'
import { isConsentCurrent } from '@/lib/legal/consent-guard'

export async function GET(req: NextRequest) {
  const guard = await requireAdmin(req)
  if (!guard.success) return guard.response

  try {
    const [allUsers, latestConsents, recentUsers] = await Promise.all([
      prisma.user.findMany({ select: { id: true, emailVerified: true } }),
      // One row per user who has ever consented — Postgres DISTINCT ON via
      // Prisma's distinct+orderBy combo, so each user's latest acceptance is
      // read exactly once instead of one query per user.
      prisma.consentRecord.findMany({
        where: { userId: { not: null } },
        distinct: ['userId'],
        orderBy: { acceptedAt: 'desc' },
        select: { userId: true, termsVersion: true, privacyVersion: true, riskAckVersion: true },
      }),
      prisma.user.findMany({
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
      }),
    ])

    // ConsentRecord — not a second source of truth for whether a user has
    // consented, but the single query result every count/flag below is
    // derived from, all using the same isConsentCurrent() comparison the
    // live per-request guard (requireCurrentConsent) uses.
    const currentConsentByUserId = new Map<string, boolean>(
      latestConsents.map((record) => [record.userId as string, isConsentCurrent(record)]),
    )

    let staleConsent = 0
    let currentConsent = 0
    for (const isCurrent of currentConsentByUserId.values()) {
      if (isCurrent) currentConsent++
      else staleConsent++
    }

    // "Registered" excludes consent-pending OAuth shells — a User row that
    // has never completed the consent handshake is not a registered account
    // yet, regardless of how its emailVerified flag looks (Google verifies
    // email before any consent UI is ever shown).
    const total = currentConsentByUserId.size
    const noConsent = allUsers.length - total

    const verified = allUsers.filter(
      (u) => u.emailVerified !== null && currentConsentByUserId.get(u.id) === true,
    ).length

    return NextResponse.json({
      data: {
        stats: {
          total,
          verified,
          unverified: total - verified,
          // Explicit three-way breakdown per requirement: current valid
          // consent / stale consent / no consent must be distinguishable,
          // not folded into a single "pending" bucket.
          noConsent,
          staleConsent,
          currentConsent,
        },
        recentUsers: recentUsers.map((u) => {
          const hasCurrent = currentConsentByUserId.get(u.id) === true
          return { ...u, hasCurrentConsent: hasCurrent, isConsentPending: !hasCurrent }
        }),
      },
    })
  } catch (error) {
    logApiError('admin/users', 'GET', error)
    return apiError('Failed to load user stats', { status: 500, code: 'INTERNAL_ERROR' })
  }
}
