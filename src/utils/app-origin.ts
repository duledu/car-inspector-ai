/**
 * SERVER-ONLY — do NOT import from client components or pages.
 *
 * Resolves the canonical public-facing origin of this app in a way that is
 * safe behind reverse proxies, Cloudflare Tunnels, Caddy, or any other
 * SSL-terminating infrastructure.
 *
 * WHY THIS EXISTS
 * ───────────────
 * When Next.js runs behind nginx with SSL termination, `req.nextUrl.origin`
 * returns "http://…" because the server only sees plain HTTP from the proxy.
 * Using that directly as the OAuth `redirect_uri` produces a mismatch against
 * the "https://…" URI registered in Google Cloud Console, causing token
 * exchange to fail with `redirect_uri_mismatch`.
 *
 * RESOLUTION PRIORITY (first match wins)
 * ───────────────────────────────────────
 *   1. X-Forwarded-Proto + (X-Forwarded-Host ?? Host) — proxy headers
 *   2. APP_URL env var                                — server-only, canonical
 *   3. NEXT_PUBLIC_APP_URL env var                    — backward-compat
 *   4. req.nextUrl.origin                             — local dev without proxy
 *
 * HOST VALIDATION
 * ───────────────
 * When APP_URL (or NEXT_PUBLIC_APP_URL) is set, the resolved host is checked
 * against the canonical host extracted from that env var. A mismatch sets
 * `allowed = false`; callers must reject those requests to prevent open-
 * redirect / OAuth token theft via a spoofed X-Forwarded-Host header.
 * Localhost variants are always allowed for local development.
 * If no canonical host is configured at all, every host is accepted (useful
 * for CI / ephemeral environments).
 *
 * REQUIRED NGINX CONFIG
 * ──────────────────────
 *   proxy_set_header X-Forwarded-Proto  $scheme;
 *   proxy_set_header X-Forwarded-Host   $host;
 *   proxy_set_header X-Forwarded-For    $proxy_add_x_forwarded_for;
 *   proxy_set_header X-Real-IP          $remote_addr;
 *   proxy_set_header Host               $host;
 *
 * IMPORTANT: nginx must *set* (not just pass through) X-Forwarded-Proto and
 * X-Forwarded-Host so a malicious client cannot inject arbitrary values.
 */

import type { NextRequest } from 'next/server'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ResolvedOrigin {
  /** Full origin, e.g. "https://usedcarsdoctor.com" */
  origin: string
  /** Protocol without colon, e.g. "https" */
  proto: string
  /** Host with optional port, e.g. "usedcarsdoctor.com" or "localhost:3000" */
  host: string
  /**
   * Where the origin came from:
   *   "forwarded" — X-Forwarded-Proto / X-Forwarded-Host from proxy
   *   "env"       — APP_URL or NEXT_PUBLIC_APP_URL environment variable
   *   "request"   — req.nextUrl.origin (local dev fallback)
   */
  source: 'forwarded' | 'env' | 'request'
  /**
   * Whether the resolved host is in the allowed set.
   * false = caller should reject the request (host spoofing or misconfiguration).
   */
  allowed: boolean
}

// ---------------------------------------------------------------------------
// Canonical host — computed once per server process
// ---------------------------------------------------------------------------

function parseCanonicalHost(): string | null {
  const raw = process.env.APP_URL ?? process.env.NEXT_PUBLIC_APP_URL
  if (!raw) return null
  try {
    return new URL(raw.trim()).host.toLowerCase()
  } catch {
    return null
  }
}

/**
 * The canonical host derived from APP_URL / NEXT_PUBLIC_APP_URL.
 * null when no env is set (e.g. bare local dev).
 * Used for host validation — computed once at module load.
 */
export const CANONICAL_HOST: string | null = parseCanonicalHost()

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

function isLocalhost(host: string): boolean {
  const h = host.toLowerCase()
  return (
    h === 'localhost' ||
    /^localhost:\d{1,5}$/.test(h) ||
    h === '127.0.0.1' ||
    /^127\.0\.0\.1:\d{1,5}$/.test(h) ||
    h === '[::1]' ||
    /^\[::1\]:\d{1,5}$/.test(h)
  )
}

function isHostAllowed(host: string): boolean {
  const h = host.toLowerCase()
  if (isLocalhost(h)) return true
  if (!CANONICAL_HOST) return true   // no canonical configured → accept all (CI / bare dev)
  return h === CANONICAL_HOST
}

function parseRawUrl(raw: string): Pick<ResolvedOrigin, 'origin' | 'proto' | 'host'> | null {
  try {
    const u = new URL(raw.trim().replace(/\/+$/, ''))
    if (u.protocol !== 'http:' && u.protocol !== 'https:') return null
    const proto  = u.protocol.slice(0, -1)   // strip trailing ':'
    const host   = u.host.toLowerCase()
    const origin = `${proto}://${host}`
    return { origin, proto, host }
  } catch {
    return null
  }
}

// ---------------------------------------------------------------------------
// Main resolver
// ---------------------------------------------------------------------------

export function resolveAppOrigin(req: NextRequest): ResolvedOrigin {
  // ── 1. Reverse-proxy forwarded headers ──────────────────────────────────
  //
  // X-Forwarded-Proto carries the real TLS protocol used by the client.
  // For the host we prefer X-Forwarded-Host; fall back to the HTTP Host
  // header so setups that only configure X-Forwarded-Proto still work.
  //
  // NOTE: These headers must be *set* by the proxy (not passed through from
  // the client). See nginx config example in the module-level comment.
  //
  const fwdProto = req.headers.get('x-forwarded-proto')?.split(',')[0]?.trim()
  const fwdHost  =
    req.headers.get('x-forwarded-host')?.split(',')[0]?.trim() ??
    req.headers.get('host') ??
    undefined

  if (fwdProto && fwdHost) {
    const proto  = fwdProto.toLowerCase()
    const host   = fwdHost.toLowerCase()
    const origin = `${proto}://${host}`
    return { origin, proto, host, source: 'forwarded', allowed: isHostAllowed(host) }
  }

  // ── 2. Explicit env var ──────────────────────────────────────────────────
  //
  // APP_URL is the preferred server-only variable — not exposed to the browser.
  // NEXT_PUBLIC_APP_URL is accepted for backward compatibility.
  //
  const envRaw = process.env.APP_URL ?? process.env.NEXT_PUBLIC_APP_URL
  if (envRaw) {
    const parsed = parseRawUrl(envRaw)
    if (parsed) {
      return { ...parsed, source: 'env', allowed: isHostAllowed(parsed.host) }
    }
  }

  // ── 3. Request origin (local dev without proxy) ──────────────────────────
  const reqParsed = parseRawUrl(req.nextUrl.origin)
  if (reqParsed) {
    return { ...reqParsed, source: 'request', allowed: isHostAllowed(reqParsed.host) }
  }

  // Unreachable under normal HTTP operation, but provides a safe fallback.
  return {
    origin:  req.nextUrl.origin,
    proto:   'http',
    host:    'unknown',
    source:  'request',
    allowed: false,
  }
}
