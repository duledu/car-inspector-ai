import { buildAppUpdateTemplate } from '../templates/app-update-template'
import { sendEmail } from '../send-email'

export interface SendAppUpdateEmailInput {
  to:           string | string[]
  ctaUrl:       string
  lang?:        string | null
  previewText?: string
}

export async function sendAppUpdateEmail(input: SendAppUpdateEmailInput): Promise<void> {
  const template    = buildAppUpdateTemplate({ ctaUrl: input.ctaUrl, lang: input.lang, previewText: input.previewText })
  const recipients  = Array.isArray(input.to) ? input.to : [input.to]
  for (const recipient of recipients) {
    await sendEmail({ to: recipient, subject: template.subject, html: template.html, text: template.text })
  }
}
