import { requireAuth } from '@/utils/auth.middleware'
import { apiError } from '@/utils/api-response'
import { NextRequest, NextResponse } from 'next/server'

const ADMIN_EMAILS = (process.env.ADMIN_EMAILS ?? '')
  .split(',')
  .map(email => email.trim().toLowerCase())
  .filter(Boolean)

export const DEFAULT_ADMIN_TEST_EMAIL = ADMIN_EMAILS[0] ?? ''

type AdminGuardResult =
  | { success: true;  adminEmail: string }
  | { success: false; response: NextResponse }

export async function requireAdmin(req: NextRequest): Promise<AdminGuardResult> {
  const auth = await requireAuth(req)
  if (!auth.success) {
    return { success: false, response: apiError('Unauthorized', { status: 401, code: 'UNAUTHORIZED' }) }
  }

  const emailAllowed = ADMIN_EMAILS.length > 0 && ADMIN_EMAILS.includes(auth.email.toLowerCase())
  if (auth.role !== 'ADMIN' && !emailAllowed) {
    return { success: false, response: apiError('Forbidden', { status: 403, code: 'FORBIDDEN' }) }
  }

  return { success: true, adminEmail: auth.email }
}
