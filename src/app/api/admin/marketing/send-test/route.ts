import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin, DEFAULT_ADMIN_TEST_EMAIL } from '@/lib/admin/admin-guard'
import { DEFAULT_MARKETING_CAMPAIGN } from '@/lib/admin/announcement-defaults'
import { buildMarketingEmailTemplate } from '@/lib/email/templates/marketing-email-template'
import { sendEmail } from '@/lib/email/send-email'
import { apiError, logApiError } from '@/utils/api-response'
import type { MarketingCampaignContent } from '@/lib/email/types/email-template.types'

export async function POST(req: NextRequest) {
  const guard = await requireAdmin(req)
  if (!guard.success) return guard.response

  try {
    const body    = await req.json().catch(() => ({}))
    const content: MarketingCampaignContent = { ...DEFAULT_MARKETING_CAMPAIGN, ...(body?.content ?? {}) }

    const recipient: string = typeof body?.testEmail === 'string' && body.testEmail.includes('@')
      ? body.testEmail
      : DEFAULT_ADMIN_TEST_EMAIL

    if (!recipient) {
      return apiError('A test email recipient is required', { status: 422, code: 'VALIDATION_ERROR' })
    }

    const template = buildMarketingEmailTemplate(content)
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
