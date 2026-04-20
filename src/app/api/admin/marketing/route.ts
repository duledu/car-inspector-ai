import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/config/prisma'
import { requireAdmin } from '@/lib/admin/admin-guard'
import { DEFAULT_MARKETING_CAMPAIGN } from '@/lib/admin/announcement-defaults'
import { normalizeMarketingContent } from '@/lib/email/localized-template-content'
import { apiError, logApiError, parseJsonBody } from '@/utils/api-response'
import type { MarketingCampaignContent } from '@/lib/email/types/email-template.types'

const SLUG = 'marketing'

async function loadCampaign(): Promise<MarketingCampaignContent> {
  const row = await prisma.appAnnouncement.findUnique({ where: { slug: SLUG } })
  if (!row) return DEFAULT_MARKETING_CAMPAIGN
  return normalizeMarketingContent(row.content)
}

export async function GET(req: NextRequest) {
  const guard = await requireAdmin(req)
  if (!guard.success) return guard.response

  try {
    const content = await loadCampaign()
    return NextResponse.json({ data: content })
  } catch (error) {
    logApiError('admin/marketing', 'GET', error)
    return apiError('Failed to load campaign', { status: 500, code: 'INTERNAL_ERROR' })
  }
}

export async function PUT(req: NextRequest) {
  const guard = await requireAdmin(req)
  if (!guard.success) return guard.response

  try {
    const bodyResult = await parseJsonBody(req)
    if (!bodyResult.ok) return bodyResult.response
    const body = bodyResult.data as Record<string, unknown>
    if (!body?.content || typeof body.content !== 'object') {
      return apiError('Invalid request body', { status: 422, code: 'VALIDATION_ERROR' })
    }

    const content = normalizeMarketingContent(body.content)
    const json = content as unknown as Parameters<typeof prisma.appAnnouncement.upsert>[0]['create']['content']

    await prisma.appAnnouncement.upsert({
      where:  { slug: SLUG },
      create: { slug: SLUG, content: json },
      update: { content: json },
    })

    return NextResponse.json({ data: content })
  } catch (error) {
    logApiError('admin/marketing', 'PUT', error)
    return apiError('Failed to save campaign', { status: 500, code: 'INTERNAL_ERROR' })
  }
}
