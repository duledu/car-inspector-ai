import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/admin/admin-guard'
import { DEFAULT_ANNOUNCEMENT } from '@/lib/admin/announcement-defaults'
import { sendBulkEmails } from '@/lib/admin/bulk-email-sender'
import { buildDynamicAppUpdateTemplate } from '@/lib/email/templates/app-update-template'
import { apiError, logApiError } from '@/utils/api-response'
import type { AppAnnouncementContent } from '@/lib/email/types/email-template.types'
import type { RecipientMode } from '@/lib/admin/bulk-email-sender'

export const maxDuration = 60

export async function POST(req: NextRequest) {
  const guard = await requireAdmin(req)
  if (!guard.success) return guard.response

  try {
    const body = await req.json().catch(() => null) ?? {}

    if (body?.confirmed !== true) {
      return apiError('Bulk send requires confirmed:true', { status: 400, code: 'CONFIRMATION_REQUIRED' })
    }

    const content: AppAnnouncementContent = { ...DEFAULT_ANNOUNCEMENT, ...(body?.content ?? {}) }
    const manualEmails: string[]          = Array.isArray(body?.manualEmails) ? body.manualEmails : []
    const recipientMode: RecipientMode    = (['db', 'manual', 'both'] as RecipientMode[]).includes(body?.recipientMode)
      ? (body.recipientMode as RecipientMode)
      : 'db'

    const template = buildDynamicAppUpdateTemplate(content)
    const result   = await sendBulkEmails({ template, manualEmails, recipientMode })

    return NextResponse.json({ data: result })
  } catch (error) {
    logApiError('admin/announcement/send-all', 'POST', error)
    return apiError('Bulk send failed', { status: 500, code: 'INTERNAL_ERROR' })
  }
}
