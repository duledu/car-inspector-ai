// =============================================================================
// Consent Record — writes immutable acceptance evidence
//
// The only place ConsentRecord rows are created. Every field is captured at
// the moment of acceptance and never modified afterward — a later required
// version means a new row, not an edit to this one.
// =============================================================================

import type { Prisma, PrismaClient, ConsentPlatform } from '@prisma/client'
import { NextRequest } from 'next/server'
import {
  CURRENT_TERMS_VERSION,
  CURRENT_PRIVACY_VERSION,
  CURRENT_RISK_ACK_VERSION,
  CONSENT_FORM_VERSION,
} from './legal-config'

export interface RequestMeta {
  ipAddress: string | null
  userAgent: string | null
}

/** Extracts the narrow request metadata used ONLY for consent evidence — never for analytics/tracking. */
export function getRequestMeta(req: NextRequest): RequestMeta {
  const forwardedFor = req.headers.get('x-forwarded-for')
  const ipAddress = forwardedFor ? forwardedFor.split(',')[0].trim() : (req.headers.get('x-real-ip') ?? null)
  const userAgent = req.headers.get('user-agent')
  return { ipAddress, userAgent }
}

export interface RecordConsentInput {
  userId: string
  locale: string
  platform: ConsentPlatform
  meta: RequestMeta
}

/**
 * Creates a new ConsentRecord for the CURRENT required document versions.
 * Always writes the current versions — callers never get to pass their own,
 * so a client cannot claim to have accepted a version we don't currently
 * require (see the registration/consent route handlers for the inbound
 * validation this complements).
 *
 * Pass a transaction client (Prisma.TransactionClient) to create the record
 * atomically alongside other writes (e.g. new-user creation); pass the
 * top-level PrismaClient otherwise.
 */
export async function recordConsent(input: RecordConsentInput, client: PrismaClient | Prisma.TransactionClient) {
  return client.consentRecord.create({
    data: {
      userId: input.userId,
      userIdSnapshot: input.userId,
      termsVersion: CURRENT_TERMS_VERSION,
      privacyVersion: CURRENT_PRIVACY_VERSION,
      riskAckVersion: CURRENT_RISK_ACK_VERSION,
      locale: input.locale,
      platform: input.platform,
      formVersion: CONSENT_FORM_VERSION,
      ipAddress: input.meta.ipAddress,
      userAgent: input.meta.userAgent,
    },
  })
}
