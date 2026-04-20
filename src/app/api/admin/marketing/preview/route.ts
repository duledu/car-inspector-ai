import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/admin/admin-guard'
import { normalizeMarketingContent } from '@/lib/email/localized-template-content'
import { buildMarketingEmailTemplate } from '@/lib/email/templates/marketing-email-template'
import { localizeMarketingContent } from '@/lib/email/marketing-i18n'
import { apiError, logApiError, parseJsonBody } from '@/utils/api-response'

export async function POST(req: NextRequest) {
  const guard = await requireAdmin(req)
  if (!guard.success) return guard.response

  try {
    const bodyResult = await parseJsonBody(req)
    if (!bodyResult.ok) return bodyResult.response
    const body = bodyResult.data as Record<string, unknown>
    const content = normalizeMarketingContent(body.content)
    const language = typeof body?.language === 'string' ? body.language : 'en'
    const localized = localizeMarketingContent(content, language)
    const { html } = buildMarketingEmailTemplate(localized.content, localized.lang)
    return NextResponse.json({ data: { html } })
  } catch (error) {
    logApiError('admin/marketing/preview', 'POST', error)
    return apiError('Failed to render preview', { status: 500, code: 'INTERNAL_ERROR' })
  }
}
