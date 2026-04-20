import { prisma } from '@/config/prisma'
import { sendEmail } from '@/lib/email/send-email'
import { buildMarketingEmailTemplate } from '@/lib/email/templates/marketing-email-template'
import { localizeMarketingContent, resolveMarketingLang } from '@/lib/email/marketing-i18n'
import type { SupportedLang } from '@/i18n/shared'
import type { MarketingCampaignContent } from '@/lib/email/types/email-template.types'
import { EMAIL_RE, MAX_MANUAL_RECIPIENTS } from './bulk-email-sender'
import type { BulkSendResult, RecipientMode } from './bulk-email-sender'

interface MarketingRecipient {
  email: string
  lang: SupportedLang
  source: 'db' | 'manual'
}

export interface SendMarketingEmailsOptions {
  content: MarketingCampaignContent
  manualEmails?: string[]
  manualLanguage?: string | null
  recipientMode?: RecipientMode
}

const BATCH_SIZE = 15

function normalizeManualEmails(raw: string[]): string[] {
  return raw
    .filter((email): email is string => typeof email === 'string')
    .map(email => email.trim().toLowerCase())
    .filter(email => EMAIL_RE.test(email))
    .slice(0, MAX_MANUAL_RECIPIENTS)
}

export async function sendMarketingEmails(opts: SendMarketingEmailsOptions): Promise<BulkSendResult> {
  const {
    content,
    manualEmails = [],
    manualLanguage,
    recipientMode = 'db',
  } = opts

  const recipients: MarketingRecipient[] = []
  let dbUsersCount = 0
  let manualCount  = 0

  if (recipientMode === 'db' || recipientMode === 'both') {
    const users = await prisma.user.findMany({
      select: { email: true, preferredLanguage: true },
    })

    const dbRecipients = users
      .map(user => ({
        email: user.email.trim().toLowerCase(),
        lang:  resolveMarketingLang(user.preferredLanguage),
        source: 'db' as const,
      }))
      .filter(user => EMAIL_RE.test(user.email))

    dbUsersCount = dbRecipients.length
    recipients.push(...dbRecipients)
  }

  if (recipientMode === 'manual' || recipientMode === 'both') {
    const lang = resolveMarketingLang(manualLanguage)
    const manualRecipients = normalizeManualEmails(manualEmails).map(email => ({
      email,
      lang,
      source: 'manual' as const,
    }))

    manualCount = manualRecipients.length
    recipients.push(...manualRecipients)
  }

  const unique = new Map<string, MarketingRecipient>()
  for (const recipient of recipients) {
    if (!unique.has(recipient.email)) {
      unique.set(recipient.email, recipient)
    }
  }

  const templateByLang = new Map<SupportedLang, ReturnType<typeof buildMarketingEmailTemplate>>()
  let sent   = 0
  let failed = 0

  const all = [...unique.values()]

  for (let i = 0; i < all.length; i += BATCH_SIZE) {
    const batch   = all.slice(i, i + BATCH_SIZE)
    const results = await Promise.all(
      batch.map(recipient => {
        let template = templateByLang.get(recipient.lang)
        if (!template) {
          const localized = localizeMarketingContent(content, recipient.lang)
          template = buildMarketingEmailTemplate(localized.content, localized.lang)
          templateByLang.set(recipient.lang, template)
        }
        return sendEmail({ to: recipient.email, subject: template.subject, html: template.html, text: template.text })
          .then(result => ({ result, source: recipient.source }))
      }),
    )
    for (const { result, source } of results) {
      if (result.success) {
        sent++
      } else {
        failed++
        console.error(`[marketing-email] ${source} delivery failed:`, result.error)
      }
    }
  }

  return {
    dbUsers:      dbUsersCount,
    manualEmails: manualCount,
    valid:        unique.size,
    sent,
    failed,
  }
}

