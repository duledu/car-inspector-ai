// =============================================================================
// Google OAuth Callback
// GET /api/auth/google/callback
//
// Receives the authorization code from Google, exchanges it for tokens,
// upserts the user in the database, issues app JWT tokens, and hands the
// session off to the browser by embedding it in sessionStorage via an
// inline HTML+JS page (no intermediate cookie/page roundtrip required).
// =============================================================================

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/config/prisma'
import { issueTokens } from '@/utils/auth.middleware'
import { resolveAppOrigin, CANONICAL_HOST } from '@/utils/app-origin'

export const dynamic = 'force-dynamic'
export const revalidate = 0

const TAG = '[google/callback]'

// ---------------------------------------------------------------------------
// Interfaces
// ---------------------------------------------------------------------------

interface GoogleTokenResponse {
  access_token: string
  id_token: string
  token_type: string
  error?: string
  error_description?: string
}

interface GoogleUserInfo {
  sub: string
  email: string
  name: string
  picture?: string
  email_verified: boolean
}

// ---------------------------------------------------------------------------
// HTML encoding — safe embedding of JSON in inline <script>
// ---------------------------------------------------------------------------

function htmlEscapeJson(value: unknown): string {
  return JSON.stringify(value)
    .replaceAll('<',      String.raw`\u003c`)
    .replaceAll('>',      String.raw`\u003e`)
    .replaceAll('&',      String.raw`\u0026`)
    .replaceAll('\u2028', String.raw`\u2028`)
    .replaceAll('\u2029', String.raw`\u2029`)
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function exchangeCodeForTokens(
  code: string,
  clientId: string,
  clientSecret: string,
  callbackUrl: string,
): Promise<{ ok: true; data: GoogleTokenResponse } | { ok: false; error: string; description: string }> {
  const res = await fetch('https://oauth2.googleapis.com/token', {
    method:  'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      code,
      client_id:     clientId,
      client_secret: clientSecret,
      redirect_uri:  callbackUrl,
      grant_type:    'authorization_code',
    }),
  })
  const data: GoogleTokenResponse = await res.json()
  if (!res.ok || data.error) {
    return { ok: false, error: data.error ?? `http_${res.status}`, description: data.error_description ?? '' }
  }
  return { ok: true, data }
}

async function fetchGoogleUser(
  accessToken: string,
): Promise<{ ok: true; user: GoogleUserInfo } | { ok: false; status: number }> {
  const res = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
    headers: { Authorization: `Bearer ${accessToken}` },
  })
  if (!res.ok) return { ok: false, status: res.status }
  return { ok: true, user: await res.json() }
}

async function upsertGoogleUser(googleUser: GoogleUserInfo) {
  const existing = await prisma.user.findUnique({ where: { googleId: googleUser.sub } })
  if (existing) return { user: existing, action: 'found' as const }

  const byEmail = await prisma.user.findUnique({ where: { email: googleUser.email } })
  if (byEmail) {
    const linked = await prisma.user.update({
      where: { id: byEmail.id },
      data: {
        googleId:      googleUser.sub,
        emailVerified: byEmail.emailVerified ?? new Date(),
        avatarUrl:     byEmail.avatarUrl ?? googleUser.picture ?? null,
      },
    })
    return { user: linked, action: 'linked' as const }
  }

  const created = await prisma.user.create({
    data: {
      googleId:      googleUser.sub,
      email:         googleUser.email,
      name:          googleUser.name || googleUser.email.split('@')[0],
      avatarUrl:     googleUser.picture ?? null,
      emailVerified: new Date(),
      role:          'USER',
    },
  })
  return { user: created, action: 'created' as const }
}

// ---------------------------------------------------------------------------
// Route handler
// ---------------------------------------------------------------------------

export async function GET(req: NextRequest) {
  // ── Resolve origin ────────────────────────────────────────────────────────
  const resolved = resolveAppOrigin(req)
  const authUrl  = new URL('/auth', resolved.origin)

  function redirectError(reason: 'googleDenied' | 'googleFailed') {
    authUrl.searchParams.set('error', reason)
    const r = NextResponse.redirect(authUrl)
    r.headers.set('Cache-Control', 'no-store')
    return r
  }

  // ── Diagnostic log ────────────────────────────────────────────────────────
  const rawStateCookie = req.cookies.get('gauth_state')?.value
  const code           = req.nextUrl.searchParams.get('code')
  const stateParam     = req.nextUrl.searchParams.get('state')
  const errorParam     = req.nextUrl.searchParams.get('error')

  console.log(
    `${TAG} origin=${resolved.origin} source=${resolved.source}` +
    ` allowed=${resolved.allowed}` +
    ` canonical=${CANONICAL_HOST ?? '(none)'}` +
    ` fwd-proto=${req.headers.get('x-forwarded-proto') ?? 'none'}` +
    ` fwd-host=${req.headers.get('x-forwarded-host') ?? 'none'}` +
    ` req-origin=${req.nextUrl.origin}` +
    ` has-state-cookie=${!!rawStateCookie}` +
    ` has-code=${!!code}` +
    ` has-state-param=${!!stateParam}` +
    ` error-param=${errorParam ?? 'none'}`
  )

  // ── Origin validation ─────────────────────────────────────────────────────
  if (!resolved.allowed) {
    console.error(
      `${TAG} FAIL: resolved host "${resolved.host}" not in allowed set` +
      ` (canonical="${CANONICAL_HOST ?? 'none'}")`
    )
    return redirectError('googleFailed')
  }

  // ── Env checks ────────────────────────────────────────────────────────────
  const clientId     = process.env.GOOGLE_CLIENT_ID     ?? ''
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET ?? ''
  const jwtSecret    = process.env.JWT_SECRET            ?? ''

  if (!clientId)     { console.error(`${TAG} FAIL: GOOGLE_CLIENT_ID not set`);     return redirectError('googleFailed') }
  if (!clientSecret) { console.error(`${TAG} FAIL: GOOGLE_CLIENT_SECRET not set`); return redirectError('googleFailed') }
  if (!jwtSecret)    { console.error(`${TAG} FAIL: JWT_SECRET not set`);            return redirectError('googleFailed') }

  // ── OAuth error from Google ───────────────────────────────────────────────
  if (errorParam === 'access_denied') {
    console.error(`${TAG} FAIL: user denied consent`)
    return redirectError('googleDenied')
  }

  if (!code || !stateParam) {
    console.error(`${TAG} FAIL: missing code=${!!code} state=${!!stateParam}`)
    return redirectError('googleFailed')
  }

  // ── Parse state cookie ────────────────────────────────────────────────────
  //
  // The cookie is base64url(JSON({ t: csrfToken, cb: callbackUrl })).
  // Storing cb in the cookie guarantees the token exchange uses the exact URL
  // that was registered with Google in the init route — no recomputation.
  //
  if (!rawStateCookie) {
    console.error(
      `${TAG} FAIL: gauth_state cookie missing — ` +
      `cookie may be blocked, wrong domain, SameSite/Secure mismatch, or proxy stripping cookies`
    )
    return redirectError('googleFailed')
  }

  let storedState: string
  let callbackUrl: string

  try {
    const parsed = JSON.parse(
      Buffer.from(rawStateCookie, 'base64url').toString('utf-8')
    ) as unknown

    if (
      typeof parsed !== 'object' ||
      parsed === null ||
      typeof (parsed as Record<string, unknown>).t !== 'string' ||
      typeof (parsed as Record<string, unknown>).cb !== 'string'
    ) {
      throw new Error('invalid shape')
    }

    storedState = (parsed as { t: string; cb: string }).t
    callbackUrl = (parsed as { t: string; cb: string }).cb
    console.log(`${TAG} state cookie parsed OK. callbackUrl=${callbackUrl}`)
  } catch {
    console.error(`${TAG} FAIL: gauth_state cookie malformed (new deployment with in-flight old cookie?)`)
    return redirectError('googleFailed')
  }

  // ── CSRF check ────────────────────────────────────────────────────────────
  if (storedState !== stateParam) {
    console.error(`${TAG} FAIL: CSRF mismatch — state param does not match cookie token`)
    return redirectError('googleFailed')
  }

  try {
    // ── Token exchange ────────────────────────────────────────────────────
    console.log(`${TAG} exchanging code for tokens…`)
    const tokenResult = await exchangeCodeForTokens(code, clientId, clientSecret, callbackUrl)

    if (!tokenResult.ok) {
      console.error(
        `${TAG} FAIL: token exchange — error=${tokenResult.error} desc=${tokenResult.description}` +
        ` callbackUrl=${callbackUrl}`
      )
      return redirectError('googleFailed')
    }

    console.log(`${TAG} token exchange OK`)

    // ── User info ─────────────────────────────────────────────────────────
    const userResult = await fetchGoogleUser(tokenResult.data.access_token)

    if (!userResult.ok) {
      console.error(`${TAG} FAIL: userinfo fetch status=${userResult.status}`)
      return redirectError('googleFailed')
    }

    const { user: googleUser } = userResult
    console.log(`${TAG} userinfo OK. email-present=${!!googleUser.email} verified=${googleUser.email_verified}`)

    if (!googleUser.email || !googleUser.email_verified) {
      console.error(`${TAG} FAIL: email missing or unverified`)
      return redirectError('googleFailed')
    }

    // ── DB upsert ─────────────────────────────────────────────────────────
    const { user, action } = await upsertGoogleUser(googleUser)
    console.log(`${TAG} DB OK. action=${action} userId=${user.id}`)

    // ── Issue app tokens ──────────────────────────────────────────────────
    const { accessToken, refreshToken, expiresAt } = issueTokens(user.id, user.email, user.role)
    console.log(`${TAG} tokens issued. expiresAt=${new Date(expiresAt).toISOString()}`)

    // ── Build Zustand persist payload ─────────────────────────────────────
    //
    // The callback hands the session to the browser by writing directly to
    // sessionStorage in the format Zustand's persist middleware expects.
    // This avoids an extra cookie+roundtrip (the old gauth_session flow).
    //
    const zustandPayload = {
      state: {
        session: {
          accessToken,
          refreshToken,
          expiresAt,
          user: {
            id:        user.id,
            email:     user.email,
            name:      user.name,
            avatarUrl: user.avatarUrl,
            role:      user.role,
            createdAt: user.createdAt.toISOString(),
          },
        },
        isAuthenticated: true,
      },
      version: 0,
    }

    const dashboardUrl = new URL('/dashboard', resolved.origin)

    console.log(`${TAG} SUCCESS — redirecting to ${dashboardUrl}`)

    // ── Response ──────────────────────────────────────────────────────────
    //
    // Returns a minimal HTML page that:
    //   1. Writes the session to sessionStorage under the Zustand key.
    //   2. Immediately replaces the current URL with /dashboard.
    //
    // The window.location.replace call is intentional — it removes the OAuth
    // callback URL (with `code` and `state` params) from history so the user
    // cannot accidentally re-use it.
    //
    const response = new NextResponse(
      `<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width,initial-scale=1" />
    <meta name="robots" content="noindex" />
    <title>Signing in...</title>
  </head>
  <body>
    <script>
      try {
        sessionStorage.setItem('uci-user-store', ${htmlEscapeJson(JSON.stringify(zustandPayload))});
      } catch (err) {}
      window.location.replace(${htmlEscapeJson(dashboardUrl.toString())});
    </script>
  </body>
</html>`,
      {
        status: 200,
        headers: {
          'Content-Type':  'text/html; charset=utf-8',
          'Cache-Control': 'no-store',
        },
      }
    )

    // Clear the CSRF state cookie — it is single-use.
    response.cookies.delete('gauth_state')

    return response

  } catch (err) {
    console.error(`${TAG} FAIL: unexpected exception —`, err)
    return redirectError('googleFailed')
  }
}
