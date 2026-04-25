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
})

const refreshSchema = z.object({
  refreshToken: z.string().min(1),
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
      return handleRegister(body)
    case 'refresh':
      return handleRefresh(body)
    case 'logout': {
      const logoutRes = NextResponse.json({ data: { success: true } })
      clearEvCookie(logoutRes)
      return logoutRes
    }
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

const EV_COOKIE    = 'uci_ev'
const EV_MAX_AGE   = 30 * 24 * 60 * 60  // 30 days
const IS_PROD      = process.env.NODE_ENV === 'production'

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

// ─── DTO helper ──────────────────────────────────────────────────────────────

function toUserDto(user: { id: string; email: string; name: string; avatarUrl: string | null; role: string; preferredLanguage: string | null; emailVerified: Date | null; createdAt: Date }) {
  return {
    id:                user.id,
    email:             user.email,
    name:              user.name,
    avatarUrl:         user.avatarUrl,
    role:              user.role,
    preferredLanguage: user.preferredLanguage ?? 'en',
    emailVerified:     !!user.emailVerified,
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

    const { accessToken, refreshToken, expiresAt } = issueTokens(user.id, user.email, user.role)
    const res = NextResponse.json({
      data: { accessToken, refreshToken, expiresAt, user: toUserDto(user) },
    })
    setEvCookie(res, !!user.emailVerified)
    return res
  } catch (error) {
    logApiError('auth/login', 'login', error)
    const message = error instanceof Error ? error.message : String(error)
    return apiError('An unexpected error occurred. Please try again.', { status: 500, code: 'INTERNAL_ERROR', details: { detail: message } })
  }
}

async function handleRegister(body: unknown) {
  const parsed = registerSchema.safeParse(body)
  if (!parsed.success) {
    return apiError('Validation failed', { status: 422, code: 'VALIDATION_ERROR', details: parsed.error.flatten().fieldErrors })
  }

  const existing = await prisma.user.findUnique({ where: { email: parsed.data.email } })
  if (existing) {
    return apiError('An account with this email already exists', { status: 409, code: 'EMAIL_IN_USE' })
  }

  const passwordHash = await bcrypt.hash(parsed.data.password, 12)

  const user = await prisma.user.create({
    data: {
      name: parsed.data.name,
      email: parsed.data.email,
      passwordHash,
      role: 'USER',
      preferredLanguage: parsed.data.preferredLanguage,
    },
  })

  const { accessToken, refreshToken, expiresAt } = issueTokens(user.id, user.email, user.role)

  // Fire-and-forget — never block registration on email delivery
  sendVerifyEmail({ userId: user.id, to: user.email, name: user.name, lang: user.preferredLanguage })
    .then(result => {
      if (!result.success) console.error('[auth/register] verification email failed:', result.error)
    })
    .catch(err => console.error('[auth/register] verification email unexpected error:', err))

  const res = NextResponse.json(
    { data: { accessToken, refreshToken, expiresAt, user: toUserDto(user) } },
    { status: 201 }
  )
  setEvCookie(res, false) // new registrations are always unverified
  return res
}

async function handleRefresh(body: unknown) {
  const parsed = refreshSchema.safeParse(body)
  if (!parsed.success) {
    return apiError('Refresh token required', { status: 422, code: 'VALIDATION_ERROR' })
  }

  try {
    const jwt = await import('jsonwebtoken')
    const JWT_SECRET = process.env.JWT_SECRET
    if (!JWT_SECRET) throw new Error('JWT_SECRET is not configured')
    const payload = jwt.default.verify(parsed.data.refreshToken, JWT_SECRET) as {
      sub: string
      type: string
    }

    if (payload.type !== 'refresh') {
      throw new Error('Not a refresh token')
    }

    const user = await prisma.user.findUnique({ where: { id: payload.sub } })
    if (!user) throw new Error('User not found')

    const { accessToken, refreshToken, expiresAt } = issueTokens(user.id, user.email, user.role)
    const res = NextResponse.json({
      data: { accessToken, refreshToken, expiresAt, user: toUserDto(user) },
    })
    setEvCookie(res, !!user.emailVerified)
    return res
  } catch {
    return apiError('Invalid or expired refresh token', { status: 401, code: 'INVALID_REFRESH_TOKEN' })
  }
}

async function handleGetMe(req: NextRequest) {
  const authResult = await requireAuth(req)
  if (!authResult.success) {
    return apiError('Unauthorized', { status: 401, code: 'UNAUTHORIZED' })
  }

  const user = await prisma.user.findUnique({ where: { id: authResult.userId } })
  if (!user) {
    return apiError('User not found', { status: 404, code: 'NOT_FOUND' })
  }

  return NextResponse.json({ data: toUserDto(user) })
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
        emailHash,
        userId: user.id,
        error: emailResult.error,
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
  const authResult = await requireAuth(req)
  if (!authResult.success) {
    return apiError('Unauthorized', { status: 401, code: 'UNAUTHORIZED' })
  }

  try {
    const user = await prisma.user.findUnique({ where: { id: authResult.userId } })
    if (!user) return apiError('User not found', { status: 404, code: 'NOT_FOUND' })
    if (user.emailVerified) return NextResponse.json({ data: { success: true, alreadyVerified: true } })

    const emailResult = await sendVerifyEmail({ userId: user.id, to: user.email, name: user.name, lang: user.preferredLanguage })
    if (!emailResult.success) {
      console.error('[auth/send-verification] email failed:', emailResult.error)
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
  })

  const parsed = schema.safeParse(body)
  if (!parsed.success) {
    return apiError('Validation failed', { status: 422, code: 'VALIDATION_ERROR' })
  }

  const updated = await prisma.user.update({
    where: { id: authResult.userId },
    data: { ...parsed.data },
  })

  return NextResponse.json({ data: toUserDto(updated) })
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
    return res
  } catch (error) {
    logApiError('auth/delete-account', 'deleteAccount', error, { userId: authResult.userId })
    return apiError('Failed to delete account. Please try again.', { status: 500, code: 'DELETE_ACCOUNT_FAILED' })
  }
}
