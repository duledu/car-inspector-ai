// =============================================================================
// Google OAuth — Init
// GET /api/auth/google/init
// Generates CSRF state, sets httpOnly cookie, redirects to Google consent screen.
// =============================================================================

import { NextRequest, NextResponse } from 'next/server'
import { randomBytes } from 'node:crypto'

export const dynamic = 'force-dynamic'
export const revalidate = 0

export async function GET(req: NextRequest) {
  const clientId = process.env.GOOGLE_CLIENT_ID
  // Always derive the callback URL from the actual request origin so that
  // local dev (http://localhost:3000) and production work independently —
  // using NEXT_PUBLIC_APP_URL here caused Google to redirect to the wrong host.
  const origin = req.nextUrl.origin

  if (!clientId) {
    console.error('[google/init] GOOGLE_CLIENT_ID is not set')
    const response = NextResponse.redirect(new URL('/auth?error=googleFailed', origin))
    response.headers.set('Cache-Control', 'no-store')
    return response
  }

  const state = randomBytes(16).toString('hex')
  const callbackUrl = new URL('/api/auth/google/callback', origin).toString()

  const params = new URLSearchParams({
    client_id:     clientId,
    redirect_uri:  callbackUrl,
    response_type: 'code',
    scope:         'openid email profile',
    state,
    access_type:   'online',
    prompt:        'select_account',
  })

  const response = NextResponse.redirect(
    `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`
  )
  response.headers.set('Cache-Control', 'no-store')

  // Derive secure flag from the actual transport URL, not NODE_ENV.
  // NODE_ENV can be 'development' on staging/preview deployments that still run over HTTPS.
  const isHttps = req.nextUrl.protocol === 'https:'

  response.cookies.set('gauth_state', state, {
    httpOnly: true,
    secure:   isHttps,
    sameSite: 'lax',
    maxAge:   300, // 5 minutes
    path:     '/',
  })

  return response
}
