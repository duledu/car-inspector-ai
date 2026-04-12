// =============================================================================
// Google OAuth Callback
// GET /api/auth/google/callback
// Verifies CSRF state, exchanges code for tokens, upserts user, issues JWTs,
// stores the client session, then redirects to /dashboard.
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

export async function GET(req: NextRequest) {
  const clientId = process.env.GOOGLE_CLIENT_ID ?? ''
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET ?? ''
  // Use the actual request origin — not NEXT_PUBLIC_APP_URL — so the
  // redirect_uri sent to Google for token exchange always matches what
  // the init route registered. This makes localhost and production
  // work independently without changing env vars.
  const origin = req.nextUrl.origin
  const callbackUrl = new URL('/api/auth/google/callback', origin).toString()
  const authUrl = new URL('/auth', origin)
  const dashboardUrl = new URL('/dashboard', origin)

  function redirectAuthError(error: 'googleDenied' | 'googleFailed') {
    authUrl.searchParams.set('error', error)
    const response = NextResponse.redirect(authUrl)
    response.headers.set('Cache-Control', 'no-store')
    return response
  }

  const { searchParams } = req.nextUrl
  const code = searchParams.get('code')
  const state = searchParams.get('state')
  const errorParam = searchParams.get('error')

  if (errorParam === 'access_denied') {
    return redirectAuthError('googleDenied')
  }

  if (!code || !state) {
    return redirectAuthError('googleFailed')
  }

  const cookieState = req.cookies.get('gauth_state')?.value
  if (!cookieState || cookieState !== state) {
    console.error('[google/callback] CSRF state mismatch')
    return redirectAuthError('googleFailed')
  }

  try {
    const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code,
        client_id: clientId,
        client_secret: clientSecret,
        redirect_uri: callbackUrl,
        grant_type: 'authorization_code',
      }),
    })

    const tokenData: GoogleTokenResponse = await tokenRes.json()

    if (!tokenRes.ok || tokenData.error) {
      console.error('[google/callback] token exchange failed:', tokenData)
      return redirectAuthError('googleFailed')
    }

    const userInfoRes = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
      headers: { Authorization: `Bearer ${tokenData.access_token}` },
    })

    if (!userInfoRes.ok) {
      console.error('[google/callback] userinfo fetch failed')
      return redirectAuthError('googleFailed')
    }

    const googleUser: GoogleUserInfo = await userInfoRes.json()

    if (!googleUser.email || !googleUser.email_verified) {
      console.error('[google/callback] unverified or missing email')
      return redirectAuthError('googleFailed')
    }

    let user = await prisma.user.findUnique({ where: { googleId: googleUser.sub } })

    if (!user) {
      const byEmail = await prisma.user.findUnique({ where: { email: googleUser.email } })
      if (byEmail) {
        user = await prisma.user.update({
          where: { id: byEmail.id },
          data: {
            googleId: googleUser.sub,
            emailVerified: byEmail.emailVerified ?? new Date(),
            avatarUrl: byEmail.avatarUrl ?? googleUser.picture ?? null,
          },
        })
      } else {
        user = await prisma.user.create({
          data: {
            googleId: googleUser.sub,
            email: googleUser.email,
            name: googleUser.name || googleUser.email.split('@')[0],
            avatarUrl: googleUser.picture ?? null,
            emailVerified: new Date(),
            role: 'USER',
          },
        })
      }
    }

    const { accessToken, refreshToken, expiresAt } = issueTokens(user.id, user.email, user.role)

    const persistedSession = {
      state: {
        session: {
          accessToken,
          refreshToken,
          expiresAt,
          user: {
            id: user.id,
            email: user.email,
            name: user.name,
            avatarUrl: user.avatarUrl,
            role: user.role,
            createdAt: user.createdAt.toISOString(),
          },
        },
        isAuthenticated: true,
      },
      version: 0,
    }

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
    console.error('[google/callback] unexpected error:', err)
    return redirectAuthError('googleFailed')
  }
}
