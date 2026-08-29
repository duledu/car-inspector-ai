// =============================================================================
// Auth API Route — /api/auth/[action]
// Handles: login, register, refresh, logout, me
// =============================================================================

import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import bcrypt from 'bcryptjs'
import crypto from 'crypto'
import { prisma } from '@/config/prisma'
import { issueTokens, requireAuth } from '@/utils/auth.middleware'
import { apiError, logApiError } from '@/utils/api-response'
import { consumeEmailVerificationToken, consumePasswordResetToken } from '@/lib/email/token-utils'
import { sendVerifyEmail } from '@/lib/email/senders/send-verify-email'
import { sendResetPasswordEmail } from '@/lib/email/senders/send-reset-password-email'
import { COUNTRY_MARKET_CONFIG, getCountryConfig } from '@/lib/markets/country-config'
import { CURRENT_TERMS_VERSION, CURRENT_PRIVACY_VERSION, CURRENT_RISK_ACK_VERSION } from '@/lib/legal/legal-config'
import { recordConsent, getRequestMeta } from '@/lib/legal/consent-record'
import { hasCurrentConsent } from '@/lib/legal/consent-guard'

export const runtime = 'nodejs'

// ─── Schemas ─────────────────────────────────────────────────────────────────

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
})

const SUPPORTED_LANGS = ['en', 'sr', 'de', 'mk', 'sq', 'bg'] as const

const registerSchema = z.object({
  name: z.string().min(2).max(100),
  email: z.string().email(),
  password: z.string().min(8).max(128),
  preferredLanguage: z.enum(SUPPORTED_LANGS).optional().default('en'),
  countryCode: z.string().length(2).toUpperCase().refine(code => code in COUNTRY_MARKET_CONFIG, {
    message: 'Unsupported country code',
  }),
  preferredCurrency: z.string().min(3).max(3).toUpperCase().optional().nullable(),
  // ─── Mandatory consent — server-authoritative, not just a UI checkbox ──────
  // Both acknowledgements must be affirmatively true, and the versions the
  // client claims to have shown the user must exactly match the CURRENT
  // required versions (see legal-config.ts) — a stale, forged, or omitted
  // version is rejected, never silently accepted.
  termsAccepted: z.literal(true, { errorMap: () => ({ message: 'Terms of Use acceptance is required.' }) }),
  riskAckAccepted: z.literal(true, { errorMap: () => ({ message: 'Risk acknowledgement acceptance is required.' }) }),
  termsVersion: z.string().min(1),
  privacyVersion: z.string().min(1),
  riskAckVersion: z.string().min(1),
  platform: z.enum(['WEB', 'ANDROID']).optional().default('WEB'),
})

const forgotPasswordSchema = z.object({
  email: z.string().trim().email(),
})

const resetPasswordSchema = z.object({
  token: z.string().min(1),
  newPassword: z.string().min(8).max(128),
})

const verifyEmailSchema = z.object({
  token: z.string().min(1),
})

const consentSchema = z.object({
  termsAccepted: z.literal(true, { errorMap: () => ({ message: 'Terms of Use acceptance is required.' }) }),
  riskAckAccepted: z.literal(true, { errorMap: () => ({ message: 'Risk acknowledgement acceptance is required.' }) }),
  termsVersion: z.string().min(1),
  privacyVersion: z.string().min(1),
  riskAckVersion: z.string().min(1),
  locale: z.enum(SUPPORTED_LANGS).optional().default('en'),
  platform: z.enum(['WEB', 'ANDROID']).optional().default('WEB'),
})

// ─── Route Handlers ──────────────────────────────────────────────────────────

export async function POST(
  req: NextRequest,
  { params }: { params: { action: string } }
) {
  const body = await req.json().catch(() => ({}))

  switch (params.action) {
    case 'login':
      return handleLogin(body)
    case 'register':
      return handleRegister(req, body)
    case 'refresh':
      return handleRefresh(req)
    case 'logout': {
      const logoutRes = NextResponse.json({ data: { success: true } })
      clearEvCookie(logoutRes)
      clearAuthCookies(logoutRes)
      return logoutRes
    }
    case 'consent':
      return handleConsent(req, body)
    case 'forgot-password':
      return handleForgotPassword(body)
    case 'reset-password':
      return handleResetPassword(body)
    case 'send-verification':
      return handleSendVerification(req)
    case 'verify-email':
      return handleVerifyEmail(body)
    case 'delete-account':
      return handleDeleteAccount(req, body)
    default:
      return apiError('Not found', { status: 404, code: 'NOT_FOUND' })
  }
}

export async function GET(
  req: NextRequest,
  { params }: { params: { action: string } }
) {
  if (params.action === 'me') {
    return handleGetMe(req)
  }
  return apiError('Not found', { status: 404, code: 'NOT_FOUND' })
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: { action: string } }
) {
  if (params.action === 'me') {
    return handleUpdateProfile(req)
  }
  return apiError('Not found', { status: 404, code: 'NOT_FOUND' })
}

// ─── Cookie helpers ───────────────────────────────────────────────────────────

const IS_PROD    = process.env.NODE_ENV === 'production'

const EV_COOKIE  = 'uci_ev'
const EV_MAX_AGE = 30 * 24 * 60 * 60  // 30 days

const AT_COOKIE  = 'uci_at'            // access token — httpOnly, 15 min
const RT_COOKIE  = 'uci_rt'            // refresh token — httpOnly, 30 days, scoped to refresh endpoint
const AT_MAX_AGE = 15 * 60
const RT_MAX_AGE = 30 * 24 * 60 * 60

function setEvCookie(res: NextResponse, verified: boolean) {
  res.cookies.set(EV_COOKIE, verified ? '1' : '0', {
    httpOnly: true,
    sameSite: 'lax',
    path:     '/',
    maxAge:   EV_MAX_AGE,
    secure:   IS_PROD,
  })
}

function clearEvCookie(res: NextResponse) {
  res.cookies.set(EV_COOKIE, '', { httpOnly: true, sameSite: 'lax', path: '/', maxAge: 0, secure: IS_PROD })
}

/** Set both auth token cookies. Called after every successful login/register/refresh. */
function setAuthCookies(res: NextResponse, accessToken: string, refreshToken: string) {
  res.cookies.set(AT_COOKIE, accessToken, {
    httpOnly: true,
    sameSite: 'lax',
    path:     '/',
    maxAge:   AT_MAX_AGE,
    secure:   IS_PROD,
  })
  res.cookies.set(RT_COOKIE, refreshToken, {
    httpOnly: true,
    sameSite: 'lax',
    path:     '/api/auth/refresh',
    maxAge:   RT_MAX_AGE,
    secure:   IS_PROD,
  })
}

/** Clear both auth token cookies. Called on logout and account deletion. */
function clearAuthCookies(res: NextResponse) {
  res.cookies.set(AT_COOKIE, '', { httpOnly: true, sameSite: 'lax', path: '/',                 maxAge: 0, secure: IS_PROD })
  res.cookies.set(RT_COOKIE, '', { httpOnly: true, sameSite: 'lax', path: '/api/auth/refresh', maxAge: 0, secure: IS_PROD })
}

// ─── DTO helper ──────────────────────────────────────────────────────────────

async function toUserDto(user: { id: string; email: string; name: string; avatarUrl: string | null; role: string; preferredLanguage: string | null; countryCode?: string | null; preferredCurrency?: string | null; emailVerified: Date | null; createdAt: Date }) {
  const countryConfig = user.countryCode ? getCountryConfig(user.countryCode) : null
  const { hasCurrentConsent: consentOk } = await hasCurrentConsent(user.id)
  return {
    id:                user.id,
    email:             user.email,
    name:              user.name,
    avatarUrl:         user.avatarUrl,
    role:              user.role,
    preferredLanguage: user.preferredLanguage ?? 'en',
    country:           countryConfig?.name ?? null,
    countryCode:       user.countryCode ?? null,
    preferredCurrency: user.preferredCurrency ?? countryConfig?.currency ?? null,
    emailVerified:     !!user.emailVerified,
    hasCurrentConsent: consentOk,
    createdAt:         user.createdAt.toISOString(),
  }
}

function hashEmailForLogs(email: string): string {
  return crypto.createHash('sha256').update(email.toLowerCase()).digest('hex').slice(0, 12)
}

// ─── Handlers ────────────────────────────────────────────────────────────────

async function handleLogin(body: unknown) {
  // Guard: missing JWT_SECRET is a config error, not a credential error
  if (!process.env.JWT_SECRET) {
    console.error('[login] JWT_SECRET environment variable is not set')
    return apiError('Authentication service is not configured. Contact support.', { status: 503, code: 'CONFIG_ERROR' })
  }

  const parsed = loginSchema.safeParse(body)
  if (!parsed.success) {
    return apiError('Invalid credentials format', { status: 422, code: 'VALIDATION_ERROR' })
  }

  try {
    const user = await prisma.user.findUnique({
      where: { email: parsed.data.email },
    })

    if (!user?.passwordHash) {
      return apiError('Invalid email or password', { status: 401, code: 'INVALID_CREDENTIALS' })
    }

    const passwordValid = await bcrypt.compare(parsed.data.password, user.passwordHash)

    if (!passwordValid) {
      return apiError('Invalid email or password', { status: 401, code: 'INVALID_CREDENTIALS' })
    }

    const emailVerified = !!user.emailVerified
    const { accessToken, refreshToken, expiresAt } = issueTokens(user.id, user.email, user.role, emailVerified)
    const res = NextResponse.json({
      data: { expiresAt, user: await toUserDto(user) },
    })
    setEvCookie(res, emailVerified)
    setAuthCookies(res, accessToken, refreshToken)
    return res
  } catch (error) {
    logApiError('auth/login', 'login', error)
    const message = error instanceof Error ? error.message : String(error)
    return apiError('An unexpected error occurred. Please try again.', { status: 500, code: 'INTERNAL_ERROR', details: { detail: message } })
  }
}

async function handleRegister(req: NextRequest, body: unknown) {
  const parsed = registerSchema.safeParse(body)
  if (!parsed.success) {
    return apiError('Validation failed', { status: 422, code: 'VALIDATION_ERROR', details: parsed.error.flatten().fieldErrors })
  }

  // Never trust client-supplied version identifiers — the versions the
  // client says it showed the user must exactly equal what we currently
  // require. A stale, forged, or otherwise-mismatched version is rejected
  // outright; there is no partial credit for "accepted an old version."
  if (
    parsed.data.termsVersion !== CURRENT_TERMS_VERSION ||
    parsed.data.privacyVersion !== CURRENT_PRIVACY_VERSION ||
    parsed.data.riskAckVersion !== CURRENT_RISK_ACK_VERSION
  ) {
    return apiError(
      'The Terms of Use, Privacy Policy, or risk acknowledgement you reviewed are out of date. Please reload and accept the current versions.',
      { status: 422, code: 'CONSENT_VERSION_MISMATCH' },
    )
  }

  const existing = await prisma.user.findUnique({ where: { email: parsed.data.email } })
  if (existing) {
    return apiError('An account with this email already exists', { status: 409, code: 'EMAIL_IN_USE' })
  }

  const passwordHash = await bcrypt.hash(parsed.data.password, 12)
  const countryConfig = getCountryConfig(parsed.data.countryCode)
  const requestMeta = getRequestMeta(req)

  // Account creation and consent evidence are atomic — there is no window
  // in which a User row exists without a matching ConsentRecord.
  const user = await prisma.$transaction(async (tx) => {
    const created = await tx.user.create({
      data: {
        name: parsed.data.name,
        email: parsed.data.email,
        passwordHash,
        role: 'USER',
        preferredLanguage: parsed.data.preferredLanguage,
        countryCode: parsed.data.countryCode,
        preferredCurrency: parsed.data.preferredCurrency ?? countryConfig.currency,
      },
    })
    await recordConsent(
      { userId: created.id, locale: parsed.data.preferredLanguage, platform: parsed.data.platform, meta: requestMeta },
      tx,
    )
    return created
  })

  const emailResult = await sendVerifyEmail({ userId: user.id, to: user.email, name: user.name, lang: user.preferredLanguage, req })
  if (!emailResult.success) {
    console.error('[auth/register] verification email failed', {
      userId: user.id,
      errorCode: emailResult.error ?? 'UNKNOWN',
    })
    await prisma.user.delete({ where: { id: user.id } }).catch(err => {
      console.error('[auth/register] cleanup after verification email failure failed', {
        userId: user.id,
        errorName: err instanceof Error ? err.name : 'unknown',
      })
    })
    return apiError('Failed to send verification email. Please try again.', { status: 502, code: 'EMAIL_DELIVERY_FAILED' })
  }

  const { accessToken, refreshToken, expiresAt } = issueTokens(user.id, user.email, user.role, false)

  const res = NextResponse.json(
    { data: { expiresAt, user: await toUserDto(user) } },
    { status: 201 }
  )
  setEvCookie(res, false) // new registrations are always unverified
  setAuthCookies(res, accessToken, refreshToken)
  return res
}

/**
 * POST /api/auth/consent — records affirmative acceptance for an ALREADY
 * authenticated user who does not yet have current consent. Covers two
 * cases: a Google OAuth account that was created with zero consent UI (see
 * the OAuth callback), and an existing user re-consenting after a required
 * legal-document version change. Never fabricates acceptance — the caller
 * must affirmatively submit both acknowledgements and the exact current
 * versions, validated the same way as at registration.
 */
async function handleConsent(req: NextRequest, body: unknown) {
  const authResult = await requireAuth(req, { allowUnverified: true })
  if (!authResult.success) {
    return apiError('Unauthorized', { status: 401, code: 'UNAUTHORIZED' })
  }

  const parsed = consentSchema.safeParse(body)
  if (!parsed.success) {
    return apiError('Validation failed', { status: 422, code: 'VALIDATION_ERROR', details: parsed.error.flatten().fieldErrors })
  }

  if (
    parsed.data.termsVersion !== CURRENT_TERMS_VERSION ||
    parsed.data.privacyVersion !== CURRENT_PRIVACY_VERSION ||
    parsed.data.riskAckVersion !== CURRENT_RISK_ACK_VERSION
  ) {
    return apiError(
      'The Terms of Use, Privacy Policy, or risk acknowledgement you reviewed are out of date. Please reload and accept the current versions.',
      { status: 422, code: 'CONSENT_VERSION_MISMATCH' },
    )
  }

  const user = await prisma.user.findUnique({ where: { id: authResult.userId } })
  if (!user) return apiError('User not found', { status: 404, code: 'NOT_FOUND' })

  await recordConsent(
    { userId: user.id, locale: parsed.data.locale, platform: parsed.data.platform, meta: getRequestMeta(req) },
    prisma,
  )

  return NextResponse.json({ data: await toUserDto(user) })
}

async function handleRefresh(req: NextRequest) {
  const rawToken = req.cookies.get(RT_COOKIE)?.value ?? null

  if (!rawToken) {
    return apiError('Refresh token required', { status: 422, code: 'VALIDATION_ERROR' })
  }

  try {
    const jwt = await import('jsonwebtoken')
    const JWT_SECRET = process.env.JWT_SECRET
    if (!JWT_SECRET) throw new Error('JWT_SECRET is not configured')
    const payload = jwt.default.verify(rawToken, JWT_SECRET) as {
      sub: string
      type: string
    }

    if (payload.type !== 'refresh') {
      throw new Error('Not a refresh token')
    }

    const user = await prisma.user.findUnique({ where: { id: payload.sub } })
    if (!user) throw new Error('User not found')

    const emailVerified = !!user.emailVerified
    const { accessToken, refreshToken, expiresAt } = issueTokens(user.id, user.email, user.role, emailVerified)
    const res = NextResponse.json({
      data: { expiresAt, user: await toUserDto(user) },
    })
    setEvCookie(res, emailVerified)
    setAuthCookies(res, accessToken, refreshToken)
    return res
  } catch {
    return apiError('Invalid or expired refresh token', { status: 401, code: 'INVALID_REFRESH_TOKEN' })
  }
}

async function handleGetMe(req: NextRequest) {
  const authResult = await requireAuth(req, { allowUnverified: true })
  if (!authResult.success) {
    return apiError('Unauthorized', { status: 401, code: 'UNAUTHORIZED' })
  }

  const user = await prisma.user.findUnique({ where: { id: authResult.userId } })
  if (!user) {
    return apiError('User not found', { status: 404, code: 'NOT_FOUND' })
  }

  return NextResponse.json({ data: await toUserDto(user) })
}

async function handleForgotPassword(body: unknown) {
  const parsed = forgotPasswordSchema.safeParse(body)
  if (!parsed.success) {
    return apiError('Valid email required', { status: 422, code: 'VALIDATION_ERROR' })
  }

  const requestedEmail = parsed.data.email
  const emailHash = hashEmailForLogs(requestedEmail)
  console.info('[auth/forgot-password] request received', { emailHash })

  try {
    const user = await prisma.user.findFirst({
      where: { email: { equals: requestedEmail, mode: 'insensitive' } },
    })

    // Always return success to prevent email enumeration
    if (!user) {
      console.info('[auth/forgot-password] user lookup missed', { emailHash })
      return NextResponse.json({ data: { success: true } })
    }

    console.info('[auth/forgot-password] user lookup matched', {
      emailHash,
      userId: user.id,
      hasPasswordHash: !!user.passwordHash,
    })

    const emailResult = await sendResetPasswordEmail({ userId: user.id, to: user.email, name: user.name, lang: user.preferredLanguage })
    if (!emailResult.success) {
      console.error('[auth/forgot-password] reset email failed', {
        userId: user.id,
        errorCode: emailResult.error ?? 'UNKNOWN',
      })
      // Surface real system failures — the user exists so we are not leaking account presence
      return apiError('Failed to send reset email. Please try again.', { status: 502, code: 'EMAIL_DELIVERY_FAILED' })
    }

    console.info('[auth/forgot-password] reset email sent', {
      emailHash,
      userId: user.id,
      messageId: emailResult.messageId,
    })

    return NextResponse.json({ data: { success: true } })
  } catch (error) {
    logApiError('auth/forgot-password', 'forgotPassword', error, { emailHash })
    return apiError('An unexpected error occurred. Please try again.', { status: 500, code: 'INTERNAL_ERROR' })
  }
}

async function handleResetPassword(body: unknown) {
  const parsed = resetPasswordSchema.safeParse(body)
  if (!parsed.success) {
    return apiError('Invalid request', { status: 422, code: 'VALIDATION_ERROR' })
  }

  try {
    const result = await consumePasswordResetToken(parsed.data.token)
    if ('error' in result) {
      const msg = result.error === 'expired' ? 'This reset link has expired. Please request a new one.' : 'Invalid or already used reset link.'
      return apiError(msg, { status: 400, code: 'INVALID_TOKEN' })
    }

    const passwordHash = await bcrypt.hash(parsed.data.newPassword, 12)
    await prisma.user.update({ where: { id: result.userId }, data: { passwordHash } })

    return NextResponse.json({ data: { success: true } })
  } catch (error) {
    logApiError('auth/reset-password', 'resetPassword', error)
    return apiError('An unexpected error occurred. Please try again.', { status: 500, code: 'INTERNAL_ERROR' })
  }
}

async function handleSendVerification(req: NextRequest) {
  const authResult = await requireAuth(req, { allowUnverified: true })
  if (!authResult.success) {
    return apiError('Unauthorized', { status: 401, code: 'UNAUTHORIZED' })
  }

  try {
    const user = await prisma.user.findUnique({ where: { id: authResult.userId } })
    if (!user) return apiError('User not found', { status: 404, code: 'NOT_FOUND' })
    if (user.emailVerified) return NextResponse.json({ data: { success: true, alreadyVerified: true } })

    const emailResult = await sendVerifyEmail({ userId: user.id, to: user.email, name: user.name, lang: user.preferredLanguage, req })
    if (!emailResult.success) {
      console.error('[auth/send-verification] email failed', {
        userId: authResult.userId,
        errorCode: emailResult.error ?? 'UNKNOWN',
      })
      return apiError('Failed to send verification email. Please try again.', { status: 502, code: 'EMAIL_DELIVERY_FAILED' })
    }

    return NextResponse.json({ data: { success: true } })
  } catch (error) {
    logApiError('auth/send-verification', 'sendVerification', error)
    return apiError('An unexpected error occurred. Please try again.', { status: 500, code: 'INTERNAL_ERROR' })
  }
}

async function handleVerifyEmail(body: unknown) {
  const parsed = verifyEmailSchema.safeParse(body)
  if (!parsed.success) {
    return apiError('Token required', { status: 422, code: 'VALIDATION_ERROR' })
  }

  try {
    const result = await consumeEmailVerificationToken(parsed.data.token)
    if ('error' in result) {
      const msg = result.error === 'expired' ? 'This verification link has expired. Please request a new one.' : 'Invalid or already used verification link.'
      return apiError(msg, { status: 400, code: 'INVALID_TOKEN' })
    }

    await prisma.user.update({ where: { id: result.userId }, data: { emailVerified: new Date() } })

    const verifyRes = NextResponse.json({ data: { success: true } })
    setEvCookie(verifyRes, true)
    return verifyRes
  } catch (error) {
    logApiError('auth/verify-email', 'verifyEmail', error)
    return apiError('An unexpected error occurred. Please try again.', { status: 500, code: 'INTERNAL_ERROR' })
  }
}

async function handleUpdateProfile(req: NextRequest) {
  const authResult = await requireAuth(req)
  if (!authResult.success) {
    return apiError('Unauthorized', { status: 401, code: 'UNAUTHORIZED' })
  }

  const body = await req.json().catch(() => ({}))
  const schema = z.object({
    name: z.string().min(2).max(100).optional(),
    avatarUrl: z.string().url().nullable().optional(),
    preferredLanguage: z.enum(SUPPORTED_LANGS).optional(),
    countryCode: z.string().length(2).toUpperCase().refine(code => code in COUNTRY_MARKET_CONFIG, {
      message: 'Unsupported country code',
    }).nullable().optional(),
    preferredCurrency: z.string().min(3).max(3).toUpperCase().nullable().optional(),
  })

  const parsed = schema.safeParse(body)
  if (!parsed.success) {
    return apiError('Validation failed', { status: 422, code: 'VALIDATION_ERROR' })
  }

  const updateData = { ...parsed.data }
  if (parsed.data.countryCode !== undefined) {
    updateData.preferredCurrency = parsed.data.countryCode
      ? getCountryConfig(parsed.data.countryCode).currency
      : null
  }

  const updated = await prisma.user.update({
    where: { id: authResult.userId },
    data: updateData,
  })

  return NextResponse.json({ data: await toUserDto(updated) })
}

async function handleDeleteAccount(req: NextRequest, body: unknown) {
  const authResult = await requireAuth(req)
  if (!authResult.success) {
    return apiError('Unauthorized', { status: 401, code: 'UNAUTHORIZED' })
  }

  const schema = z.object({
    confirmed: z.literal(true),
  })

  const parsed = schema.safeParse(body)
  if (!parsed.success) {
    return apiError('Confirmation required', { status: 422, code: 'CONFIRMATION_REQUIRED' })
  }

  try {
    await prisma.$transaction(async (tx) => {
      await tx.paymentEvent.deleteMany({
        where: { userId: authResult.userId },
      })

      await tx.user.delete({
        where: { id: authResult.userId },
      })
    })

    const res = NextResponse.json({ data: { success: true } })
    clearEvCookie(res)
    clearAuthCookies(res)
    return res
  } catch (error) {
    logApiError('auth/delete-account', 'deleteAccount', error, { userId: authResult.userId })
    return apiError('Failed to delete account. Please try again.', { status: 500, code: 'DELETE_ACCOUNT_FAILED' })
  }
}
