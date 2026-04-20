import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin, DEFAULT_ADMIN_TEST_EMAIL } from '@/lib/admin/admin-guard'
import { normalizeAnnouncementContent } from '@/lib/email/localized-template-content'
import { buildDynamicAppUpdateTemplate } from '@/lib/email/templates/app-update-template'
import { sendEmail } from '@/lib/email/send-email'
import { apiError, logApiError, parseJsonBody } from '@/utils/api-response'

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export async function POST(req: NextRequest) {
  const guard = await requireAdmin(req)
  if (!guard.success) return guard.response

  try {
    const bodyResult = await parseJsonBody(req)
    if (!bodyResult.ok) return bodyResult.response
    const body = bodyResult.data as Record<string, unknown>
    const content = normalizeAnnouncementContent(body.content)
    const lang = typeof body?.language === 'string' ? body.language : undefined

    const requestedRecipient = typeof body?.testEmail === 'string' ? body.testEmail.trim().toLowerCase() : ''
    const recipient = requestedRecipient || DEFAULT_ADMIN_TEST_EMAIL || guard.adminEmail

    if (!EMAIL_RE.test(recipient)) {
      return apiError('A valid test email recipient is required', { status: 422, code: 'VALIDATION_ERROR' })
    }

    const template = buildDynamicAppUpdateTemplate(content, lang)
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
    logApiError('admin/announcement/send-test', 'POST', error)
    return apiError('Failed to send test email', { status: 500, code: 'INTERNAL_ERROR' })
  }
}
