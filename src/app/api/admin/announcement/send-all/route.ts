import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/admin/admin-guard'
import { sendAnnouncementEmails, EMAIL_RE, MAX_MANUAL_RECIPIENTS } from '@/lib/admin/bulk-email-sender'
import { normalizeAnnouncementContent } from '@/lib/email/localized-template-content'
import { buildDynamicAppUpdateTemplate } from '@/lib/email/templates/app-update-template'
import { apiError, logApiError, parseJsonBody } from '@/utils/api-response'
import type { RecipientMode } from '@/lib/admin/bulk-email-sender'

export const maxDuration = 60

export async function POST(req: NextRequest) {
  const guard = await requireAdmin(req)
  if (!guard.success) return guard.response

  try {
    const bodyResult = await parseJsonBody(req)
    if (!bodyResult.ok) return bodyResult.response
    const body = bodyResult.data as Record<string, unknown>

    if (body?.confirmed !== true) {
      return apiError('Bulk send requires confirmed:true', { status: 400, code: 'CONFIRMATION_REQUIRED' })
    }

    const content = normalizeAnnouncementContent(body.content)
    const lang = typeof body?.language === 'string' ? body.language : undefined
    const manualEmails: string[]          = Array.isArray(body?.manualEmails) ? body.manualEmails : []
    const recipientMode: RecipientMode    = (['db', 'manual', 'both'] as RecipientMode[]).includes(body.recipientMode as RecipientMode)
      ? (body.recipientMode as RecipientMode)
      : 'db'

    const validManual = manualEmails
      .filter((email): email is string => typeof email === 'string')
      .map(email => email.trim())
      .filter(email => EMAIL_RE.test(email))

    if ((recipientMode === 'manual' || recipientMode === 'both') && validManual.length === 0) {
      return apiError('At least one valid manual recipient email is required', { status: 422, code: 'VALIDATION_ERROR' })
    }

    if (validManual.length > MAX_MANUAL_RECIPIENTS) {
      return apiError(
        `Manual recipient list exceeds the ${MAX_MANUAL_RECIPIENTS}-address limit. Split into smaller batches.`,
        { status: 422, code: 'VALIDATION_ERROR' },
      )
    }

    const result = await sendAnnouncementEmails({
      content,
      manualEmails,
      manualLanguage: lang,
      recipientMode,
      renderTemplate: buildDynamicAppUpdateTemplate,
    })

    return NextResponse.json({ data: result })
  } catch (error) {
    logApiError('admin/announcement/send-all', 'POST', error)
    return apiError('Bulk send failed', { status: 500, code: 'INTERNAL_ERROR' })
  }
}
