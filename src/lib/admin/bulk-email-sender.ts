import { prisma } from '@/config/prisma'
import { sendEmail } from '@/lib/email/send-email'

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

export interface BulkSendResult {
  dbUsers:      number
  manualEmails: number
  valid:        number
  sent:         number
  failed:       number
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export async function sendBulkEmails(opts: BulkSendOptions): Promise<BulkSendResult> {
  const { template, manualEmails = [], recipientMode = 'db' } = opts

  const recipients: string[] = []
  let dbUsersCount  = 0
  let manualCount   = 0

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
    manualCount = validManual.length
    recipients.push(...validManual)
  }

  const unique = [...new Set(recipients)]
  const valid  = unique.length

  let sent   = 0
  let failed = 0

  for (const email of unique) {
    const result = await sendEmail({
      to:      email,
      subject: template.subject,
      html:    template.html,
      text:    template.text,
    })
    if (result.success) {
      sent++
    } else {
      failed++
      console.error('[bulk-email] failed for', email, result.error)
    }
  }

  return { dbUsers: dbUsersCount, manualEmails: manualCount, valid, sent, failed }
}
