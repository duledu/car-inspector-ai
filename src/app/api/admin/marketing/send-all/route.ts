import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/admin/admin-guard'
import { DEFAULT_MARKETING_CAMPAIGN } from '@/lib/admin/announcement-defaults'
import { sendMarketingEmails } from '@/lib/admin/marketing-email-sender'
import { apiError, logApiError } from '@/utils/api-response'
import type { MarketingCampaignContent } from '@/lib/email/types/email-template.types'
import type { RecipientMode } from '@/lib/admin/bulk-email-sender'

export const maxDuration = 60
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export async function POST(req: NextRequest) {
  const guard = await requireAdmin(req)
  if (!guard.success) return guard.response

  try {
    const body = await req.json().catch(() => ({}))

    if (body?.confirmed !== true) {
      return apiError('Bulk send requires confirmed:true', { status: 400, code: 'CONFIRMATION_REQUIRED' })
    }

    const content: MarketingCampaignContent = { ...DEFAULT_MARKETING_CAMPAIGN, ...(body?.content ?? {}) }
    const manualEmails: string[]            = Array.isArray(body?.manualEmails) ? body.manualEmails : []
    const manualLanguage                    = typeof body?.manualLanguage === 'string' ? body.manualLanguage : 'en'
    const recipientMode: RecipientMode      = (['db', 'manual', 'both'] as RecipientMode[]).includes(body?.recipientMode)
      ? (body.recipientMode as RecipientMode)
      : 'db'

    const validManualCount = manualEmails
      .filter((email): email is string => typeof email === 'string')
      .map(email => email.trim())
      .filter(email => EMAIL_RE.test(email))
      .length

    if ((recipientMode === 'manual' || recipientMode === 'both') && validManualCount === 0) {
      return apiError('At least one valid manual recipient email is required', { status: 422, code: 'VALIDATION_ERROR' })
    }

    const result = await sendMarketingEmails({ content, manualEmails, manualLanguage, recipientMode })

    return NextResponse.json({ data: result })
  } catch (error) {
    logApiError('admin/marketing/send-all', 'POST', error)
    return apiError('Bulk send failed', { status: 500, code: 'INTERNAL_ERROR' })
  }
}
