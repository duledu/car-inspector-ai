import { prisma } from '@/config/prisma'
import { sendEmail } from '@/lib/email/send-email'
import { resolveEmailTemplateLang } from '@/lib/email/localized-template-content'
import type { AppAnnouncementContent } from '@/lib/email/types/email-template.types'
import type { SupportedLang } from '@/i18n/shared'

export type RecipientMode = 'db' | 'manual' | 'both'

export interface BulkSendTemplate {
  html:    string
  text:    string
  subject: string
}

export interface BulkSendOptions {
  template:      BulkSendTemplate
  manualEmails?: string[]
  recipientMode?: RecipientMode
}

export interface AnnouncementBulkSendOptions {
  content: AppAnnouncementContent
  manualEmails?: string[]
  manualLanguage?: string | null
  recipientMode?: RecipientMode
  renderTemplate: (content: AppAnnouncementContent, lang?: string) => BulkSendTemplate
}

export interface BulkSendResult {
  dbUsers:              number
  manualEmails:         number
  valid:                number
  sent:                 number
  failed:               number
  sentCount:            number
  failedCount:          number
  validRecipientsCount: number
  failedRecipients:     FailedRecipient[]
}

export interface FailedRecipient {
  email:  string
  reason: string
  source: 'db' | 'manual'
}

export const EMAIL_RE              = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
export const MAX_MANUAL_RECIPIENTS = 500
const        BATCH_SIZE            = 15

export function getSafeEmailFailureReason(error: unknown): string {
  const fallback = 'Email provider rejected the message. Check server logs for details.'
  if (!error) return fallback

  const message = typeof error === 'string'
    ? error
    : error instanceof Error
      ? error.message
      : ''

  const safe = message
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 220)

  if (!safe) return fallback
  if (safe.includes('\n') || safe.includes('\r') || safe.includes(' at ')) return fallback
  return safe
}

function buildBulkSendResult(params: {
  dbUsersCount: number
  manualCount: number
  valid: number
  sent: number
  failedRecipients: FailedRecipient[]
}): BulkSendResult {
  const failed = params.failedRecipients.length
  return {
    dbUsers:              params.dbUsersCount,
    manualEmails:         params.manualCount,
    valid:                params.valid,
    sent:                 params.sent,
    failed,
    sentCount:            params.sent,
    failedCount:          failed,
    validRecipientsCount: params.valid,
    failedRecipients:     params.failedRecipients,
  }
}

export async function sendBulkEmails(opts: BulkSendOptions): Promise<BulkSendResult> {
  const { template, manualEmails = [], recipientMode = 'db' } = opts

  const recipients: string[] = []
  let dbUsersCount = 0
  let manualCount  = 0

  if (recipientMode === 'db' || recipientMode === 'both') {
    const users    = await prisma.user.findMany({ select: { email: true } })
    const dbEmails = users.map(u => u.email).filter(e => EMAIL_RE.test(e))
    dbUsersCount   = dbEmails.length
    recipients.push(...dbEmails)
  }

  if (recipientMode === 'manual' || recipientMode === 'both') {
    const validManual = manualEmails
      .filter((e): e is string => typeof e === 'string')
      .map(e => e.trim())
      .filter(e => EMAIL_RE.test(e))
      .slice(0, MAX_MANUAL_RECIPIENTS)
    manualCount = validManual.length
    recipients.push(...validManual)
  }

  const unique = [...new Set(recipients)]
  const valid  = unique.length

  let sent = 0
  const failedRecipients: FailedRecipient[] = []

  for (let i = 0; i < unique.length; i += BATCH_SIZE) {
    const batch   = unique.slice(i, i + BATCH_SIZE)
    const results = await Promise.all(
      batch.map(email =>
        sendEmail({ to: email, subject: template.subject, html: template.html, text: template.text })
      ),
    )
    for (let idx = 0; idx < results.length; idx++) {
      const result = results[idx]
      const email  = batch[idx]
      if (result.success) {
        sent++
      } else {
        const reason = getSafeEmailFailureReason(result.error)
        const source = manualEmails.map(e => e.trim().toLowerCase()).includes(email.toLowerCase()) ? 'manual' : 'db'
        failedRecipients.push({ email, reason, source })
        console.error('[bulk-email] delivery failed:', { email, source, error: result.error })
      }
    }
  }

  return buildBulkSendResult({ dbUsersCount, manualCount, valid, sent, failedRecipients })
}

interface LocalizedRecipient {
  email: string
  lang: SupportedLang
  source: 'db' | 'manual'
}

export async function sendAnnouncementEmails(opts: AnnouncementBulkSendOptions): Promise<BulkSendResult> {
  const {
    content,
    manualEmails = [],
    manualLanguage,
    recipientMode = 'db',
    renderTemplate,
  } = opts

  const recipients: LocalizedRecipient[] = []
  let dbUsersCount = 0
  let manualCount  = 0

  if (recipientMode === 'db' || recipientMode === 'both') {
    const users = await prisma.user.findMany({ select: { email: true, preferredLanguage: true } })
    const dbRecipients = users
      .map(user => ({
        email: user.email.trim().toLowerCase(),
        lang:  resolveEmailTemplateLang(user.preferredLanguage),
        source: 'db' as const,
      }))
      .filter(user => EMAIL_RE.test(user.email))

    dbUsersCount = dbRecipients.length
    recipients.push(...dbRecipients)
  }

  if (recipientMode === 'manual' || recipientMode === 'both') {
    const lang = resolveEmailTemplateLang(manualLanguage)
    const validManual = manualEmails
      .filter((email): email is string => typeof email === 'string')
      .map(email => email.trim().toLowerCase())
      .filter(email => EMAIL_RE.test(email))
      .slice(0, MAX_MANUAL_RECIPIENTS)

    manualCount = validManual.length
    recipients.push(...validManual.map(email => ({ email, lang, source: 'manual' as const })))
  }

  const unique = new Map<string, LocalizedRecipient>()
  for (const recipient of recipients) {
    if (!unique.has(recipient.email)) {
      unique.set(recipient.email, recipient)
    }
  }

  const templateByLang = new Map<SupportedLang, BulkSendTemplate>()
  const all = [...unique.values()]
  let sent = 0
  const failedRecipients: FailedRecipient[] = []

  for (let i = 0; i < all.length; i += BATCH_SIZE) {
    const batch = all.slice(i, i + BATCH_SIZE)
    const results = await Promise.all(
      batch.map(recipient => {
        let template = templateByLang.get(recipient.lang)
        if (!template) {
          template = renderTemplate(content, recipient.lang)
          templateByLang.set(recipient.lang, template)
        }
        return sendEmail({ to: recipient.email, subject: template.subject, html: template.html, text: template.text })
          .then(result => ({ result, recipient }))
      }),
    )

    for (const { result, recipient } of results) {
      if (result.success) {
        sent++
      } else {
        const reason = getSafeEmailFailureReason(result.error)
        failedRecipients.push({ email: recipient.email, reason, source: recipient.source })
        console.error(`[announcement-email] ${recipient.source} delivery failed:`, {
          email: recipient.email,
          error: result.error,
        })
      }
    }
  }

  return buildBulkSendResult({ dbUsersCount, manualCount, valid: unique.size, sent, failedRecipients })
}
