// =============================================================================
// Auth API Route — /api/auth/[action]
// Handles: login, register, refresh, logout, me
// =============================================================================

import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import bcrypt from 'bcryptjs'
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

const SUPPORTED_LANGS = ['en', 'sr', 'de', 'mk', 'sq'] as const

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
  email: z.string().email(),
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
    case 'logout':
      // Stateless JWTs — client discards tokens. No server action needed.
      return NextResponse.json({ data: { success: true } })
    case 'forgot-password':
      return handleForgotPassword(body)
    case 'reset-password':
      return handleResetPassword(body)
    case 'send-verification':
      return handleSendVerification(req)
    case 'verify-email':
      return handleVerifyEmail(body)
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

// ─── DTO helper ──────────────────────────────────────────────────────────────

function toUserDto(user: { id: string; email: string; name: string; avatarUrl: string | null; role: string; preferredLanguage: string | null; createdAt: Date }) {
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    avatarUrl: user.avatarUrl,
    role: user.role,
    preferredLanguage: user.preferredLanguage ?? 'en',
    createdAt: user.createdAt.toISOString(),
  }
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

    return NextResponse.json({
      data: { accessToken, refreshToken, expiresAt, user: toUserDto(user) },
    })
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
    .catch(err => console.error('[register] verification email failed:', err))

  return NextResponse.json(
    { data: { accessToken, refreshToken, expiresAt, user: toUserDto(user) } },
    { status: 201 }
  )
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

    return NextResponse.json({
      data: { accessToken, refreshToken, expiresAt, user: toUserDto(user) },
    })
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

  try {
    const user = await prisma.user.findUnique({ where: { email: parsed.data.email } })
    // Always return success to prevent email enumeration
    if (!user?.passwordHash) {
      return NextResponse.json({ data: { success: true } })
    }

    await sendResetPasswordEmail({ userId: user.id, to: user.email, name: user.name, lang: user.preferredLanguage })

    return NextResponse.json({ data: { success: true } })
  } catch (error) {
    logApiError('auth/forgot-password', 'forgotPassword', error)
    return NextResponse.json({ data: { success: true } }) // never expose errors
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

    await sendVerifyEmail({ userId: user.id, to: user.email, name: user.name, lang: user.preferredLanguage })

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

    return NextResponse.json({ data: { success: true } })
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
