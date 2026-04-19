import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin, DEFAULT_ADMIN_TEST_EMAIL } from '@/lib/admin/admin-guard'
import { DEFAULT_MARKETING_CAMPAIGN } from '@/lib/admin/announcement-defaults'
import { buildMarketingEmailTemplate } from '@/lib/email/templates/marketing-email-template'
import { localizeMarketingContent } from '@/lib/email/marketing-i18n'
import { sendEmail } from '@/lib/email/send-email'
import { apiError, logApiError } from '@/utils/api-response'
import type { MarketingCampaignContent } from '@/lib/email/types/email-template.types'

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export async function POST(req: NextRequest) {
  const guard = await requireAdmin(req)
  if (!guard.success) return guard.response

  try {
    const body    = await req.json().catch(() => ({}))
    const content: MarketingCampaignContent = { ...DEFAULT_MARKETING_CAMPAIGN, ...(body?.content ?? {}) }
    const language = typeof body?.language === 'string' ? body.language : 'en'

    const requestedRecipient = typeof body?.testEmail === 'string' ? body.testEmail.trim().toLowerCase() : ''
    const recipient = requestedRecipient || DEFAULT_ADMIN_TEST_EMAIL || guard.adminEmail

    if (!EMAIL_RE.test(recipient)) {
      return apiError('A valid test email recipient is required', { status: 422, code: 'VALIDATION_ERROR' })
    }

    const localized = localizeMarketingContent(content, language)
    const template = buildMarketingEmailTemplate(localized.content, localized.lang)
    const result   = await sendEmail({
      to:      recipient,
      subject: template.subject,
      html:    template.html,
      text:    template.text,
    })

    if (!result.success) {
      return apiError(`Email delivery failed: ${result.error ?? 'unknown'}`, { status: 502, code: 'EMAIL_ERROR' })
    }

    return NextResponse.json({ data: { success: true, sentTo: recipient } })
  } catch (error) {
    logApiError('admin/marketing/send-test', 'POST', error)
    return apiError('Failed to send test email', { status: 500, code: 'INTERNAL_ERROR' })
  }
}
