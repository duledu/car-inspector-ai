// =============================================================================
// Auth API Route — /api/auth/[action]
// Handles: login, register, refresh, logout, me
// =============================================================================

import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import bcrypt from 'bcryptjs'
import { prisma } from '@/config/prisma'
import { issueTokens, requireAuth } from '@/utils/auth.middleware'

// ─── Schemas ─────────────────────────────────────────────────────────────────

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
})

const registerSchema = z.object({
  name: z.string().min(2).max(100),
  email: z.string().email(),
  password: z.string().min(8).max(128),
})

const refreshSchema = z.object({
  refreshToken: z.string().min(1),
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
    default:
      return NextResponse.json({ message: 'Not found', code: 'NOT_FOUND' }, { status: 404 })
  }
}

export async function GET(
  req: NextRequest,
  { params }: { params: { action: string } }
) {
  if (params.action === 'me') {
    return handleGetMe(req)
  }
  return NextResponse.json({ message: 'Not found', code: 'NOT_FOUND' }, { status: 404 })
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: { action: string } }
) {
  if (params.action === 'me') {
    return handleUpdateProfile(req)
  }
  return NextResponse.json({ message: 'Not found', code: 'NOT_FOUND' }, { status: 404 })
}

// ─── Handlers ────────────────────────────────────────────────────────────────

async function handleLogin(body: unknown) {
  const parsed = loginSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { message: 'Invalid credentials format', code: 'VALIDATION_ERROR' },
      { status: 422 }
    )
  }

  try {
    console.log('[login] attempt for:', parsed.data.email)

    const user = await prisma.user.findUnique({
      where: { email: parsed.data.email },
    })

    console.log('[login] user found:', user ? user.id : 'null')

    if (!user || !user.passwordHash) {
      return NextResponse.json(
        { message: 'Invalid email or password', code: 'INVALID_CREDENTIALS' },
        { status: 401 }
      )
    }

    const passwordValid = await bcrypt.compare(parsed.data.password, user.passwordHash)
    console.log('[login] password valid:', passwordValid)

    if (!passwordValid) {
      return NextResponse.json(
        { message: 'Invalid email or password', code: 'INVALID_CREDENTIALS' },
        { status: 401 }
      )
    }

    const { accessToken, refreshToken, expiresAt } = issueTokens(user.id, user.email, user.role)

    return NextResponse.json({
      data: {
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
    })
  } catch (error) {
    console.error('[login] ERROR:', error)
    const message = error instanceof Error ? error.message : String(error)
    return NextResponse.json(
      { message: 'Login failed', code: 'INTERNAL_ERROR', detail: message },
      { status: 500 }
    )
  }
}

async function handleRegister(body: unknown) {
  const parsed = registerSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      {
        message: 'Validation failed',
        code: 'VALIDATION_ERROR',
        details: parsed.error.flatten().fieldErrors,
      },
      { status: 422 }
    )
  }

  const existing = await prisma.user.findUnique({ where: { email: parsed.data.email } })
  if (existing) {
    return NextResponse.json(
      { message: 'An account with this email already exists', code: 'EMAIL_IN_USE' },
      { status: 409 }
    )
  }

  const passwordHash = await bcrypt.hash(parsed.data.password, 12)

  const user = await prisma.user.create({
    data: {
      name: parsed.data.name,
      email: parsed.data.email,
      passwordHash,
      role: 'USER',
    },
  })

  const { accessToken, refreshToken, expiresAt } = issueTokens(user.id, user.email, user.role)

  return NextResponse.json(
    {
      data: {
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
    },
    { status: 201 }
  )
}

async function handleRefresh(body: unknown) {
  const parsed = refreshSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ message: 'Refresh token required', code: 'VALIDATION_ERROR' }, { status: 422 })
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
      data: {
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
    })
  } catch {
    return NextResponse.json(
      { message: 'Invalid or expired refresh token', code: 'INVALID_REFRESH_TOKEN' },
      { status: 401 }
    )
  }
}

async function handleGetMe(req: NextRequest) {
  const authResult = await requireAuth(req)
  if (!authResult.success) {
    return NextResponse.json({ message: 'Unauthorized', code: 'UNAUTHORIZED' }, { status: 401 })
  }

  const user = await prisma.user.findUnique({ where: { id: authResult.userId } })
  if (!user) {
    return NextResponse.json({ message: 'User not found', code: 'NOT_FOUND' }, { status: 404 })
  }

  return NextResponse.json({
    data: {
      id: user.id,
      email: user.email,
      name: user.name,
      avatarUrl: user.avatarUrl,
      role: user.role,
      createdAt: user.createdAt.toISOString(),
    },
  })
}

async function handleUpdateProfile(req: NextRequest) {
  const authResult = await requireAuth(req)
  if (!authResult.success) {
    return NextResponse.json({ message: 'Unauthorized', code: 'UNAUTHORIZED' }, { status: 401 })
  }

  const body = await req.json().catch(() => ({}))
  const schema = z.object({
    name: z.string().min(2).max(100).optional(),
    avatarUrl: z.string().url().nullable().optional(),
  })

  const parsed = schema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ message: 'Validation failed', code: 'VALIDATION_ERROR' }, { status: 422 })
  }

  const updated = await prisma.user.update({
    where: { id: authResult.userId },
    data: { ...parsed.data },
  })

  return NextResponse.json({
    data: {
      id: updated.id,
      email: updated.email,
      name: updated.name,
      avatarUrl: updated.avatarUrl,
      role: updated.role,
      createdAt: updated.createdAt.toISOString(),
    },
  })
}
