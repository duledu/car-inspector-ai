// =============================================================================
// Promo Codes — server-only entitlement grants
//
// This module is imported only by server-side code (API route handlers and
// lib/inspection/access.ts, both of which import prisma and therefore never
// reach a client bundle) — the code list below is never shipped to the
// browser. Keep it that way: never import this file from a 'use client'
// component.
// =============================================================================

export interface PromoMeta {
  grantedVia: string
  unlimited?: boolean
  /** ISO-8601 timestamp. Once past, the code no longer redeems. Optional. */
  expiresAt?: string
  /** Set true to retire a code without deleting its history/metadata. */
  disabled?: boolean
}

const PROMO_CODES: Record<string, PromoMeta> = {
  // Internal/VIP tester code. Documented status as of this hardening pass:
  // permanent, unlimited-use, hardcoded, with no expiry or disablement set.
  // That is a deliberate business decision already in effect for existing
  // users, not a bug — changing it (expiring or disabling VIP0629 itself) is
  // a product/business call and must be made explicitly by setting
  // `expiresAt`/`disabled` below, not by touching route logic.
  VIP0629: { grantedVia: 'promo', unlimited: true },
}

export function getPromoMeta(code: string): PromoMeta | null {
  const meta = PROMO_CODES[code.toUpperCase()]
  if (!meta) return null
  if (meta.disabled) return null
  if (meta.expiresAt && Date.now() > Date.parse(meta.expiresAt)) return null
  return meta
}
