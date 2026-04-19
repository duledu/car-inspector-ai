import { createPasswordResetToken } from '../token-utils'
import { buildResetPasswordTemplate } from '../templates/reset-password-template'
import { sendEmail } from '../send-email'
import { getAppOrigin } from '@/utils/canonical-origin'
import type { SendEmailResult } from '../provider'

export interface SendResetPasswordEmailInput {
  userId: string
  to:     string
  name:   string
  lang?:  string | null
}

export async function sendResetPasswordEmail(input: SendResetPasswordEmailInput): Promise<SendEmailResult> {
  const token    = await createPasswordResetToken(input.userId)
  const resetUrl = `${getAppOrigin()}/auth/reset-password?token=${token}`
  const template = buildResetPasswordTemplate({ name: input.name, resetUrl, lang: input.lang })
  const result   = await sendEmail({ to: input.to, subject: template.subject, html: template.html, text: template.text })
  if (!result.success) {
    console.error(`[email/reset] delivery failed: ${result.error}`)
  }
  return result
}
