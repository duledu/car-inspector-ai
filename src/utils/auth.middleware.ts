// =============================================================================
// Auth Middleware — used in all API route handlers
// Verifies JWT and returns userId or rejects with 401.
// =============================================================================

import { NextRequest } from 'next/server'
import jwt from 'jsonwebtoken'
import { prisma } from '@/config/prisma'

interface AuthSuccess {
  success: true
  userId: string
  email: string
  role: string
  emailVerified: boolean
}

interface AuthFailure {
  success: false
  reason: string
}

type AuthResult = AuthSuccess | AuthFailure

const JWT_SECRET = process.env.JWT_SECRET ?? ''

interface RequireAuthOptions {
  allowUnverified?: boolean
}

export async function requireAuth(req: NextRequest, options: RequireAuthOptions = {}): Promise<AuthResult> {
  if (!JWT_SECRET) {
    console.error('[auth] JWT_SECRET environment variable is not set')
    return { success: false, reason: 'Server configuration error' }
  }

  const token = req.cookies.get('uci_at')?.value ?? null

  if (!token) {
    return { success: false, reason: 'Missing auth cookie' }
  }

  try {
    const payload = jwt.verify(token, JWT_SECRET) as {
      sub: string
      email: string
      role: string
      emailVerified?: boolean
      iat: number
      exp: number
    }

    let emailVerified = payload.emailVerified === true

    // Tokens issued before the emailVerified claim existed are refreshed lazily.
    // Until then, check the database so verified users are not locked out by an
    // old 15-minute access token.
    if (payload.emailVerified === undefined) {
      const user = await prisma.user.findUnique({
        where: { id: payload.sub },
        select: { emailVerified: true },
      })
      emailVerified = !!user?.emailVerified
    }

    if (!emailVerified && !options.allowUnverified) {
      return { success: false, reason: 'Email verification required' }
    }

    return {
      success: true,
      userId: payload.sub,
      email: payload.email,
      role: payload.role,
      emailVerified,
    }
  } catch (err: any) {
    if (err.name === 'TokenExpiredError') {
      return { success: false, reason: 'Token expired' }
    }
    return { success: false, reason: 'Invalid token' }
  }
}

/**
 * issueTokens
 * Creates access + refresh tokens for a user.
 * Used in login and register routes.
 */
export function issueTokens(userId: string, email: string, role: string, emailVerified: boolean) {
  if (!JWT_SECRET) throw new Error('JWT_SECRET is not configured')

  const accessToken = jwt.sign(
    { sub: userId, email, role, emailVerified },
    JWT_SECRET,
    { expiresIn: '15m' }
  )

  const refreshToken = jwt.sign(
    { sub: userId, type: 'refresh' },
    JWT_SECRET,
    { expiresIn: '30d' }
  )

  return {
    accessToken,
    refreshToken,
    expiresAt: Date.now() + 15 * 60 * 1000,
  }
}
