import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/admin/admin-guard'
import { DEFAULT_MARKETING_CAMPAIGN } from '@/lib/admin/announcement-defaults'
import { buildMarketingEmailTemplate } from '@/lib/email/templates/marketing-email-template'
import { localizeMarketingContent } from '@/lib/email/marketing-i18n'
import { apiError, logApiError } from '@/utils/api-response'
import type { MarketingCampaignContent } from '@/lib/email/types/email-template.types'

export async function POST(req: NextRequest) {
  const guard = await requireAdmin(req)
  if (!guard.success) return guard.response

  try {
    const body    = await req.json().catch(() => null)
    const content: MarketingCampaignContent = { ...DEFAULT_MARKETING_CAMPAIGN, ...(body?.content ?? {}) }
    const language = typeof body?.language === 'string' ? body.language : 'en'
    const localized = localizeMarketingContent(content, language)
    const { html } = buildMarketingEmailTemplate(localized.content, localized.lang)
    return NextResponse.json({ data: { html } })
  } catch (error) {
    logApiError('admin/marketing/preview', 'POST', error)
    return apiError('Failed to render preview', { status: 500, code: 'INTERNAL_ERROR' })
  }
}
