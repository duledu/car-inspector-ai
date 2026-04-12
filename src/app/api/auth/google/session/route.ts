// =============================================================================
// Google OAuth — Session handoff
// GET /api/auth/google/session
// Client calls this once after redirect to /auth/google/complete.
// Reads and immediately deletes the single-use gauth_session httpOnly cookie.
// =============================================================================

import { NextRequest, NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'
export const revalidate = 0

export async function GET(req: NextRequest) {
  const raw = req.cookies.get('gauth_session')?.value

  if (!raw) {
    const response = NextResponse.json(
      { message: 'No pending Google session', code: 'NO_SESSION' },
      { status: 404 }
    )
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
    const response = NextResponse.json(
      { message: 'Malformed session cookie', code: 'INVALID_SESSION' },
      { status: 400 }
    )
    response.headers.set('Cache-Control', 'no-store')
    return response
  }
}
