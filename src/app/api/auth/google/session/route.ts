// =============================================================================
// Google OAuth — Session handoff
// GET /api/auth/google/session
// Client calls this once after redirect to /auth/google/complete.
// Reads and immediately deletes the single-use gauth_session httpOnly cookie.
// =============================================================================

import { NextRequest, NextResponse } from 'next/server'
import { apiError } from '@/utils/api-response'

export const dynamic = 'force-dynamic'
export const revalidate = 0

export async function GET(req: NextRequest) {
  const raw = req.cookies.get('gauth_session')?.value

  if (!raw) {
    const response = apiError('No pending Google session', { status: 404, code: 'NO_SESSION' })
    response.headers.set('Cache-Control', 'no-store')
    return response
  }

  try {
    const session = JSON.parse(raw)
    const response = NextResponse.json({ data: session })
    response.headers.set('Cache-Control', 'no-store')
    // Single-use: delete immediately after reading
    response.cookies.delete('gauth_session')
    return response
  } catch {
    const response = apiError('Malformed session cookie', { status: 400, code: 'INVALID_SESSION' })
    response.headers.set('Cache-Control', 'no-store')
    return response
  }
}
