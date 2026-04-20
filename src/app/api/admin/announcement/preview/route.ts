import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/admin/admin-guard'
import { normalizeAnnouncementContent } from '@/lib/email/localized-template-content'
import { buildDynamicAppUpdateTemplate } from '@/lib/email/templates/app-update-template'
import { apiError, logApiError, parseJsonBody } from '@/utils/api-response'

export async function POST(req: NextRequest) {
  const guard = await requireAdmin(req)
  if (!guard.success) return guard.response

  try {
    const bodyResult = await parseJsonBody(req)
    if (!bodyResult.ok) return bodyResult.response
    const body = bodyResult.data as Record<string, unknown>
    const content = normalizeAnnouncementContent(body.content)
    const lang = typeof body?.language === 'string' ? body.language : undefined
    const { html } = buildDynamicAppUpdateTemplate(content, lang)
    return NextResponse.json({ data: { html } })
  } catch (error) {
    logApiError('admin/announcement/preview', 'POST', error)
    return apiError('Failed to render preview', { status: 500, code: 'INTERNAL_ERROR' })
  }
}
