// =============================================================================
// Google OAuth — Init
// GET /api/auth/google/init
// Generates CSRF state, sets httpOnly cookie, redirects to Google consent screen.
// =============================================================================

import { NextRequest, NextResponse } from 'next/server'
import { randomBytes } from 'node:crypto'

export const dynamic = 'force-dynamic'
export const revalidate = 0

/**
 * Resolves the app's public origin, accounting for reverse-proxy SSL termination.
 *
 * Priority:
 *   1. NEXT_PUBLIC_APP_URL (explicit env var — always canonical in production)
 *   2. X-Forwarded-Proto + X-Forwarded-Host (fallback for proxy setups without the env var)
 *   3. req.nextUrl.origin (local dev fallback)
 *
 * NEXT_PUBLIC_APP_URL is checked first because on platforms like Vercel,
 * x-forwarded-host can return a deployment-specific hostname instead of the
 * canonical domain, which would cause redirect_uri_mismatch with Google OAuth.
 */
function getAppOrigin(req: NextRequest): string {
  const envUrl = process.env.NEXT_PUBLIC_APP_URL
  if (envUrl) return envUrl.replace(/\/$/, '')

  const proto = req.headers.get('x-forwarded-proto')?.split(',')[0]?.trim()
  const host  = req.headers.get('x-forwarded-host')?.split(',')[0]?.trim()
                ?? req.headers.get('host')

  if (proto && host) return `${proto}://${host}`

  return req.nextUrl.origin
}

export async function GET(req: NextRequest) {
  const clientId = process.env.GOOGLE_CLIENT_ID
  const origin = getAppOrigin(req)

  if (!clientId) {
    console.error('[google/init] GOOGLE_CLIENT_ID is not set')
    const response = NextResponse.redirect(new URL('/auth?error=googleFailed', origin))
    response.headers.set('Cache-Control', 'no-store')
    return response
  }

  const state = randomBytes(16).toString('hex')
  // Must match the redirect URI registered in Google Cloud Console
  const callbackUrl = new URL('/api/auth/callback/google', origin).toString()

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
