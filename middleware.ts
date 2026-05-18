import { NextRequest, NextResponse } from 'next/server'
import { buildCanonicalUrl, shouldUseCanonicalHost } from './src/utils/canonical-origin'

const EMAIL_VERIFIED_PROTECTED_ROUTES = [
  '/dashboard',
  '/inspection',
  '/vehicle',
  '/report',
  '/premium',
  '/community',
  '/messages',
  '/profile',
]

// Returns the `role` claim from the uci_at JWT without verifying the signature.
// Used only for UX routing decisions (feature gates, redirects) — not for security.
function getJwtRole(token: string): string {
  try {
    const segment = token.split('.')[1]
    if (!segment) return ''
    const padded  = segment.replaceAll('-', '+').replaceAll('_', '/').padEnd(Math.ceil(segment.length / 4) * 4, '=')
    const payload = JSON.parse(atob(padded))
    return typeof payload.role === 'string' ? payload.role : ''
  } catch {
    return ''
  }
}

export function middleware(req: NextRequest) {
  if (!['GET', 'HEAD'].includes(req.method)) return NextResponse.next()

  if (shouldUseCanonicalHost(req)) {
    return NextResponse.redirect(buildCanonicalUrl(req), 308)
  }

  const { pathname } = req.nextUrl

  // ── Premium route gate ───────────────────────────────────────────────────────
  // When the NEXT_PUBLIC_FEATURE_PREMIUM_VISIBLE flag is off, block /premium for
  // non-admin users and redirect them to /dashboard instead.
  const premiumEnabled =
    process.env.NEXT_PUBLIC_FEATURE_PREMIUM_VISIBLE === 'true' ||
    process.env.FEATURE_PREMIUM_VISIBLE === 'true'

  if (!premiumEnabled && (pathname === '/premium' || pathname.startsWith('/premium/'))) {
    const token = req.cookies.get('uci_at')?.value ?? ''
    const role  = getJwtRole(token)
    if (role !== 'ADMIN') {
      const dest = req.nextUrl.clone()
      dest.pathname = '/dashboard'
      dest.search   = ''
      return NextResponse.redirect(dest)
    }
  }

  // ── Email verification gate ──────────────────────────────────────────────────
  const requiresVerifiedEmail = EMAIL_VERIFIED_PROTECTED_ROUTES.some(
    route => pathname === route || pathname.startsWith(route + '/'),
  )

  if (requiresVerifiedEmail && req.cookies.get('uci_ev')?.value === '0') {
    const dest = req.nextUrl.clone()
    dest.pathname = '/verify-required'
    dest.search = ''
    return NextResponse.redirect(dest)
  }

  return NextResponse.next()
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|icons/|sw.js).*)',
  ],
}
