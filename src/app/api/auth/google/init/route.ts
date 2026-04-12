// =============================================================================
// Google OAuth — Init
// GET /api/auth/google/init
//
// 1. Resolves the canonical app origin (proxy-aware via app-origin helper).
// 2. Generates a CSRF state token.
// 3. Persists { t: state, cb: callbackUrl } in a signed httpOnly cookie so
//    the callback route uses the *exact* same redirect_uri without recomputing
//    it — eliminating any possibility of origin drift between the two routes.
// 4. Redirects to Google's OAuth consent screen.
// =============================================================================

import { NextRequest, NextResponse } from 'next/server'
import { randomBytes } from 'node:crypto'
import { resolveAppOrigin, CANONICAL_HOST } from '@/utils/app-origin'

export const dynamic = 'force-dynamic'
export const revalidate = 0

const TAG = '[google/init]'

export async function GET(req: NextRequest) {
  const clientId = process.env.GOOGLE_CLIENT_ID

  // ── Resolve origin ────────────────────────────────────────────────────────
  const resolved = resolveAppOrigin(req)

  console.log(
    `${TAG} origin=${resolved.origin} source=${resolved.source}` +
    ` allowed=${resolved.allowed}` +
    ` canonical=${CANONICAL_HOST ?? '(none)'}` +
    ` fwd-proto=${req.headers.get('x-forwarded-proto') ?? 'none'}` +
    ` fwd-host=${req.headers.get('x-forwarded-host') ?? 'none'}` +
    ` req-origin=${req.nextUrl.origin}`
  )

  // Fail closed if the resolved host is not in the allowed set.
  // This guards against a spoofed X-Forwarded-Host or misconfigured proxy.
  if (!resolved.allowed) {
    console.error(
      `${TAG} FAIL: resolved host "${resolved.host}" not in allowed set` +
      ` (canonical="${CANONICAL_HOST ?? 'none'}")`
    )
    return NextResponse.redirect(new URL('/auth?error=googleFailed', resolved.origin))
  }

  if (!clientId) {
    console.error(`${TAG} FAIL: GOOGLE_CLIENT_ID not set`)
    return NextResponse.redirect(new URL('/auth?error=googleFailed', resolved.origin))
  }

  // ── CSRF state + callback URL ─────────────────────────────────────────────
  const state       = randomBytes(16).toString('hex')
  const callbackUrl = `${resolved.origin}/api/auth/google/callback`

  // ── Google consent URL ────────────────────────────────────────────────────
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

  // ── State cookie ──────────────────────────────────────────────────────────
  //
  // The cookie payload stores both:
  //   t  — the CSRF token (matched against the `state` query param on callback)
  //   cb — the exact redirect_uri used in this authorization request
  //
  // Storing cb here ensures the callback uses the identical URL for the token
  // exchange, regardless of how the callback's own origin resolves. This
  // prevents redirect_uri_mismatch under unusual routing or load-balancer
  // configurations.
  //
  // Encoding: base64url(JSON) — avoids cookie-unsafe characters.
  //
  const cookiePayload = Buffer.from(
    JSON.stringify({ t: state, cb: callbackUrl })
  ).toString('base64url')

  response.cookies.set('gauth_state', cookiePayload, {
    httpOnly: true,
    // Use the *resolved* protocol (not req.nextUrl.protocol) so the Secure
    // flag is correct even when nginx terminates TLS and Next.js sees http://.
    secure:   resolved.proto === 'https',
    sameSite: 'lax',
    maxAge:   300,   // 5 minutes — OAuth flows should complete promptly
    path:     '/',
  })

  console.log(`${TAG} OK — callbackUrl=${callbackUrl} proto=${resolved.proto}`)
  return response
}
