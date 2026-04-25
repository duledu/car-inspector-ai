// =============================================================================
// Google OAuth Callback - canonical path
// GET /api/auth/callback/google
//
// This is the redirect URI registered in Google Cloud Console.
// The init route (/api/auth/google/init) sends users here after consent.
// =============================================================================

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/config/prisma'
import { issueTokens } from '@/utils/auth.middleware'
import {
  CANONICAL_GOOGLE_CALLBACK_URL,
  buildUrlForOrigin,
  getProductionAuthConfigIssues,
  getAppOrigin as getCanonicalAppOrigin,
  getRequestOrigin,
  shouldUseCanonicalHost,
} from '@/utils/canonical-origin'

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

async function exchangeCodeForTokens(
  code: string,
  clientId: string,
  clientSecret: string,
  callbackUrl: string,
): Promise<{ ok: true; data: GoogleTokenResponse } | { ok: false; error: string; description: string }> {
  const res = await fetch('https://oauth2.googleapis.com/token', {
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
        googleId: googleUser.sub,
        emailVerified: byEmail.emailVerified ?? new Date(),
        avatarUrl: byEmail.avatarUrl ?? googleUser.picture ?? null,
      },
    })
    return { user: linked, action: 'linked' as const }
  }

  const created = await prisma.user.create({
    data: {
      googleId: googleUser.sub,
      email: googleUser.email,
      name: googleUser.name || googleUser.email.split('@')[0],
      avatarUrl: googleUser.picture ?? null,
      emailVerified: new Date(),
      role: 'USER',
      preferredLanguage: 'en',
    },
  })
  return { user: created, action: 'created' as const }
}

export async function GET(req: NextRequest) {
  const tag = '[auth/callback/google]'

  const clientId = process.env.GOOGLE_CLIENT_ID ?? ''
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET ?? ''
  const jwtSecret = process.env.JWT_SECRET ?? ''

  const origin = getCanonicalAppOrigin(req)
  const requestOrigin = getRequestOrigin(req)
  const configIssues = getProductionAuthConfigIssues()

  if (configIssues.length) {
    console.error(`${tag} production auth config mismatch: ${configIssues.join(', ')}`)
  }

  if (shouldUseCanonicalHost(req) || requestOrigin !== origin) {
    const response = NextResponse.redirect(buildUrlForOrigin(req, origin), 308)
    response.headers.set('Cache-Control', 'no-store')
    console.warn(`${tag} non-canonical callback origin redirected: requestOrigin=${requestOrigin} canonicalOrigin=${origin}`)
    return response
  }

  const callbackUrl = new URL('/api/auth/callback/google', origin).toString()
  const authUrl = new URL('/auth', origin)
  const completeUrl = new URL('/auth/google/complete', origin)

  const fwdProto = req.headers.get('x-forwarded-proto') ?? 'none'
  const fwdHost = req.headers.get('x-forwarded-host') ?? 'none'
  console.log(`${tag} host=${req.headers.get('host') ?? 'none'} origin=${origin} callbackUrl=${callbackUrl} redirectUrl=${completeUrl} fwd-proto=${fwdProto} fwd-host=${fwdHost}`)

  function redirectError(error: string, reason: string) {
    authUrl.searchParams.set('error', error)
    authUrl.searchParams.set('reason', reason)
    const response = NextResponse.redirect(authUrl)
    response.headers.set('Cache-Control', 'no-store')
    response.cookies.delete('gauth_state')
    response.cookies.delete('gauth_session')
    return response
  }

  if (process.env.VERCEL_ENV === 'production' && callbackUrl !== CANONICAL_GOOGLE_CALLBACK_URL) {
    console.error(`${tag} FAIL: production callbackUrl mismatch. callbackUrl=${callbackUrl}`)
    return redirectError('googleConfig', 'bad_redirect_uri')
  }

  if (!clientId) {
    console.error(`${tag} FAIL: GOOGLE_CLIENT_ID not set`)
    return redirectError('googleConfig', 'missing_client_id')
  }
  if (!clientSecret) {
    console.error(`${tag} FAIL: GOOGLE_CLIENT_SECRET not set`)
    return redirectError('googleConfig', 'missing_client_secret')
  }
  if (!jwtSecret) {
    console.error(`${tag} FAIL: JWT_SECRET not set`)
    return redirectError('googleConfig', 'missing_jwt_secret')
  }

  const code = req.nextUrl.searchParams.get('code')
  const state = req.nextUrl.searchParams.get('state')
  const errorParam = req.nextUrl.searchParams.get('error')

  console.log(`${tag} params: code=${code ? 'yes' : 'NO'} state=${state ? 'yes' : 'NO'} error=${errorParam ?? 'none'}`)

  if (errorParam === 'access_denied') {
    console.error(`${tag} FAIL: user denied consent`)
    return redirectError('googleDenied', 'access_denied')
  }

  if (!code || !state) {
    console.error(`${tag} FAIL: missing code=${!!code} state=${!!state}`)
    return redirectError('googleFailed', 'missing_oauth_params')
  }

  const cookieState = req.cookies.get('gauth_state')?.value
  if (!cookieState) {
    console.error(`${tag} FAIL: gauth_state cookie missing. requestOrigin=${requestOrigin} callbackUrl=${callbackUrl}`)
    return redirectError('googleStateMissing', 'state_cookie_missing')
  }

  if (cookieState !== state) {
    console.error(`${tag} FAIL: CSRF mismatch. cookie="${cookieState.slice(0, 8)}..." param="${state.slice(0, 8)}..."`)
    return redirectError('googleStateMismatch', 'state_mismatch')
  }

  try {
    console.log(`${tag} exchanging code for tokens...`)
    const tokenResult = await exchangeCodeForTokens(code, clientId, clientSecret, callbackUrl)

    if (!tokenResult.ok) {
      console.error(`${tag} FAIL: token exchange. error=${tokenResult.error} desc=${tokenResult.description}`)
      const isRedirectMismatch = tokenResult.error === 'redirect_uri_mismatch'
      return redirectError(isRedirectMismatch ? 'googleRedirectMismatch' : 'googleProvider', tokenResult.error)
    }

    console.log(`${tag} token exchange OK`)
    console.log(`${tag} fetching user info...`)
    const userResult = await fetchGoogleUser(tokenResult.data.access_token)

    if (!userResult.ok) {
      console.error(`${tag} FAIL: userinfo fetch status=${userResult.status}`)
      return redirectError('googleProvider', `userinfo_${userResult.status}`)
    }

    const { user: googleUser } = userResult
    console.log(`${tag} userinfo OK. emailPresent=${googleUser.email ? 'yes' : 'no'} verified=${googleUser.email_verified ? 'yes' : 'no'}`)

    if (!googleUser.email || !googleUser.email_verified) {
      console.error(`${tag} FAIL: email missing or unverified`)
      return redirectError('googleEmailUnverified', 'email_missing_or_unverified')
    }

    console.log(`${tag} upserting user...`)
    const { user, action } = await upsertGoogleUser(googleUser)
    console.log(`${tag} DB OK. action=${action}`)

    const { accessToken, refreshToken, expiresAt } = issueTokens(user.id, user.email, user.role)
    console.log(`${tag} session OK. expiresAt=${new Date(expiresAt).toISOString()}`)

    const handoffSession = {
      expiresAt,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        avatarUrl: user.avatarUrl,
        role: user.role,
        preferredLanguage: user.preferredLanguage ?? 'en',
        emailVerified: true,
        createdAt: user.createdAt.toISOString(),
      },
    }

    console.log(`${tag} SUCCESS - redirecting to ${completeUrl}`)

    const response = NextResponse.redirect(completeUrl)
    response.headers.set('Cache-Control', 'no-store')
    response.cookies.delete('gauth_state')

    const isProd = process.env.NODE_ENV === 'production'

    response.cookies.set('uci_ev', '1', {
      httpOnly: true,
      sameSite: 'lax',
      path: '/',
      maxAge: 30 * 24 * 60 * 60,
      secure: isProd,
    })

    response.cookies.set('gauth_session', JSON.stringify(handoffSession), {
      httpOnly: true,
      sameSite: 'lax',
      path: '/api/auth/google/session',
      maxAge: 5 * 60,
      secure: isProd,
    })

    response.cookies.set('uci_at', accessToken, {
      httpOnly: true,
      sameSite: 'lax',
      path: '/',
      maxAge: 15 * 60,
      secure: isProd,
    })
    response.cookies.set('uci_rt', refreshToken, {
      httpOnly: true,
      sameSite: 'lax',
      path: '/api/auth/refresh',
      maxAge: 30 * 24 * 60 * 60,
      secure: isProd,
    })

    return response
  } catch (err) {
    console.error(`${tag} FAIL: unexpected exception`, err)
    return redirectError('googleFailed', 'unexpected_exception')
  }
}
