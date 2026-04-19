import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/admin/admin-guard'
import { DEFAULT_ANNOUNCEMENT } from '@/lib/admin/announcement-defaults'
import { buildDynamicAppUpdateTemplate } from '@/lib/email/templates/app-update-template'
import { apiError, logApiError } from '@/utils/api-response'
import type { AppAnnouncementContent } from '@/lib/email/types/email-template.types'

export async function POST(req: NextRequest) {
  const guard = await requireAdmin(req)
  if (!guard.success) return guard.response

  try {
    const body = await req.json().catch(() => null)
    const content: AppAnnouncementContent = { ...DEFAULT_ANNOUNCEMENT, ...(body?.content ?? {}) }
    const lang = typeof body?.language === 'string' ? body.language : undefined
    const { html } = buildDynamicAppUpdateTemplate(content, lang)
    return NextResponse.json({ data: { html } })
  } catch (error) {
    logApiError('admin/announcement/preview', 'POST', error)
    return apiError('Failed to render preview', { status: 500, code: 'INTERNAL_ERROR' })
  }
}
