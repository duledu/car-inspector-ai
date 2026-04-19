import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/config/prisma'
import { requireAdmin } from '@/lib/admin/admin-guard'
import { DEFAULT_MARKETING_CAMPAIGN } from '@/lib/admin/announcement-defaults'
import { apiError, logApiError } from '@/utils/api-response'
import type { MarketingCampaignContent } from '@/lib/email/types/email-template.types'

const SLUG = 'marketing'

async function loadCampaign(): Promise<MarketingCampaignContent> {
  const row = await prisma.appAnnouncement.findUnique({ where: { slug: SLUG } })
  if (!row) return DEFAULT_MARKETING_CAMPAIGN
  return row.content as unknown as MarketingCampaignContent
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
    const body = await req.json().catch(() => null)
    if (!body?.content || typeof body.content !== 'object') {
      return apiError('Invalid request body', { status: 422, code: 'VALIDATION_ERROR' })
    }

    const content: MarketingCampaignContent = { ...DEFAULT_MARKETING_CAMPAIGN, ...body.content }
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
