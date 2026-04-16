import { NextRequest, NextResponse } from 'next/server'
import { buildCanonicalUrl, shouldUseCanonicalHost } from './src/utils/canonical-origin'

export function middleware(req: NextRequest) {
  if (!['GET', 'HEAD'].includes(req.method)) return NextResponse.next()
  if (!shouldUseCanonicalHost(req)) return NextResponse.next()

  return NextResponse.redirect(buildCanonicalUrl(req), 308)
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|icons/|sw.js).*)',
  ],
}
