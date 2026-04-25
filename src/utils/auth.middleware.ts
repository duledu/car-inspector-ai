// =============================================================================
// Auth Middleware — used in all API route handlers
// Verifies JWT and returns userId or rejects with 401.
// =============================================================================

import { NextRequest } from 'next/server'
import jwt from 'jsonwebtoken'

interface AuthSuccess {
  success: true
  userId: string
  email: string
  role: string
}

interface AuthFailure {
  success: false
  reason: string
}

type AuthResult = AuthSuccess | AuthFailure

const JWT_SECRET = process.env.JWT_SECRET ?? ''

export async function requireAuth(req: NextRequest): Promise<AuthResult> {
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
      iat: number
      exp: number
    }

    return {
      success: true,
      userId: payload.sub,
      email: payload.email,
      role: payload.role,
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
export function issueTokens(userId: string, email: string, role: string) {
  if (!JWT_SECRET) throw new Error('JWT_SECRET is not configured')

  const accessToken = jwt.sign(
    { sub: userId, email, role },
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
