import type { NextRequest } from 'next/server'

export const CANONICAL_APP_ORIGIN = 'https://usedcarsdoctor.com'
export const CANONICAL_GOOGLE_CALLBACK_URL =
  `${CANONICAL_APP_ORIGIN}/api/auth/callback/google`

function cleanOrigin(value: string | undefined): string | null {
  if (!value) return null

  try {
    const url = new URL(value)
    if (url.protocol !== 'https:' && url.protocol !== 'http:') return null
    return url.origin.replace(/\/$/, '')
  } catch {
    return null
  }
}

export function getRequestOrigin(req: NextRequest): string {
  const proto = req.headers.get('x-forwarded-proto')?.split(',')[0]?.trim()
    ?? req.nextUrl.protocol.replace(':', '')
  const host = req.headers.get('x-forwarded-host')?.split(',')[0]?.trim()
    ?? req.headers.get('host')
    ?? req.nextUrl.host

  return `${proto}://${host}`.replace(/\/$/, '')
}

function isProductionDeployment(): boolean {
  return process.env.VERCEL_ENV === 'production'
}

export function getAppOrigin(req?: NextRequest): string {
  if (isProductionDeployment()) return CANONICAL_APP_ORIGIN

  const nextAuthUrl = cleanOrigin(process.env.NEXTAUTH_URL)
  if (nextAuthUrl) return nextAuthUrl

  const publicAppUrl = cleanOrigin(process.env.NEXT_PUBLIC_APP_URL)
  if (publicAppUrl) return publicAppUrl

  return req ? getRequestOrigin(req) : CANONICAL_APP_ORIGIN
}

export function shouldUseCanonicalHost(req: NextRequest): boolean {
  const host = req.headers.get('x-forwarded-host')?.split(',')[0]?.trim()
    ?? req.headers.get('host')
    ?? req.nextUrl.host

  if (host === 'www.usedcarsdoctor.com') return true
  if (isProductionDeployment() && host !== 'usedcarsdoctor.com') return true

  return false
}

export function getProductionAuthConfigIssues(): string[] {
  if (!isProductionDeployment()) return []

  const issues: string[] = []
  if (process.env.NEXTAUTH_URL !== CANONICAL_APP_ORIGIN) {
    issues.push(`NEXTAUTH_URL=${process.env.NEXTAUTH_URL ?? 'missing'}`)
  }
  if (process.env.NEXT_PUBLIC_APP_URL !== CANONICAL_APP_ORIGIN) {
    issues.push(`NEXT_PUBLIC_APP_URL=${process.env.NEXT_PUBLIC_APP_URL ?? 'missing'}`)
  }

  return issues
}

export function buildCanonicalUrl(req: NextRequest): URL {
  return new URL(req.nextUrl.pathname + req.nextUrl.search, CANONICAL_APP_ORIGIN)
}

export function buildUrlForOrigin(req: NextRequest, origin: string): URL {
  return new URL(req.nextUrl.pathname + req.nextUrl.search, origin)
}
