// =============================================================================
// Health / Diagnostics — /api/health
// Returns which required env vars are PRESENT (true/false, never the values).
// Safe to expose publicly — no secrets are leaked.
// =============================================================================

import { NextResponse } from 'next/server'

export const runtime = 'nodejs'

export async function GET() {
  const checks = {
    JWT_SECRET:      !!process.env.JWT_SECRET      && process.env.JWT_SECRET.length > 0,
    DATABASE_URL:    !!process.env.DATABASE_URL     && process.env.DATABASE_URL.length > 0,
    OPENAI_API_KEY:  !!process.env.OPENAI_API_KEY   && process.env.OPENAI_API_KEY.length > 0,
    NODE_ENV:        process.env.NODE_ENV ?? 'unknown',
    NEXT_PHASE:      process.env.NEXT_PHASE ?? 'runtime',
  }

  const allRequired = checks.JWT_SECRET && checks.DATABASE_URL
  return NextResponse.json({ ok: allRequired, checks }, { status: allRequired ? 200 : 503 })
}
