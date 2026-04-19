import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/config/prisma'
import { requireAdmin } from '@/lib/admin/admin-guard'
import { DEFAULT_ANNOUNCEMENT } from '@/lib/admin/announcement-defaults'
import { apiError, logApiError } from '@/utils/api-response'
import type { AppAnnouncementContent } from '@/lib/email/types/email-template.types'

const SLUG = 'default'

async function loadAnnouncement(): Promise<AppAnnouncementContent> {
  const row = await prisma.appAnnouncement.findUnique({ where: { slug: SLUG } })
  if (!row) return DEFAULT_ANNOUNCEMENT
  return row.content as unknown as AppAnnouncementContent
}

export async function GET(req: NextRequest) {
  const guard = await requireAdmin(req)
  if (!guard.success) return guard.response

  try {
    const content = await loadAnnouncement()
    return NextResponse.json({ data: content })
  } catch (error) {
    logApiError('admin/announcement', 'GET', error)
    return apiError('Failed to load announcement', { status: 500, code: 'INTERNAL_ERROR' })
  }
}

export async function PUT(req: NextRequest) {
  const guard = await requireAdmin(req)
  if (!guard.success) return guard.response

  try {
    const body = await req.json().catch(() => null)
    if (!body?.content || typeof body.content !== 'object') {
      return apiError('Invalid request body', { status: 422, code: 'VALIDATION_ERROR' })
    }

    const content: AppAnnouncementContent = { ...DEFAULT_ANNOUNCEMENT, ...body.content }

    const json = content as unknown as Parameters<typeof prisma.appAnnouncement.upsert>[0]['create']['content']

    await prisma.appAnnouncement.upsert({
      where:  { slug: SLUG },
      create: { slug: SLUG, content: json },
      update: { content: json },
    })

    return NextResponse.json({ data: content })
  } catch (error) {
    logApiError('admin/announcement', 'PUT', error)
    return apiError('Failed to save announcement', { status: 500, code: 'INTERNAL_ERROR' })
  }
}
