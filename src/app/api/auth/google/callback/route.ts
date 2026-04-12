// =============================================================================
// Google OAuth Callback
// GET /api/auth/google/callback
// =============================================================================

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/config/prisma'
import { issueTokens } from '@/utils/auth.middleware'

export const dynamic = 'force-dynamic'
export const revalidate = 0

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

function htmlEscapeJson(value: unknown) {
  return JSON.stringify(value)
    .replaceAll('<', String.raw`\u003c`)
    .replaceAll('>', String.raw`\u003e`)
    .replaceAll('&', String.raw`\u0026`)
    .replaceAll('\u2028', String.raw`\u2028`)
    .replaceAll('\u2029', String.raw`\u2029`)
}

// ── Helpers ────────────────────────────────────────────────────────────────

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

// ── Origin helper ──────────────────────────────────────────────────────────

/**
 * Resolves the app's public origin, accounting for reverse-proxy SSL termination.
 *
 * Priority:
 *   1. X-Forwarded-Proto + X-Forwarded-Host (nginx/Caddy/Cloudflare forwarded headers)
 *   2. NEXT_PUBLIC_APP_URL (explicit env var — reliable if set correctly)
 *   3. req.nextUrl.origin (local dev without proxy)
 */
function getAppOrigin(req: NextRequest): string {
  const proto = req.headers.get('x-forwarded-proto')?.split(',')[0]?.trim()
  const host  = req.headers.get('x-forwarded-host')?.split(',')[0]?.trim()
                ?? req.headers.get('host')

  if (proto && host) return `${proto}://${host}`

  const envUrl = process.env.NEXT_PUBLIC_APP_URL
  if (envUrl) return envUrl.replace(/\/$/, '')

  return req.nextUrl.origin
}

// ── Route handler ──────────────────────────────────────────────────────────

export async function GET(req: NextRequest) {
  const tag = '[google/callback]'

  const clientId     = process.env.GOOGLE_CLIENT_ID ?? ''
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET ?? ''
  const jwtSecret    = process.env.JWT_SECRET ?? ''

  // Derive origin — accounts for nginx SSL termination via X-Forwarded-Proto.
  const origin       = getAppOrigin(req)
  const callbackUrl  = new URL('/api/auth/google/callback', origin).toString()
  const authUrl      = new URL('/auth', origin)
  const dashboardUrl = new URL('/dashboard', origin)

  const fwdProto = req.headers.get('x-forwarded-proto') ?? 'none'
  const fwdHost  = req.headers.get('x-forwarded-host') ?? 'none'
  console.log(`${tag} origin=${origin} callbackUrl=${callbackUrl} fwd-proto=${fwdProto} fwd-host=${fwdHost}`)

  function redirectError(reason: 'googleDenied' | 'googleFailed') {
    authUrl.searchParams.set('error', reason)
    const r = NextResponse.redirect(authUrl)
    r.headers.set('Cache-Control', 'no-store')
    return r
  }

  // ── Env checks ────────────────────────────────────────────────────────────
  if (!clientId)     { console.error(`${tag} FAIL: GOOGLE_CLIENT_ID not set`);     return redirectError('googleFailed') }
  if (!clientSecret) { console.error(`${tag} FAIL: GOOGLE_CLIENT_SECRET not set`); return redirectError('googleFailed') }
  if (!jwtSecret)    { console.error(`${tag} FAIL: JWT_SECRET not set`);            return redirectError('googleFailed') }

  // ── OAuth params ──────────────────────────────────────────────────────────
  const code       = req.nextUrl.searchParams.get('code')
  const state      = req.nextUrl.searchParams.get('state')
  const errorParam = req.nextUrl.searchParams.get('error')

  console.log(`${tag} params: code=${code ? 'yes' : 'NO'} state=${state ? 'yes' : 'NO'} error=${errorParam ?? 'none'}`)

  if (errorParam === 'access_denied') {
    console.error(`${tag} FAIL: user denied consent`)
    return redirectError('googleDenied')
  }

  if (!code || !state) {
    console.error(`${tag} FAIL: missing code=${!!code} state=${!!state}`)
    return redirectError('googleFailed')
  }

  // ── CSRF check ────────────────────────────────────────────────────────────
  const cookieState = req.cookies.get('gauth_state')?.value

  if (!cookieState) {
    console.error(`${tag} FAIL: gauth_state cookie missing — cookie blocked, wrong domain, or secure/SameSite mismatch`)
    return redirectError('googleFailed')
  }

  if (cookieState !== state) {
    console.error(`${tag} FAIL: CSRF mismatch. cookie="${cookieState.slice(0, 8)}…" param="${state.slice(0, 8)}…"`)
    return redirectError('googleFailed')
  }

  try {
    // ── Token exchange ────────────────────────────────────────────────────
    console.log(`${tag} exchanging code for tokens…`)
    const tokenResult = await exchangeCodeForTokens(code, clientId, clientSecret, callbackUrl)

    if (!tokenResult.ok) {
      console.error(`${tag} FAIL: token exchange — error=${tokenResult.error} desc=${tokenResult.description}`)
      return redirectError('googleFailed')
    }

    console.log(`${tag} token exchange OK`)

    // ── User info ─────────────────────────────────────────────────────────
    console.log(`${tag} fetching user info…`)
    const userResult = await fetchGoogleUser(tokenResult.data.access_token)

    if (!userResult.ok) {
      console.error(`${tag} FAIL: userinfo fetch status=${userResult.status}`)
      return redirectError('googleFailed')
    }

    const { user: googleUser } = userResult
    console.log(`${tag} userinfo OK. email=${googleUser.email ? 'yes' : 'NO'} verified=${googleUser.email_verified}`)

    if (!googleUser.email || !googleUser.email_verified) {
      console.error(`${tag} FAIL: email missing or unverified`)
      return redirectError('googleFailed')
    }

    // ── DB upsert ─────────────────────────────────────────────────────────
    console.log(`${tag} upserting user…`)
    const { user, action } = await upsertGoogleUser(googleUser)
    console.log(`${tag} DB OK. action=${action} userId=${user.id}`)

    // ── Session ───────────────────────────────────────────────────────────
    const { accessToken, refreshToken, expiresAt } = issueTokens(user.id, user.email, user.role)
    console.log(`${tag} session OK. expiresAt=${new Date(expiresAt).toISOString()}`)

    const persistedSession = {
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

    // ── Success ───────────────────────────────────────────────────────────
    console.log(`${tag} SUCCESS — redirecting to ${dashboardUrl}`)

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
        sessionStorage.setItem('uci-user-store', ${htmlEscapeJson(JSON.stringify(persistedSession))});
      } catch (err) {}
      window.location.replace(${htmlEscapeJson(dashboardUrl.toString())});
    </script>
  </body>
</html>`,
      {
        status: 200,
        headers: {
          'Content-Type': 'text/html; charset=utf-8',
          'Cache-Control': 'no-store',
        },
      }
    )

    response.cookies.delete('gauth_state')
    response.cookies.delete('gauth_session')

    return response

  } catch (err) {
    console.error(`${tag} FAIL: unexpected exception —`, err)
    return redirectError('googleFailed')
  }
}
