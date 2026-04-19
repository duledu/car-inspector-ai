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

export function middleware(req: NextRequest) {
  if (!['GET', 'HEAD'].includes(req.method)) return NextResponse.next()

  if (shouldUseCanonicalHost(req)) {
    return NextResponse.redirect(buildCanonicalUrl(req), 308)
  }

  const { pathname } = req.nextUrl
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
